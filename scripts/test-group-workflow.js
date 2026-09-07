// Real store, media readers and rendered document UI. Only Firebase network I/O is controlled.
// No calls/writes to the live database. Run via npm run test:documents.
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let cloud = {};
let mode = 'ack';
let acknowledge;
let lastChanges;
const at = (path) => path.split('/').reduce((node, key) => node?.[key], cloud);
const apply = (changes) => {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split('/'); let node = cloud;
    for (const key of parts.slice(0, -1)) node = node[key] ||= {};
    if (value === null) delete node[parts.at(-1)]; else node[parts.at(-1)] = structuredClone(value);
  }
};
Module._load = function(name, ...args) {
  const actual = originalLoad.call(this, name, ...args);
  if (name !== 'firebase/database') return actual;
  return { ...actual,
    set: async () => {},
    get: async (reference) => {
      const value = at(reference.toString().split('/ssru_ce/')[1]);
      return { exists: () => value !== undefined, val: () => structuredClone(value) };
    },
    update: (_ref, changes) => {
      lastChanges = structuredClone(changes);
      if (mode === 'deny') return Promise.reject(new Error('PERMISSION_DENIED'));
      if (mode === 'defer') return new Promise((resolve) => { acknowledge = () => { apply(changes); resolve(); }; });
      apply(changes); return Promise.resolve();
    },
  };
};
global.FileReader = class {
  readAsArrayBuffer(file) { file.arrayBuffer().then((bytes) => { this.result = bytes; this.onload(); }, () => this.onerror()); }
};
const { dbStore } = require('../src/lib/firebase/db.ts');
const { readReviewAttachment, validateReviewAttachment, loadReviewAttachment } = require('../src/lib/media/reviewAttachment.ts');
const { checkQEBookingPrerequisite, isProjectAdvisor } = require('../src/lib/rules/engine.ts');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Manager = require('../src/components/ProjectDocumentsManager.tsx').default;
const render = (id, role = 'student', teacher) => renderToStaticMarkup(React.createElement(Manager, {
  student: dbStore.getStudentById(id), role, currentTeacher: teacher, isOpen: true, onClose() {},
}));
const students = ['66122519070', '66122519071', '66122519072'].map((code) => dbStore.getStudentById(code));
const [a, b, outsider] = students;
const teachers = dbStore.getTeachers();
const teacher = teachers[3];
const log = (message) => console.log(`[PASS] ${message}`);
const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}`;
const input = (owner, type, id = dbStore.newProjectDocumentId(type)) => ({
  id, studentId: owner.id, studentCode: owner.studentCode, studentUid: owner.uid,
  studentNameTh: `${owner.firstNameTh} ${owner.lastNameTh}`, projectTitle: 'Group project', docType: type,
  fileName: `${type}.pdf`, fileSize: 14, fileRef: `pdf://${id}`, advisorId: teacher.id, advisorNameTh: 'Advisor',
});
(async () => {
  await dbStore.saveProfile('student', b.id, { advisorId: teachers[0].id, coAdvisor3Id: teacher.id });
  assert.ok(isProjectAdvisor(dbStore.getStudentById(b.id), teacher.id));
  mode = 'deny';
  await assert.rejects(dbStore.saveProfile('student', b.id, { coAdvisor3Id: '' }), /PERMISSION_DENIED/);
  assert.equal(dbStore.getStudentById(b.id).coAdvisor3Id, teacher.id);
  mode = 'defer';
  const clear = dbStore.saveProfile('student', b.id, { coAdvisor3Id: '' });
  assert.equal(dbStore.getStudentById(b.id).coAdvisor3Id, teacher.id);
  acknowledge(); await clear;
  assert.equal(dbStore.getStudentById(b.id).coAdvisor3Id, '');
  mode = 'ack';
  await dbStore.saveProfile('student', b.id, { coAdvisor3Id: teacher.id });
  log('third co-advisor saves/clears only after acknowledgement; denied write preserves assignment');

  for (const codes of [[a.studentCode, '99999999999'], [a.studentCode, a.studentCode], [b.studentCode]]) {
    await assert.rejects(dbStore.submitProjectDocument(input(a, 'proposal'), pdf, codes));
  }
  dbStore.updateStudentProfile(b.id, { status: 'suspended' });
  await assert.rejects(dbStore.submitProjectDocument(input(a, 'proposal'), pdf, [a.studentCode, b.studentCode]), /สถานะ/);
  dbStore.updateStudentProfile(b.id, { status: 'active' });
  assert.equal(dbStore.getProjectDocuments(a.id).length, 0);
  const firstInput = input(a, 'proposal');
  mode = 'deny';
  await assert.rejects(dbStore.submitProjectDocument(firstInput, pdf, [a.studentCode, b.studentCode]), /PERMISSION_DENIED/);
  assert.equal(dbStore.getProjectGroup(a.id), undefined);
  mode = 'defer';
  const first = dbStore.submitProjectDocument(firstInput, pdf, [a.studentCode, b.studentCode]);
  await assert.rejects(dbStore.submitProjectDocument(input(b, 'proposal'), pdf, [b.studentCode, a.studentCode]), /กำลังบันทึก/);
  assert.equal(dbStore.getProjectDocuments(b.id).length, 0);
  acknowledge(); const p1 = await first;
  mode = 'ack';
  assert.equal(dbStore.getProjectDocuments(b.studentCode)[0].id, p1.id);
  assert.equal(dbStore.getProjectDocuments(outsider.id).length, 0);
  assert.equal(at(`projectMemberships/${b.id}`), p1.groupId);
  assert.equal(at(`documentSlots/${p1.groupId}_proposal`), p1.id);
  assert.equal(dbStore.getPendingProjectDocuments(teacher.id).filter((d) => d.id === p1.id).length, 1);
  assert.ok(!render(b.id, 'teacher', teacher).includes('ท่านไม่ได้เป็นอาจารย์ที่ปรึกษา'));
  await assert.rejects(dbStore.submitProjectDocument(input(b, 'proposal'), pdf), /รออาจารย์/);
  await assert.rejects(dbStore.submitProjectDocument(input(outsider, 'proposal'), pdf, [outsider.studentCode, a.studentCode]), /กลุ่ม/);
  log('group membership/slot/PDF commit atomically; either member sees one queue entry, unrelated students cannot claim it');

  const pdfFile = new File(['%PDF-1.4\n%%EOF'], 'feedback.pdf', { type: 'application/pdf' });
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5aUAAAAASUVORK5CYII=', 'base64');
  const attachments = await Promise.all([
    readReviewAttachment(pdfFile, 'pdf'), readReviewAttachment(new File([pngBytes], 'diagram.png', { type: 'image/png' }), 'png'),
  ]);
  for (const file of attachments) validateReviewAttachment(file);
  for (const file of [new File(['<svg/>'], 'x.svg'), new File(['html'], 'fake.png'), new File([], 'empty.jpg'), new File([new Uint8Array(5242881)], 'big.png')]) await assert.rejects(readReviewAttachment(file, 'bad'));
  assert.throws(() => validateReviewAttachment({ ...attachments[1], mimeType: 'text/html' }));
  const feedback = ('แก้ไขรายละเอียดบทที่ 2 พร้อมภาพประกอบ\n' + 'longword'.repeat(40) + '\n').repeat(120);
  mode = 'deny';
  await assert.rejects(dbStore.reviewProjectDocument(p1.id, 'rejected', teacher, feedback, attachments), /PERMISSION_DENIED/);
  assert.equal(dbStore.getLatestProjectDocument(b.id, 'proposal').status, 'submitted');
  assert.equal(at(`reviewFiles/${p1.id}`), undefined);
  mode = 'defer';
  const review = dbStore.reviewProjectDocument(p1.id, 'rejected', teacher, feedback, attachments);
  assert.equal(dbStore.getLatestProjectDocument(b.id, 'proposal').status, 'submitted');
  acknowledge(); await review; mode = 'ack';
  assert.equal(dbStore.getLatestProjectDocument(b.id, 'proposal').reviewFeedback, feedback.trim());
  assert.equal(at(`reviewFiles/${p1.id}/pdf`), attachments[0].dataUrl);
  assert.ok(!JSON.stringify(at(`projectDocuments/${p1.id}`)).includes('base64'));
  for (const attachment of attachments) assert.equal(await loadReviewAttachment(p1.id, attachment), attachment.dataUrl);
  assert.ok(render(b.id).includes('feedback.pdf') && render(b.id).includes('diagram.png'));
  log('long multiline feedback + genuine PDF/PNG round-trip without truncation; files fetch on demand and rejected/pending writes publish nothing');

  for (const type of ['proposal', 'chapter3', 'chapter5']) {
    let last;
    for (let revision = type === 'proposal' ? 1 : 0; revision < 3; revision++) {
      const owner = revision % 2 ? b : a;
      last = await dbStore.submitProjectDocument(input(owner, type), pdf);
      assert.equal(last.version, revision + 1);
      assert.equal(dbStore.getLatestProjectDocument(a.id, type).id, last.id);
      assert.equal(dbStore.getLatestProjectDocument(b.id, type).id, last.id);
      if (revision < 2) await dbStore.reviewProjectDocument(last.id, 'rejected', teacher, `แก้ไขครั้งที่ ${revision + 1}`, attachments);
    }
    await dbStore.reviewProjectDocument(last.id, 'approved', teacher, 'ผ่าน');
    const documents = dbStore.getProjectDocuments(b.id).filter((d) => d.docType === type);
    assert.equal(documents.length, 3);
    assert.equal(documents.filter((d) => d.status === 'approved').length, 1);
    assert.equal(dbStore.getPendingProjectDocuments(teacher.id).filter((d) => d.docType === type && d.groupId === last.groupId).length, 0);
    assert.ok(render(b.id).includes('แก้ไขครั้งที่ 2'));
    if (type === 'chapter3') for (const member of [a, b]) {
      assert.equal(dbStore.getStudentById(member.id).passed3Chapter, true);
      assert.equal(at(`students/${member.id}/passed3Chapter`), true);
      assert.ok(checkQEBookingPrerequisite(dbStore.getStudentById(member.id), 'SW', dbStore.getProjectDocuments(member.id)).canBook);
    }
    if (type === 'chapter5') for (const member of [a, b]) assert.equal(dbStore.getStudentById(member.id).passed5Chapter, true);
    log(`${type}: alternating members submit revisions 0/1/2, one approval applies to both, history remains intact`);
  }
  assert.equal(dbStore.getProjectDocuments(a.id).find((d) => d.id === p1.id).reviewFeedback, feedback.trim());
  const chapter3 = dbStore.getLatestProjectDocument(a.id, 'chapter3');
  const track = dbStore.getTracks().find((t) => t.id === 'SW');
  for (const member of [a, b]) await dbStore.createQEBooking({
    studentId: member.id, studentUid: member.uid, studentCode: member.studentCode, studentNameTh: 'Test',
    trackId: 'SW', roundId: 'R', roundName: 'R', examDate: '2026-09-10', timeSlot: '09:00', room: 'Test',
    status: 'pending', examinerIds: track.examinersDefault, examinerNames: ['a','b','c'], prerequisitePassed: true, submissionDate: '2026-09-07',
  });
  await dbStore.reviewProjectDocument(chapter3.id, 'rejected', teacher, 'เพิกถอนผลกลุ่ม');
  for (const member of [a, b]) {
    assert.equal(dbStore.getStudentById(member.id).passed3Chapter, false);
    assert.equal(dbStore.getOpenQEBookingByStudent(member.id), undefined);
    assert.equal(at(`students/${member.id}/passed3Chapter`), false);
  }
  await assert.rejects(dbStore.submitProjectDocument(input(b, 'chapter3'), pdf, [b.studentCode]), /สมาชิก/);
  log('group revocation atomically clears both eligibility flags and cancels both individual QE bookings; roster stays frozen');
  console.log('=== ALL GROUP / FEEDBACK TESTS PASSED (controlled Firebase transport, no live writes) ===');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
