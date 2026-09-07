// Real store/subscription/persistence code with Firebase's optimistic callback ordering.
// SDK network I/O only is controlled. No cloud writes or browser globals.
const assert = require('node:assert/strict');
const Module = require('node:module');
const load = Module._load;
const snapshots = {};
const callbacks = new Map();
let mode = 'ack';
let settle;
const emit = (name) => {
  const value = structuredClone(snapshots[name] || null);
  callbacks.get(name)?.({ exists: () => value !== null, val: () => value });
};
Module._load = function (name, ...args) {
  const actual = load.call(this, name, ...args);
  if (name !== 'firebase/database') return actual;
  return { ...actual,
    onValue: (reference, callback) => {
      const name = reference.key;
      callbacks.set(name, callback); emit(name);
      return () => callbacks.delete(name);
    },
    set: async () => {},
    update: (_reference, changes) => {
      const before = structuredClone(snapshots);
      const collections = new Set();
      for (const [path, value] of Object.entries(changes)) {
        const [collection, id, field] = path.split('/');
        collections.add(collection);
        snapshots[collection] ||= {};
        if (field) snapshots[collection][id] = { ...snapshots[collection][id], [field]: value };
        else if (value === null) delete snapshots[collection][id];
        else snapshots[collection][id] = structuredClone(value);
      }
      collections.forEach(emit); // synchronous optimistic callbacks before acknowledgement
      if (mode === 'ack') return Promise.resolve();
      return new Promise((resolve, reject) => {
        settle = (accept) => {
          if (!accept) for (const name of collections) snapshots[name] = before[name];
          collections.forEach(emit); // rollback/committed snapshot before promise settles
          accept ? resolve() : reject(new Error('PERMISSION_DENIED'));
        };
      });
    },
  };
};
const { dbStore } = require('../src/lib/firebase/db.ts');
const { toKeyedMap } = require('../src/lib/firebase/rtdb.ts');
(async () => {
  snapshots.students = toKeyedMap(dbStore.getStudents());
  snapshots.teachers = toKeyedMap(dbStore.getTeachers());
  // Exercise the store's real listener initialization, normally called by its browser constructor.
  dbStore.initRealtimeListeners();
  const student = dbStore.getStudentById('STD-66122519020');
  const teacher = dbStore.getTeacherById('T-108');
  const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}`;
  const input = { id: 'REALTIME-P', studentId: student.id, studentUid: student.uid, studentCode: student.studentCode,
    studentNameTh: 'Test', projectTitle: 'Test', docType: 'proposal', fileName: 'test.pdf', fileSize: 14,
    fileRef: 'pdf://REALTIME-P', advisorId: teacher.id, advisorNameTh: 'Test' };
  await dbStore.submitProjectDocument(input, pdf);
  await dbStore.reviewProjectDocument(input.id, 'approved', teacher);
  await dbStore.submitProjectDocument({ ...input, id: 'REALTIME-C3', fileRef: 'pdf://REALTIME-C3', docType: 'chapter3' }, pdf);
  const status = () => dbStore.getLatestProjectDocument(student.id, 'chapter3').status;
  const passed = () => dbStore.getStudentById(student.id).passed3Chapter;
  const observed = [];
  dbStore.subscribe(() => observed.push({ status: status(), passed: passed() }));
  mode = 'defer';
  const denied = dbStore.reviewProjectDocument('REALTIME-C3', 'approved', teacher);
  const deniedAssertion = assert.rejects(denied, /PERMISSION_DENIED/);
  assert.equal(status(), 'submitted'); assert.equal(passed(), false);
  assert.ok(observed.every((s) => s.status === 'submitted' && !s.passed));
  settle(false); await deniedAssertion;
  assert.equal(status(), 'submitted'); assert.equal(passed(), false);
  console.log('[PASS] real realtime callbacks do not publish optimistic approval/eligibility; rejection rolls back and propagates');

  const timed = dbStore.reviewProjectDocument('REALTIME-C3', 'approved', teacher);
  await assert.rejects(timed, { code: 'WRITE_UNCONFIRMED' });
  assert.equal(status(), 'submitted'); assert.equal(passed(), false);
  settle(true); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(status(), 'approved'); assert.equal(passed(), true);
  console.log('[PASS] timed-out optimistic snapshots remain unconfirmed until the actual late acknowledgement');

  const bookingInput = { studentId: student.id, studentUid: student.uid, studentCode: student.studentCode,
    studentNameTh: 'Test', trackId: 'SW', roundId: 'TEST', roundName: 'Test', examDate: '2026-09-10',
    timeSlot: '09:00', room: 'Test', status: 'pending', examinerIds: ['A', 'B', 'C'], examinerNames: ['A', 'B', 'C'],
    prerequisitePassed: true, submissionDate: '2026-09-07' };
  const first = dbStore.createQEBooking(bookingInput);
  await assert.rejects(dbStore.createQEBooking(bookingInput), /กำลังบันทึก/);
  assert.equal(dbStore.getOpenQEBookingByStudent(student.id), undefined);
  settle(true); const booking = await first;
  mode = 'ack';
  const scores = ['A', 'B', 'C'].map((id) => ({ examinerId: id, examinerName: id, score: 80,
    isPass: true, comments: '', evaluatedAt: '', signatureStatus: true }));
  const results = await Promise.all([dbStore.updateExaminerEvaluation(booking.id, scores), dbStore.updateExaminerEvaluation(booking.id, scores)]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(Object.keys(snapshots.qeResults).length, 1);
  assert.equal(snapshots.qeBookings[booking.id].resultId, results[0].id);
  assert.equal(snapshots.qeBookingSlots[student.id], booking.id);
  console.log('[PASS] concurrent store booking is rejected and concurrent evaluation uses one stable result identity');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
