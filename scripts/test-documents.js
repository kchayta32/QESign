// Verification of the project-document pipeline (Proposal → สอบ 3 บท → สอบ 5 บท) and the
// "3-chapter exam must be passed before QE booking" rule, against the real store + rules.
// Runs in Node with the cloud disabled (no writes to the live database).
// Usage: node -r ./scripts/register-ts.js scripts/test-documents.js
process.env.SSRU_DISABLE_CLOUD = "1";
const { dbStore } = require("../src/lib/firebase/db.ts");
const {
  checkQEBookingPrerequisite,
  checkDocumentSubmissionPrerequisite,
  hasPassed3ChapterExam,
  getLatestDocument,
  PROJECT_DOCUMENT_STAGES,
} = require("../src/lib/rules/engine.ts");
const { hasPdfSignature, formatFileSize, PDF_MAX_FILE_BYTES } = require("../src/lib/media/pdf.ts");

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${extra ? " -> " + extra : ""}`);
  if (!ok) failures++;
};

(async () => {
const advisor = dbStore.getTeacherById("kant.ch");
const otherTeacher = dbStore.getTeacherById("ravi.ut");
const student = dbStore.updateStudentProfile("STD-66122519010", {
  prefixTh: "นาย",
  firstNameTh: "ทดสอบ",
  lastNameTh: "เอกสาร",
  advisorId: advisor.id,
  profileCompleted: true,
});
const S = () => dbStore.getStudentById(student.id);
const docs = () => dbStore.getProjectDocuments(student.id);

async function submit(type, fileName = `${type}.pdf`) {
  const id = dbStore.newProjectDocumentId(type);
  return dbStore.submitProjectDocument({
    id,
    studentId: student.id,
    studentUid: student.uid,
    studentCode: student.studentCode,
    studentNameTh: "นายทดสอบ เอกสาร",
    projectTitle: "โครงงานทดสอบ",
    docType: type,
    fileName,
    fileSize: 1024,
    fileRef: `pdf://${id}`,
    advisorId: advisor.id,
    advisorNameTh: "อ.กานต์ เจริญจิตร",
  });
}

console.log("=== Project documents & 3-chapter → QE gate ===");

// Stage definitions
check("3 stages in order proposal → chapter3 → chapter5", PROJECT_DOCUMENT_STAGES.map((s) => s.type).join(",") === "proposal,chapter3,chapter5");
check("chapter3 requires proposal; chapter5 requires chapter3", PROJECT_DOCUMENT_STAGES[1].requires === "proposal" && PROJECT_DOCUMENT_STAGES[2].requires === "chapter3");

// Fresh student: nothing submitted
check("fresh student has no documents", docs().length === 0);
check("fresh student may submit proposal", checkDocumentSubmissionPrerequisite(S(), docs(), "proposal").canSubmit === true);
check("fresh student may NOT submit chapter3 (proposal first)", checkDocumentSubmissionPrerequisite(S(), docs(), "chapter3").canSubmit === false);
check("fresh student may NOT submit chapter5", checkDocumentSubmissionPrerequisite(S(), docs(), "chapter5").canSubmit === false);
const qe0 = checkQEBookingPrerequisite(S(), "SW", docs());
check("QE booking blocked before 3-chapter exam", qe0.canBook === false && /สอบ 3 บท/.test(qe0.reasonTh), qe0.reasonTh);

// Proposal
const p1 = await submit("proposal", "66122519010_Proposal.pdf");
check("proposal v1 recorded as submitted", p1.version === 1 && p1.status === "submitted" && !!p1.submittedAt);
check("cannot submit proposal again while pending", checkDocumentSubmissionPrerequisite(S(), docs(), "proposal").canSubmit === false);
check("pending list for advisor contains it", dbStore.getPendingProjectDocuments(advisor.id).some((d) => d.id === p1.id));
check("pending list for another advisor does not", !dbStore.getPendingProjectDocuments(otherTeacher.id).some((d) => d.id === p1.id));
await dbStore.reviewProjectDocument(p1.id, "approved", advisor, "หัวข้อเหมาะสม");
check("proposal approved with reviewer stamped", getLatestDocument(docs(), "proposal").status === "approved" && getLatestDocument(docs(), "proposal").reviewerId === advisor.id);
check("approving proposal does NOT pass the 3-chapter exam", S().passed3Chapter === false && !hasPassed3ChapterExam(S(), docs()));
check("chapter3 now open for submission", checkDocumentSubmissionPrerequisite(S(), docs(), "chapter3").canSubmit === true);

