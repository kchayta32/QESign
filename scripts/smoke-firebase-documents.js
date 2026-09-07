// Opt-in live integration check. Writes ONLY uniquely prefixed synthetic records,
// then removes every created path and verifies cleanup. Never edits a roster account.
// Usage: node -r ./scripts/register-ts.js scripts/smoke-firebase-documents.js --confirm-live
if (!process.argv.includes('--confirm-live')) throw new Error('Requires --confirm-live');
const assert = require('node:assert/strict');
const { get, ref, update, query, orderByChild, equalTo } = require('firebase/database');
const { rtdb } = require('../src/lib/firebase/config.ts');
const { RTDB_ROOT, persistChanges } = require('../src/lib/firebase/rtdb.ts');
const { dbStore } = require('../src/lib/firebase/db.ts');
const { uploadAvatar } = require('../src/lib/media/avatar.ts');
const { resolvePdfDocument } = require('../src/lib/media/pdf.ts');
const { checkQEBookingPrerequisite } = require('../src/lib/rules/engine.ts');
const prefix = `DUO-VERIFY-${Date.now()}`;
const studentId = `${prefix}-STUDENT`;
const teacherId = `${prefix}-TEACHER`;
const types = ['proposal', 'chapter3', 'chapter5', 'withdraw'];
const scores = ['A', 'B', 'C'].map((id) => ({ examinerId: id, examinerName: id, score: 80,
  isPass: true, comments: '', evaluatedAt: '', signatureStatus: true }));
