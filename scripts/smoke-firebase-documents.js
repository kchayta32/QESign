// Opt-in live integration check. Writes ONLY uniquely prefixed synthetic records,
// then removes every created path and verifies cleanup. Never edits a roster account.
// Usage: node -r ./scripts/register-ts.js scripts/smoke-firebase-documents.js --confirm-live
if (!process.argv.includes('--confirm-live')) throw new Error('Requires --confirm-live');
const assert = require('node:assert/strict');
const { get, ref, update } = require('firebase/database');
const { rtdb } = require('../src/lib/firebase/config.ts');
const { RTDB_ROOT, persistChanges } = require('../src/lib/firebase/rtdb.ts');
const { dbStore } = require('../src/lib/firebase/db.ts');
const { uploadAvatar } = require('../src/lib/media/avatar.ts');
const { uploadPdfDocument, resolvePdfDocument } = require('../src/lib/media/pdf.ts');
const { checkQEBookingPrerequisite } = require('../src/lib/rules/engine.ts');
const prefix = `DUO-VERIFY-${Date.now()}`;
const studentId = `${prefix}-STUDENT`;
const teacherId = `${prefix}-TEACHER`;
const types = ['proposal', 'chapter3', 'chapter5'];
const cleanup = {
  [`students/${studentId}`]: null, [`teachers/${teacherId}`]: null,
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
    for (const type of types) {
      const id = `${prefix}-${type}`;
      const fileRef = await uploadPdfDocument(id, pdf);
      assert.equal(await read(`documentFiles/${id}`), pdf);
      assert.equal(await resolvePdfDocument(fileRef), pdf);
      await dbStore.submitProjectDocument({ id, studentId, studentUid: studentId, studentCode: prefix,
        studentNameTh: 'Duo verification', projectTitle: 'Temporary integration check', docType: type,
        fileName: `${type}.pdf`, fileSize: 60, fileRef, advisorId: teacherId, advisorNameTh: 'Duo verification' });
      assert.equal((await read(`projectDocuments/${id}`)).status, 'submitted');
      await dbStore.reviewProjectDocument(id, 'approved', teacher);
      assert.equal((await read(`projectDocuments/${id}`)).status, 'approved');
      console.log(`[PASS] live ${type} PDF upload, read-back, submission and review`);
      if (type === 'chapter3') {
        assert.equal((await read(`students/${studentId}`)).passed3Chapter, true);
        await dbStore.reviewProjectDocument(id, 'rejected', teacher, 'Temporary revoke test');
        assert.equal((await read(`students/${studentId}`)).passed3Chapter, false);
        assert.equal(checkQEBookingPrerequisite(dbStore.getStudentById(studentId), 'SW', dbStore.getProjectDocuments(studentId)).canBook, false);
        await dbStore.reviewProjectDocument(id, 'approved', teacher);
        console.log('[PASS] live chapter3 approval/revocation updates QE prerequisite');
      }
    }
  } finally {
    await update(ref(rtdb, RTDB_ROOT), cleanup);
    for (const path of Object.keys(cleanup)) assert.equal(await read(path), null, `cleanup ${path}`);
    console.log(`[PASS] removed and verified all ${Object.keys(cleanup).length} temporary paths (${prefix})`);
  }
  process.exit(0);
})().catch((error) => { console.error(error.message); process.exit(1); });