// Chapter 3: submitted → still blocked, rejected → resubmit, approved → QE unlocked
const c1 = await submit("chapter3", "66122519010_3บท.pdf");
const qe1 = checkQEBookingPrerequisite(S(), "SW", docs());
check("QE still blocked while chapter3 awaits review (hint mentions waiting)", qe1.canBook === false && /รออาจารย์/.test(qe1.reasonTh), qe1.reasonTh);
await dbStore.reviewProjectDocument(c1.id, "rejected", advisor, "แก้ไขบทที่ 2");
check("rejected chapter3 keeps passed3Chapter=false", S().passed3Chapter === false);
const qe2 = checkQEBookingPrerequisite(S(), "SW", docs());
check("QE blocked after rejection (hint says resubmit)", qe2.canBook === false && /ไม่ผ่าน/.test(qe2.reasonTh), qe2.reasonTh);
const pre2 = checkDocumentSubmissionPrerequisite(S(), docs(), "chapter3");
check("resubmission allowed after rejection (as v2)", pre2.canSubmit === true && /ฉบับที่ 2/.test(pre2.reasonTh), pre2.reasonTh);
const c2 = await submit("chapter3", "66122519010_3บท_v2.pdf");
check("chapter3 v2 assigned version 2", c2.version === 2);
check("latest chapter3 is v2", getLatestDocument(docs(), "chapter3").id === c2.id);
check("chapter5 still locked before chapter3 passes", checkDocumentSubmissionPrerequisite(S(), docs(), "chapter5").canSubmit === false);
await dbStore.reviewProjectDocument(c2.id, "approved", advisor, "ผ่าน");
check("approving chapter3 sets passed3Chapter=true", S().passed3Chapter === true && hasPassed3ChapterExam(S(), docs()));
check("QE booking allowed once 3-chapter exam passed", checkQEBookingPrerequisite(S(), "SW", docs()).canBook === true);
check("cannot resubmit an approved stage", checkDocumentSubmissionPrerequisite(S(), docs(), "chapter3").canSubmit === false);
check("chapter5 unlocked", checkDocumentSubmissionPrerequisite(S(), docs(), "chapter5").canSubmit === true);

// Revoke
await dbStore.reviewProjectDocument(c2.id, "rejected", advisor, "ยกเลิกผล");
check("revoking chapter3 approval clears passed3Chapter", S().passed3Chapter === false);
check("QE blocked again after revoke", checkQEBookingPrerequisite(S(), "SW", docs()).canBook === false);
await dbStore.reviewProjectDocument(c2.id, "approved", advisor, "ผ่าน (ยืนยันอีกครั้ง)");
check("re-approve restores passed3Chapter", S().passed3Chapter === true);

// Chapter 5: distinct submission time, as in separate user interactions.
await new Promise((resolve) => setTimeout(resolve, 2));
const f1 = await submit("chapter5", "66122519010_5บท.pdf");
check("chapter5 v1 submitted", f1.version === 1 && f1.status === "submitted");
await dbStore.reviewProjectDocument(f1.id, "approved", otherTeacher, "ผ่าน");
check("approving chapter5 sets passed5Chapter=true", S().passed5Chapter === true);
check("reviewer of chapter5 recorded (committee member, not advisor)", getLatestDocument(docs(), "chapter5").reviewerId === otherTeacher.id);
check("document list newest first", docs()[0].id === f1.id);

// Withdraw (only unreviewed submissions)
const other = dbStore.updateStudentProfile("STD-66122519011", { advisorId: advisor.id, profileCompleted: true });
const wId = dbStore.newProjectDocumentId("proposal");
await dbStore.submitProjectDocument({
  id: wId, studentId: other.id, studentUid: other.uid, studentCode: other.studentCode, studentNameTh: "x", projectTitle: "x",
  docType: "proposal", fileName: "p.pdf", fileSize: 10, fileRef: `pdf://${wId}`, advisorId: advisor.id, advisorNameTh: "x",
});
check("withdraw removes an unreviewed submission", !!(await dbStore.withdrawProjectDocument(wId)) && dbStore.getProjectDocuments(other.id).length === 0);
check("withdraw of a reviewed document is refused", (await dbStore.withdrawProjectDocument(c2.id)) === undefined && getLatestDocument(docs(), "chapter3").id === c2.id);

// Legacy flag still honoured (records flagged before the document pipeline existed)
const legacy = { ...S(), passed3Chapter: true };
check("legacy passed3Chapter flag without documents still allows QE", checkQEBookingPrerequisite(legacy, "SW", []).canBook === true);
check("suspended student cannot submit documents", checkDocumentSubmissionPrerequisite({ status: "suspended", passed3Chapter: false }, [], "proposal").canSubmit === false);