const cleanup = {
  [`students/${studentId}`]: null, [`teachers/${teacherId}`]: null,
  [`qeBookingSlots/${studentId}`]: null,
  [`avatars/students/${studentId}`]: null, [`avatars/teachers/${teacherId}`]: null,
};
for (const type of types) {
  cleanup[`projectDocuments/${prefix}-${type}`] = null;
  cleanup[`documentFiles/${prefix}-${type}`] = null;
}
const read = async (path) => (await get(ref(rtdb, `${RTDB_ROOT}/${path}`))).val();
(async () => {
  try {
    const student = { ...dbStore.getStudentById('STD-66122519020'), id: studentId, uid: studentId,
      studentCode: prefix, email: 'verification@example.invalid', firstNameTh: 'ทดสอบชั่วคราว', lastNameTh: 'Duo',
      advisorId: teacherId, passwordHash: undefined, passed3Chapter: false, passedQE: false, profileCompleted: false };
    const teacher = { ...dbStore.getTeacherById('T-108'), id: teacherId, uid: teacherId, teacherCode: teacherId,
      email: 'verification-teacher@example.invalid', firstNameTh: 'ทดสอบชั่วคราว', lastNameTh: 'Duo',
      passwordHash: undefined, profileCompleted: false };
    // Isolated fixtures for the real store's public profile APIs (no authenticated session).
    dbStore.getStudents().push(student);
    dbStore.getTeachers().push(teacher);
    await persistChanges({ [`students/${studentId}`]: student, [`teachers/${teacherId}`]: teacher });
    const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
    for (const [kind, id] of [['student', studentId], ['teacher', teacherId]]) {
      const start = performance.now();
      const avatarUrl = await uploadAvatar(kind === 'student' ? 'students' : 'teachers', id, jpeg);
      await dbStore.saveProfile(kind, id, { phone: '0000000000', avatarUrl, profileCompleted: true });
      const elapsed = Math.round(performance.now() - start);
      const saved = await read(`${kind === 'student' ? 'students' : 'teachers'}/${id}`);
      assert.equal(saved.profileCompleted, true);
      assert.equal(saved.avatarUrl, avatarUrl);
      assert.equal(saved.phone, '0000000000');
      console.log(`[PASS] live ${kind} first-profile + avatar save/read-back: ${elapsed} ms`);
    }
    assert.equal(checkQEBookingPrerequisite(dbStore.getStudentById(studentId), 'SW', []).canBook, false);
    const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF').toString('base64')}`;
    const orphan = `${prefix}-withdraw`;
    await assert.rejects(update(ref(rtdb, RTDB_ROOT), { [`documentFiles/${orphan}`]: pdf }), /PERMISSION_DENIED/);
    assert.equal(await read(`documentFiles/${orphan}`), null);
    const withdrawInput = { id: orphan, studentId, studentUid: studentId, studentCode: prefix,
      studentNameTh: 'Duo verification', projectTitle: 'Temporary withdrawal', docType: 'proposal',
      fileName: 'withdraw.pdf', fileSize: 60, fileRef: `pdf://${orphan}`, advisorId: teacherId, advisorNameTh: 'Duo verification' };
    await assert.rejects(update(ref(rtdb, RTDB_ROOT), { [`projectDocuments/${orphan}`]: { ...withdrawInput, status: 'submitted' } }), /PERMISSION_DENIED/);
    assert.equal(await read(`projectDocuments/${orphan}`), null);
    await dbStore.submitProjectDocument(withdrawInput, pdf);
    assert.equal(await read(`documentFiles/${orphan}`), pdf);
    await dbStore.withdrawProjectDocument(orphan);
    assert.equal(await read(`projectDocuments/${orphan}`), null);
    assert.equal(await read(`documentFiles/${orphan}`), null);
    console.log('[PASS] deployed rules reject orphan bytes/broken metadata; paired submit and withdrawal work');
    const bookingInput = { studentId, studentUid: studentId, studentCode: prefix, studentNameTh: 'Duo verification',
      trackId: 'SW', roundId: 'DUO-VERIFY-ROUND', roundName: 'Temporary', examDate: '2026-09-10', timeSlot: '09:00 - 10:30',
      room: 'Temporary', status: 'pending', examinerIds: ['A', 'B', 'C'], examinerNames: ['A', 'B', 'C'],
      prerequisitePassed: true, submissionDate: '2026-09-07' };
    for (const type of types.filter((type) => type !== 'withdraw')) {
      const id = `${prefix}-${type}`;
      const fileRef = `pdf://${id}`;
      await dbStore.submitProjectDocument({ id, studentId, studentUid: studentId, studentCode: prefix,
        studentNameTh: 'Duo verification', projectTitle: 'Temporary integration check', docType: type,
        fileName: `${type}.pdf`, fileSize: 60, fileRef, advisorId: teacherId, advisorNameTh: 'Duo verification' }, pdf);
      assert.equal(await read(`documentFiles/${id}`), pdf);
      assert.equal(await resolvePdfDocument(fileRef), pdf);
      assert.equal((await read(`projectDocuments/${id}`)).status, 'submitted');
      await dbStore.reviewProjectDocument(id, 'approved', teacher);
      assert.equal((await read(`projectDocuments/${id}`)).status, 'approved');
      console.log(`[PASS] live ${type} PDF upload, read-back, submission and review`);
      if (type === 'chapter3') {
        assert.equal((await read(`students/${studentId}`)).passed3Chapter, true);
        // Two independent REST clients race the same student's slot. Exactly one wins.
        const candidates = ['A', 'B'].map((suffix) => ({ ...bookingInput, id: `${prefix}-RACE-${suffix}` }));
        for (const candidate of candidates) cleanup[`qeBookings/${candidate.id}`] = null;
        const baseUrl = rtdb.app.options.databaseURL;
        const race = await Promise.all(candidates.map((candidate) => fetch(`${baseUrl}/${RTDB_ROOT}.json`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ [`qeBookings/${candidate.id}`]: candidate, [`qeBookingSlots/${studentId}`]: candidate.id }),
        })));
        assert.deepEqual(race.map((response) => response.status).sort(), [200, 401]);
        const winner = candidates[race.findIndex((response) => response.status === 200)];
        assert.equal(await read(`qeBookingSlots/${studentId}`), winner.id);
        assert.equal(await read(`qeBookings/${candidates.find((candidate) => candidate.id !== winner.id).id}`), null);
        console.log('[PASS] independent concurrent clients: one booking accepted, one rejected by database slot validation');
        assert.equal(dbStore.getOpenQEBookingByStudent(studentId), undefined, 'reviewer cache has not seen the REST booking');
        const revokePayload = { [`students/${studentId}/passed3Chapter`]: false,
          [`projectDocuments/${id}`]: { ...(await read(`projectDocuments/${id}`)), status: 'rejected', reviewFeedback: 'Race test' } };
        await assert.rejects(update(ref(rtdb, RTDB_ROOT), revokePayload), /PERMISSION_DENIED/);
        assert.equal((await read(`students/${studentId}`)).passed3Chapter, true, 'stale revocation rejected atomically');
        await dbStore.reviewProjectDocument(id, 'rejected', teacher, 'Authoritative slot retry');
        assert.equal((await read(`qeBookings/${winner.id}`)).status, 'cancelled');
        await dbStore.reviewProjectDocument(id, 'approved', teacher);
        assert.equal((await read(`qeBookings/${winner.id}`)).status, 'cancelled');

        const revocationRaceId = `${prefix}-REVOCATION-RACE`;
        cleanup[`qeBookings/${revocationRaceId}`] = null;
        const concurrentPayloads = [
          { [`qeBookings/${revocationRaceId}`]: { ...bookingInput, id: revocationRaceId }, [`qeBookingSlots/${studentId}`]: revocationRaceId },
          revokePayload,
        ];
        const revocationRace = await Promise.all(concurrentPayloads.map((payload) => fetch(`${baseUrl}/${RTDB_ROOT}.json`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        })));
        assert.deepEqual(revocationRace.map((response) => response.status).sort(), [200, 401]);
        // Retry against the authoritative slot, regardless of which request won.
        await dbStore.reviewProjectDocument(id, 'rejected', teacher, 'Retry race safely');
        assert.equal((await read(`students/${studentId}`)).passed3Chapter, false);
        const raced = await read(`qeBookings/${revocationRaceId}`);
        assert.ok(raced === null || raced.status === 'cancelled');
        await dbStore.reviewProjectDocument(id, 'approved', teacher);
        assert.ok((await read(`qeBookings/${revocationRaceId}`))?.status !== 'pending');
        assert.equal(dbStore.getOpenQEBookingByStudent(studentId), undefined);
        console.log('[PASS] booking versus revocation race is serialized by rules; stale reviewer retries cancel authoritative booking; reapproval never revives it');
        const booking = await dbStore.createQEBooking(bookingInput);
        cleanup[`qeBookings/${booking.id}`] = null;
        assert.equal((await read(`qeBookings/${booking.id}`)).status, 'pending');
        await dbStore.reviewProjectDocument(id, 'rejected', teacher, 'Temporary revoke test');
        assert.equal((await read(`students/${studentId}`)).passed3Chapter, false);
        assert.equal((await read(`qeBookings/${booking.id}`)).status, 'cancelled');
        assert.equal(checkQEBookingPrerequisite(dbStore.getStudentById(studentId), 'SW', dbStore.getProjectDocuments(studentId)).canBook, false);
        await assert.rejects(dbStore.updateExaminerEvaluation(booking.id, scores), /ยกเลิก/);
        const staleId = `${prefix}-STALE`;
        cleanup[`qeBookings/${staleId}`] = null;
        await assert.rejects(update(ref(rtdb, RTDB_ROOT), { [`qeBookings/${staleId}`]: { ...bookingInput, id: staleId } }), /PERMISSION_DENIED/);
        assert.equal(await read(`qeBookings/${staleId}`), null);
        await dbStore.reviewProjectDocument(id, 'approved', teacher);
        await assert.rejects(update(ref(rtdb, RTDB_ROOT), { [`qeBookings/${booking.id}`]: booking }), /PERMISSION_DENIED/);
        assert.equal((await read(`qeBookings/${booking.id}`)).status, 'cancelled');
        const fresh = await dbStore.createQEBooking(bookingInput);
        cleanup[`qeBookings/${fresh.id}`] = null;
        const results = await Promise.all([dbStore.updateExaminerEvaluation(fresh.id, scores), dbStore.updateExaminerEvaluation(fresh.id, scores)]);
        const result = results[0];
        assert.equal(results[1].id, result.id);
        cleanup[`qeResults/${result.id}`] = null;
        const replay = { [`qeResults/${result.id}`]: result,
          [`qeBookings/${fresh.id}`]: { ...fresh, status: 'evaluated', resultId: result.id },
          [`students/${studentId}/passedQE`]: true };
        const evaluations = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/${RTDB_ROOT}.json`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(replay),
        })));
        assert.ok(evaluations.every((response) => response.status === 200));
        const duplicateResultId = `${prefix}-DUPLICATE-RESULT`;
        cleanup[`qeResults/${duplicateResultId}`] = null;
        await assert.rejects(update(ref(rtdb, RTDB_ROOT), {
          [`qeResults/${duplicateResultId}`]: { ...result, id: duplicateResultId },
          [`qeBookings/${fresh.id}/resultId`]: duplicateResultId,
        }), /PERMISSION_DENIED/);
        assert.equal(await read(`qeResults/${duplicateResultId}`), null);
        const savedResults = (await get(query(ref(rtdb, `${RTDB_ROOT}/qeResults`), orderByChild('bookingId'), equalTo(fresh.id)))).val();
        assert.deepEqual(Object.keys(savedResults), [result.id]);
        console.log('[PASS] concurrent evaluations/retries share one stable result; alternate result identity rejected');
        assert.equal((await read(`qeResults/${result.id}`)).finalResult, 'passed');
        assert.equal((await read(`qeBookings/${fresh.id}`)).status, 'evaluated');
        assert.equal((await read(`students/${studentId}`)).passedQE, true);
        console.log('[PASS] live QE booking, atomic revocation/cancellation, stale-write rule rejection, rebooking and atomic result');
      }
    }
  } finally {
    await update(ref(rtdb, RTDB_ROOT), cleanup);
    for (const path of Object.keys(cleanup)) assert.equal(await read(path), null, `cleanup ${path}`);
    console.log(`[PASS] removed and verified all ${Object.keys(cleanup).length} temporary paths (${prefix})`);
  }
  process.exit(0);
})().catch((error) => { console.error(error.message); process.exit(1); });
