// Exercise real media/store code with controlled Firebase SDK I/O (no live writes).
const assert = require('node:assert/strict');
const Module = require('module');
const originalLoad = Module._load;
let write = async () => {};
let storageCalls = 0;
let lastChanges;
Module._load = function (name, ...args) {
  const actual = originalLoad.call(this, name, ...args);
  if (name === 'firebase/database') return {
    ...actual,
    get: async () => ({ exists: () => false, val: () => null }), // no live slot reads
    set: (...args) => write(...args),
    update: (ref, changes) => { lastChanges = changes; return write(ref, changes); },
  };
  if (name === 'firebase/storage') return {
    ...actual,
    uploadString: () => { storageCalls++; throw new Error('Unprovisioned bucket'); },
  };
  return actual;
};
process.env.NEXT_PUBLIC_FIREBASE_USE_STORAGE = 'false';
const { uploadAvatar } = require('../src/lib/media/avatar.ts');
const { readPdfFile, PDF_MAX_FILE_BYTES } = require('../src/lib/media/pdf.ts');
const { dbStore } = require('../src/lib/firebase/db.ts');
const { persistChanges } = require('../src/lib/firebase/rtdb.ts');
// Browser FileReader boundary implemented using Node's real Blob bytes.
global.FileReader = class {
  readAsArrayBuffer(file) {
    file.arrayBuffer().then((bytes) => { this.result = bytes; this.onload(); }, () => this.onerror());
  }
};
(async () => {
  const photo = 'data:image/jpeg;base64,/9j/2Q==';
  for (const kind of ['students', 'teachers']) {
    const start = performance.now();
    const url = await uploadAvatar(kind, 'TEST', photo);
    assert.equal(url, `avatar://${kind}/TEST`);
    assert.ok(performance.now() - start < 1000, 'healthy upload must not wait for a retry timeout');
    console.log(`[PASS] ${kind}: healthy avatar acknowledged in ${Math.round(performance.now() - start)} ms`);
  }
  assert.equal(storageCalls, 0, 'default path must not contact unprovisioned Storage');
  write = () => new Promise(() => {});
  const slowStart = performance.now();
  assert.equal(await uploadAvatar('students', 'SLOW', photo), photo);
  assert.ok(performance.now() - slowStart < 3500);
  console.log('[PASS] stalled avatar falls back to durable inline JPEG within 3.5 seconds');
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  assert.equal(await uploadAvatar('teachers', 'DENIED', photo), photo);
  console.log('[PASS] denied avatar does not return a dangling reference');

  for (const [kind, id] of [['student', 'STD-66122519020'], ['teacher', 'T-108']]) {
    const get = () => kind === 'student' ? dbStore.getStudentById(id) : dbStore.getTeacherById(id);
    await assert.rejects(dbStore.saveProfile(kind, id, { firstNameTh: 'Not saved', profileCompleted: true }), /PERMISSION_DENIED/);
    assert.notEqual(get().firstNameTh, 'Not saved');
    let acknowledge;
    write = () => new Promise((resolve) => { acknowledge = resolve; });
    let finished = false;
    const saving = dbStore.saveProfile(kind, id, { firstNameTh: 'Saved', profileCompleted: true }).then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(finished, false);
    assert.notEqual(get().firstNameTh, 'Saved');
    acknowledge();
    await saving;
    assert.equal(get().firstNameTh, 'Saved');
    assert.equal(get().profileCompleted, true);
    console.log(`[PASS] ${kind} profile reports success only after primary DB acknowledgement; rejection preserves state`);
    write = async () => { throw new Error('PERMISSION_DENIED'); };
  }
  const profileId = 'STD-66122519020';
  const originalAdvisor = dbStore.getStudentById(profileId).advisorId;
  const coAdvisorUpdates = { coAdvisorId: 'T-101', coAdvisor2Id: 'CUSTOM-อ. ทดสอบ' };
  await assert.rejects(dbStore.saveProfile('student', profileId, coAdvisorUpdates), /PERMISSION_DENIED/);
  assert.equal(dbStore.getStudentById(profileId).coAdvisor2Id, undefined);
  let acknowledgeCoAdvisors;
  write = () => new Promise((resolve) => { acknowledgeCoAdvisors = resolve; });
  const coAdvisorSave = dbStore.saveProfile('student', profileId, coAdvisorUpdates);
  assert.equal(dbStore.getStudentById(profileId).coAdvisor2Id, undefined, 'co-advisors are not published optimistically');
  assert.deepEqual(lastChanges, {
    [`students/${profileId}/coAdvisorId`]: 'T-101',
    [`students/${profileId}/coAdvisor2Id`]: 'CUSTOM-อ. ทดสอบ',
  });
  acknowledgeCoAdvisors(); await coAdvisorSave;
  assert.equal(dbStore.getStudentById(profileId).coAdvisorId, 'T-101');
  assert.equal(dbStore.getStudentById(profileId).coAdvisor2Id, 'CUSTOM-อ. ทดสอบ');
  write = async () => {};
  await dbStore.saveProfile('student', profileId, { coAdvisorId: '', coAdvisor2Id: '' });
  assert.deepEqual(lastChanges, { [`students/${profileId}/coAdvisorId`]: '', [`students/${profileId}/coAdvisor2Id`]: '' });
  assert.equal(dbStore.getStudentById(profileId).coAdvisorId, '');
  assert.equal(dbStore.getStudentById(profileId).coAdvisor2Id, '');
  assert.equal(dbStore.getStudentById(profileId).advisorId, originalAdvisor);
  console.log('[PASS] optional co-advisors use acknowledged partial writes; rejection preserves state and empty values clear both without changing primary advisor');
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(persistChanges({ 'projectDocuments/test/status': 'approved' }), /PERMISSION_DENIED/);
  console.log('[PASS] persistence failures propagate to document callers');

  const student = dbStore.getStudentById('STD-66122519020');
  const input = { id: 'TEST-DOC', studentId: student.id, studentCode: student.studentCode, studentUid: student.uid,
    studentNameTh: 'Test', projectTitle: 'Test', docType: 'proposal', fileName: 'test.pdf', fileSize: 20,
    fileRef: 'pdf://TEST-DOC', advisorId: 'T-108', advisorNameTh: 'Test' };
  const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}`;
  await assert.rejects(dbStore.submitProjectDocument(input), /ไฟล์ PDF/);
  await assert.rejects(dbStore.submitProjectDocument(input, pdf), /PERMISSION_DENIED/);
  assert.equal(dbStore.getProjectDocuments(student.id).length, 0);
  assert.deepEqual(Object.keys(lastChanges).sort(), ['documentFiles/TEST-DOC', 'documentSlots/GROUP-STD-66122519020_proposal', 'projectDocuments/TEST-DOC', 'projectGroups/GROUP-STD-66122519020', 'projectMemberships/STD-66122519020']);
  assert.deepEqual(lastChanges['projectGroups/GROUP-STD-66122519020'], { id: 'GROUP-STD-66122519020', memberKey: student.id, members: { [student.id]: true } });
  assert.equal(lastChanges['projectMemberships/STD-66122519020'], 'GROUP-STD-66122519020');
  assert.equal(lastChanges['documentSlots/GROUP-STD-66122519020_proposal'], input.id);
  assert.equal(lastChanges['documentFiles/TEST-DOC'], pdf);
  let acknowledgeDocument;
  write = () => new Promise((resolve) => { acknowledgeDocument = resolve; });
  const submission = dbStore.submitProjectDocument(input, pdf);
  assert.equal(dbStore.getProjectDocuments(student.id).length, 0);
  acknowledgeDocument();
  const submitted = await submission;
  write = async () => {};
  assert.deepEqual(await dbStore.submitProjectDocument(input, pdf), submitted);
  assert.equal(dbStore.getProjectDocuments(student.id).length, 1, 'same-id retry does not add a version');
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(dbStore.withdrawProjectDocument(input.id), /PERMISSION_DENIED/);
  assert.equal(dbStore.getProjectDocuments(student.id).length, 1);
  assert.deepEqual(lastChanges, { 'projectDocuments/TEST-DOC': null, 'documentFiles/TEST-DOC': null, 'documentSlots/GROUP-STD-66122519020_proposal': null });
  write = async () => {};
  await dbStore.withdrawProjectDocument(input.id);
  assert.equal(dbStore.getProjectDocuments(student.id).length, 0);
  await dbStore.submitProjectDocument(input, pdf);
  console.log('[PASS] PDF metadata/bytes submit and withdraw atomically; denied/pending writes preserve state; same-id retry is idempotent');
  await dbStore.reviewProjectDocument(input.id, 'approved', dbStore.getTeacherById('T-108'));
  await dbStore.submitProjectDocument({ ...input, id: 'CH3', fileRef: 'pdf://CH3', docType: 'chapter3' }, pdf);
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(dbStore.reviewProjectDocument('CH3', 'approved', dbStore.getTeacherById('T-108')), /PERMISSION_DENIED/);
  assert.equal(dbStore.getStudentById(student.id).passed3Chapter, false);
  assert.equal(dbStore.getLatestProjectDocument(student.id, 'chapter3').status, 'submitted');
  write = async () => {};
  await dbStore.reviewProjectDocument('CH3', 'approved', dbStore.getTeacherById('T-108'));
  assert.equal(lastChanges[`students/${student.id}/passed3Chapter`], true);
  assert.equal(lastChanges['projectDocuments/CH3'].status, 'approved');
  console.log('[PASS] chapter3 result and QE flag persist atomically; failed review never unlocks QE');

  const bookingInput = { studentId: student.id, studentUid: student.uid, studentCode: student.studentCode,
    studentNameTh: 'Test', trackId: 'SW', roundId: 'TEST-ROUND', roundName: 'Test', examDate: '2026-09-10',
    timeSlot: '09:00 - 10:30', room: 'Test', status: 'pending', examinerIds: ['A', 'B', 'C'],
    examinerNames: ['A', 'B', 'C'], prerequisitePassed: true, submissionDate: '2026-09-07' };
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(dbStore.createQEBooking(bookingInput), /PERMISSION_DENIED/);
  assert.equal(dbStore.getQEBookingsByStudent(student.id).length, 0);
  let acknowledgeBooking;
  write = () => new Promise((resolve) => { acknowledgeBooking = resolve; });
  const bookingSave = dbStore.createQEBooking(bookingInput);
  assert.equal(dbStore.getQEBookingsByStudent(student.id).length, 0);
  acknowledgeBooking();
  const booking = await bookingSave;
  const scores = ['A', 'B', 'C'].map((id) => ({ examinerId: id, examinerName: id, score: 80,
    isPass: true, comments: '', evaluatedAt: '', signatureStatus: true }));
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(dbStore.updateExaminerEvaluation(booking.id, scores), /PERMISSION_DENIED/);
  assert.equal(dbStore.getQEResultByStudent(student.id), undefined);
  assert.equal(dbStore.getOpenQEBookingByStudent(student.id).status, 'pending');
  assert.equal(dbStore.getStudentById(student.id).passedQE, false);
  await assert.rejects(dbStore.reviewProjectDocument('CH3', 'rejected', dbStore.getTeacherById('T-108'), 'Revoke'), /PERMISSION_DENIED/);
  assert.equal(dbStore.getStudentById(student.id).passed3Chapter, true);
  assert.equal(dbStore.getOpenQEBookingByStudent(student.id).status, 'pending');
  write = async () => {};
  await dbStore.reviewProjectDocument('CH3', 'rejected', dbStore.getTeacherById('T-108'), 'Revoke');
  assert.equal(lastChanges[`qeBookings/${booking.id}`].status, 'cancelled');
  assert.equal(lastChanges[`students/${student.id}/passed3Chapter`], false);
  await assert.rejects(dbStore.updateExaminerEvaluation(booking.id, scores), /ยกเลิก/);
  await assert.rejects(dbStore.createQEBooking(bookingInput), /สอบ 3 บท/);
  await dbStore.reviewProjectDocument('CH3', 'approved', dbStore.getTeacherById('T-108'));
  await assert.rejects(dbStore.updateExaminerEvaluation(booking.id, scores), /ยกเลิก/);
  const freshBooking = await dbStore.createQEBooking(bookingInput);
  let acknowledgeResult;
  write = () => new Promise((resolve) => { acknowledgeResult = resolve; });
  const evaluationSave = dbStore.updateExaminerEvaluation(freshBooking.id, scores);
  assert.equal(dbStore.getQEResultByStudent(student.id), undefined);
  assert.equal(dbStore.getStudentById(student.id).passedQE, false);
  assert.equal(lastChanges[`qeBookings/${freshBooking.id}`].status, 'evaluated');
  assert.equal(lastChanges[`students/${student.id}/passedQE`], true);
  assert.equal(Object.keys(lastChanges).length, 3);
  acknowledgeResult();
  const result = await evaluationSave;
  assert.equal(dbStore.getQEResultByStudent(student.id).id, result.id);
  assert.equal(dbStore.getStudentById(student.id).passedQE, true);
  console.log('[PASS] QE booking/result wait for acknowledgement; revoke atomically cancels bookings and cancelled bookings cannot be evaluated after reapproval');

  write = () => new Promise(() => {});
  const timeoutStart = performance.now();
  await assert.rejects(persistChanges({ 'projectDocuments/timeout': {} }), { code: 'WRITE_UNCONFIRMED' });
  assert.ok(performance.now() - timeoutStart >= 14000, 'real persistence timeout exercised');
  console.log('[PASS] stalled writes report WRITE_UNCONFIRMED, never success');

  const valid = new File(['%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'], 'proposal.pdf', { type: 'application/pdf' });
  const prepared = await readPdfFile(valid);
  assert.equal(prepared.fileName, valid.name);
  assert.equal(Buffer.from(prepared.dataUrl.split(',')[1], 'base64').toString(), await valid.text());
  for (const file of [
    new File(['hello'], 'fake.pdf', { type: 'application/pdf' }),
    new File(['%PDF-1.7'], 'notes.txt', { type: 'text/plain' }),
    new File([], 'empty.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(PDF_MAX_FILE_BYTES + 1)], 'big.pdf', { type: 'application/pdf' }),
  ]) await assert.rejects(readPdfFile(file));
  console.log('[PASS] actual PDF reader preserves bytes and rejects disguised, empty, oversized and non-PDF files');
  console.log('=== ALL MEDIA / PERSISTENCE TESTS PASSED (controlled SDK I/O, no live writes) ===');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