// PDF validation helpers
const enc = (s) => new Uint8Array(Buffer.from(s, "latin1"));
check("PDF signature detected at offset 0", hasPdfSignature(enc("%PDF-1.7\n%âãÏÓ")) === true);
check("PDF signature detected within first 1 KB", hasPdfSignature(enc(" ".repeat(500) + "%PDF-1.4")) === true);
check("PDF signature beyond 1 KB rejected", hasPdfSignature(enc(" ".repeat(1100) + "%PDF-1.4")) === false);
check("non-PDF bytes rejected", hasPdfSignature(enc("PK\u0003\u0004 docx")) === false && hasPdfSignature(new Uint8Array(0)) === false);
check("size cap is 5 MB", PDF_MAX_FILE_BYTES === 5 * 1024 * 1024);
check("formatFileSize", formatFileSize(1024) === "1 KB" && formatFileSize(2.5 * 1024 * 1024) === "2.50 MB" && formatFileSize(0) === "-");

// A stale legacy flag must never override a reviewed (failed) chapter3 document.
check("rejected chapter3 overrides stale passed flag", !checkQEBookingPrerequisite(
  { ...S(), passed3Chapter: true }, "SW", [{ ...c2, status: "rejected" }]
).canBook);
let duplicateRejected = false;
try { await submit("chapter3"); } catch { duplicateRejected = true; }
check("store rejects duplicate approved-stage submissions", duplicateRejected);

// QE result / booking helpers
const swTrack = dbStore.getTracks().find((t) => t.id === "SW");
const mkBooking = (examDate) =>
  dbStore.createQEBooking({
    studentId: student.id, studentUid: student.uid, studentCode: student.studentCode, studentNameTh: "นายทดสอบ เอกสาร",
    trackId: "SW", roundId: "ROUND-QE-2569-1", roundName: "QE", examDate, timeSlot: "09:00 - 10:30", room: "4731",
    status: "pending", examinerIds: swTrack.examinersDefault, examinerNames: ["a", "b", "c"], prerequisitePassed: true, submissionDate: examDate,
  });
const b1 = mkBooking("2026-09-10");
check("open booking detected while pending", dbStore.getOpenQEBookingByStudent(student.id)?.id === b1.id);
let duplicateBookingRejected = false;
try { mkBooking("2026-09-11"); } catch { duplicateBookingRejected = true; }
check("store refuses a second open QE booking", duplicateBookingRejected);
const fail = (id) => ({ examinerId: id, examinerName: id, score: 40, isPass: false, comments: "", evaluatedAt: "", signatureStatus: true });
const pass = (id) => ({ examinerId: id, examinerName: id, score: 80, isPass: true, comments: "", evaluatedAt: "", signatureStatus: true });
dbStore.updateExaminerEvaluation(b1.id, swTrack.examinersDefault.map(fail));
check("no open booking after evaluation", dbStore.getOpenQEBookingByStudent(student.id) === undefined);
check("failed attempt → passedQE=false", S().passedQE === false && dbStore.getQEResultByStudent(student.id).finalResult === "failed");
const b2 = mkBooking("2026-10-10");
dbStore.updateExaminerEvaluation(b2.id, swTrack.examinersDefault.map(pass));
check("passed result preferred over earlier failed one", dbStore.getQEResultByStudent(student.id).finalResult === "passed" && S().passedQE === true);
check("student bookings sorted newest first", dbStore.getQEBookingsByStudent(student.id)[0].id === b2.id);

// Re-evaluating an earlier failed attempt must not erase a subsequent pass.
dbStore.updateExaminerEvaluation(b1.id, swTrack.examinersDefault.map(fail));
check("earlier failed attempt cannot erase an existing QE pass", S().passedQE === true);
let passedBookingRejected = false;
try { mkBooking("2026-11-10"); } catch { passedBookingRejected = true; }
check("store refuses QE booking after passing", passedBookingRejected);
const blockedStudent = dbStore.getStudentById("STD-66122519012");
let prerequisiteRejected = false;
try { dbStore.createQEBooking({ ...b1, studentId: blockedStudent.id, prerequisitePassed: true }); } catch { prerequisiteRejected = true; }
check("store rejects unqualified student despite forged prerequisitePassed input", prerequisiteRejected);

console.log(failures === 0 ? "\n=== ALL PASSED ===" : `\n=== ${failures} FAILURE(S) ===`);
process.exit(failures === 0 ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(1); });
