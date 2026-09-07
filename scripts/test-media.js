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
  await assert.rejects(persistChanges({ 'projectDocuments/test/status': 'approved' }), /PERMISSION_DENIED/);
  console.log('[PASS] persistence failures propagate to document callers');

  const student = dbStore.getStudentById('STD-66122519020');
  const input = { id: 'TEST-DOC', studentId: student.id, studentCode: student.studentCode, studentUid: student.uid,
    studentNameTh: 'Test', projectTitle: 'Test', docType: 'proposal', fileName: 'test.pdf', fileSize: 20,
    fileRef: 'pdf://TEST-DOC', advisorId: 'T-108', advisorNameTh: 'Test' };
  await assert.rejects(dbStore.submitProjectDocument(input), /PERMISSION_DENIED/);
  assert.equal(dbStore.getProjectDocuments(student.id).length, 0);
  write = async () => {};
  await dbStore.submitProjectDocument(input);
  await dbStore.reviewProjectDocument(input.id, 'approved', dbStore.getTeacherById('T-108'));
  await dbStore.submitProjectDocument({ ...input, id: 'CH3', docType: 'chapter3' });
  write = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(dbStore.reviewProjectDocument('CH3', 'approved', dbStore.getTeacherById('T-108')), /PERMISSION_DENIED/);
  assert.equal(dbStore.getStudentById(student.id).passed3Chapter, false);
  assert.equal(dbStore.getLatestProjectDocument(student.id, 'chapter3').status, 'submitted');
  write = async () => {};
  await dbStore.reviewProjectDocument('CH3', 'approved', dbStore.getTeacherById('T-108'));
  assert.equal(lastChanges[`students/${student.id}/passed3Chapter`], true);
  assert.equal(lastChanges['projectDocuments/CH3'].status, 'approved');
  console.log('[PASS] chapter3 result and QE flag persist atomically; failed review never unlocks QE');

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
