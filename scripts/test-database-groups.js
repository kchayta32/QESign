// Integration against the real RTDB emulator. No live database access permitted.
// JAVA emulator must already be listening on 127.0.0.1:9000 with database.rules.json loaded.
const assert = require('node:assert/strict');
const { connectDatabaseEmulator, ref, set, update, get } = require('firebase/database');
const { rtdb } = require('../src/lib/firebase/config.ts');
connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
const { dbStore } = require('../src/lib/firebase/db.ts');
const root = ref(rtdb, 'ssru_ce');
const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}`;
const a = dbStore.getStudentById('66122519070');
const b = dbStore.getStudentById('66122519071');
const teacher = dbStore.getTeachers()[0];
const input = (type, id) => ({ id, studentId: a.id, studentCode: a.studentCode, studentUid: a.uid, studentNameTh: 'Test',
  projectTitle: 'Test', docType: type, fileName: 'test.pdf', fileSize: 14, fileRef: `pdf://${id}`, advisorId: teacher.id, advisorNameTh: 'Test' });
const attachment = { id: 'pdf', fileName: 'feedback.pdf', fileSize: 14, mimeType: 'application/pdf', dataUrl: pdf };
(async () => {
  await set(root, { students: { [a.id]: a, [b.id]: b } });
  const p1 = await dbStore.submitProjectDocument(input('proposal', 'EMU-P1'), pdf, [a.studentCode, b.studentCode]);
  const group = dbStore.getProjectGroup(a.id);
  assert.equal((await get(ref(rtdb, `ssru_ce/projectMemberships/${b.id}`))).val(), group.id);
  await assert.rejects(update(root, { [`projectGroups/${group.id}/memberKey`]: 'different' }), /PERMISSION_DENIED/);
  await assert.rejects(update(root, { [`projectMemberships/${b.id}`]: 'different-group' }), /PERMISSION_DENIED/);
  const reviewed = { ...p1, status: 'rejected', reviewAttachments: [{ ...attachment, dataUrl: undefined }] };
  delete reviewed.reviewAttachments[0].dataUrl;
  await assert.rejects(update(root, { [`projectDocuments/${p1.id}`]: reviewed }), /PERMISSION_DENIED/);
  assert.equal((await get(ref(rtdb, `ssru_ce/projectDocuments/${p1.id}/status`))).val(), 'submitted');
  await dbStore.reviewProjectDocument(p1.id, 'rejected', teacher, 'แก้ไข\n'.repeat(10000), [attachment]);
  assert.equal((await get(ref(rtdb, `ssru_ce/reviewFiles/${p1.id}/pdf`))).val(), pdf);
  console.log('[PASS] emulator accepts atomic group + review/files; rejects changed membership and missing review bytes');
  const correction = (id) => ({ ...p1, id, version: 2, fileRef: `pdf://${id}`, studentId: b.id, studentCode: b.studentCode, studentUid: b.uid });
  const write = (doc) => update(root, {
    [`projectDocuments/${doc.id}`]: doc, [`documentFiles/${doc.id}`]: pdf,
    [`documentSlots/${group.id}_proposal`]: doc.id,
  });
  const contenders = [correction('EMU-P2-A'), correction('EMU-P2-B')];
  const results = await Promise.allSettled(contenders.map(write));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const saved = (await get(ref(rtdb, 'ssru_ce/projectDocuments'))).val();
  assert.equal(Object.values(saved).filter((d) => d.version === 2).length, 1);
  const winner = contenders[results.findIndex((r) => r.status === 'fulfilled')];
  const loser = contenders[results.findIndex((r) => r.status === 'rejected')];
  assert.equal((await get(ref(rtdb, `ssru_ce/documentFiles/${loser.id}`))).exists(), false);
  // Reconcile the actual committed snapshot before the next real-store operation.
  dbStore.projectDocuments = Object.values(saved);
  await dbStore.reviewProjectDocument(winner.id, 'approved', teacher, 'ผ่าน');
  const c3 = await dbStore.submitProjectDocument(input('chapter3', 'EMU-C3'), pdf);
  await dbStore.reviewProjectDocument(c3.id, 'approved', teacher, 'ผ่าน', [attachment]);
  for (const member of [a,b]) assert.equal((await get(ref(rtdb, `ssru_ce/students/${member.id}/passed3Chapter`))).val(), true);
  await dbStore.reviewProjectDocument(c3.id, 'rejected', teacher, 'เพิกถอน');
  for (const member of [a,b]) assert.equal((await get(ref(rtdb, `ssru_ce/students/${member.id}/passed3Chapter`))).val(), false);
  console.log('[PASS] emulator serializes competing group revisions without orphan files; approval/revocation updates both student flags');
  await set(root, null);
  console.log('=== RTDB EMULATOR GROUP CHECKS PASSED ===');
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
