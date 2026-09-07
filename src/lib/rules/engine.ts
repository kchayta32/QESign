// Business Logic & Rules Engine for SSRU CE System
import {
  Student,
  ExaminerScoreItem,
  QEResult,
  AdvisorMeetingLog,
  ConferenceEvidence,
  FinalExamEligibility,
  ProjectDocument,
  ProjectDocumentType,
  TrackType
} from "@/types";

export const QE_PASSING_SCORE_DEFAULT = 60;
export const ADVISOR_MIN_REQUIRED_LOGS = 6;
export const COMMITTEE_REQUIRED_VOTES = 2; // 2 out of 3 examiners

// ---------------------------------------------------------------------------
// 0. Project document pipeline (Proposal → สอบ 3 บท → สอบ 5 บท)
// ---------------------------------------------------------------------------
export interface ProjectDocumentStage {
  type: ProjectDocumentType;
  order: number;
  titleTh: string;
  shortTh: string;
  descriptionTh: string;
  /** Stage that must be approved before this one can be submitted. */
  requires?: ProjectDocumentType;
}

export const PROJECT_DOCUMENT_STAGES: ProjectDocumentStage[] = [
  {
    type: "proposal",
    order: 1,
    titleTh: "โครงร่างโครงงาน (Proposal)",
    shortTh: "Proposal",
    descriptionTh: "เอกสารเสนอหัวข้อและโครงร่างโครงงาน (.pdf) เพื่อขออนุมัติจากอาจารย์ที่ปรึกษา",
  },
  {
    type: "chapter3",
    order: 2,
    titleTh: "เอกสารสอบ 3 บท (Proposal Defense)",
    shortTh: "สอบ 3 บท",
    descriptionTh: "รายงานบทที่ 1–3 ฉบับสอบ (.pdf) — ต้องได้รับผล \"ผ่าน\" ก่อนจึงจะจองสอบ QE ได้",
    requires: "proposal",
  },
  {
    type: "chapter5",
    order: 3,
    titleTh: "เอกสารสอบ 5 บท (Final Book)",
    shortTh: "สอบ 5 บท",
    descriptionTh: "รายงานฉบับสมบูรณ์บทที่ 1–5 (.pdf) สำหรับการสอบป้องกันโครงงาน",
    requires: "chapter3",
  },
];

/** Current main advisor or any co-advisor; empty ids are never assignments. */
export function isProjectAdvisor(
  student: Pick<Student, "advisorId" | "coAdvisorId" | "coAdvisor2Id" | "coAdvisor3Id">,
  teacherId: string
): boolean {
  return !!teacherId && [student.advisorId, student.coAdvisorId, student.coAdvisor2Id, student.coAdvisor3Id].includes(teacherId);
}

export function getDocumentStage(type: ProjectDocumentType): ProjectDocumentStage {
  return PROJECT_DOCUMENT_STAGES.find((s) => s.type === type) || PROJECT_DOCUMENT_STAGES[0];
}

/** Newest submission of one stage (highest version, then latest submittedAt). */
export function getLatestDocument(documents: ProjectDocument[], type: ProjectDocumentType): ProjectDocument | undefined {
  return (documents || [])
    .filter((d) => d.docType === type)
    .sort((a, b) => (b.version || 0) - (a.version || 0) || (b.submittedAt || "").localeCompare(a.submittedAt || ""))[0];
}

/** A stage counts as passed when any version of its document has been approved. */
export function isDocumentStageApproved(documents: ProjectDocument[], type: ProjectDocumentType): boolean {
  return (documents || []).some((d) => d.docType === type && d.status === "approved");
}

/**
 * The 3-chapter exam is passed when the advisor approved the chapter3 document. The
 * `passed3Chapter` flag on the student record is kept in step with that approval (and is
 * still honoured for records that were flagged before the document pipeline existed).
 */
export function hasPassed3ChapterExam(student: Pick<Student, "passed3Chapter">, documents?: ProjectDocument[]): boolean {
  // Once documents exist they are authoritative, even if a legacy/cache flag is stale.
  if (documents?.some((d) => d.docType === "chapter3")) return isDocumentStageApproved(documents, "chapter3");
  return !!student.passed3Chapter;
}

/** Can the student upload (a new version of) this document right now? */
export function checkDocumentSubmissionPrerequisite(
  student: Pick<Student, "status" | "passed3Chapter">,
  documents: ProjectDocument[],
  type: ProjectDocumentType
): { canSubmit: boolean; reasonTh: string } {
  if (student.status !== "active") {
    return { canSubmit: false, reasonTh: "สถานะนักศึกษาไม่พร้อมสำหรับการส่งเอกสาร (ต้องอยู่ในสถานะปกติ)" };
  }
  const stage = getDocumentStage(type);
  const latest = getLatestDocument(documents, type);
  if (latest?.status === "approved") {
    return { canSubmit: false, reasonTh: `${stage.shortTh} ได้รับผล "ผ่าน" แล้ว ไม่ต้องส่งเอกสารซ้ำ` };
  }
  if (latest?.status === "submitted") {
    return { canSubmit: false, reasonTh: `เอกสาร ${stage.shortTh} (ฉบับที่ ${latest.version}) อยู่ระหว่างรออาจารย์ที่ปรึกษาตรวจ` };
  }
  if (stage.requires) {
    const prev = getDocumentStage(stage.requires);
    const prevPassed =
      stage.requires === "chapter3" ? hasPassed3ChapterExam(student, documents) : isDocumentStageApproved(documents, stage.requires);
    if (!prevPassed) {
      return { canSubmit: false, reasonTh: `ต้องผ่านขั้นตอน ${prev.shortTh} ก่อนจึงจะส่งเอกสาร ${stage.shortTh} ได้` };
    }
  }
  return {
    canSubmit: true,
    reasonTh: latest?.status === "rejected" ? `ส่งเอกสาร ${stage.shortTh} ฉบับแก้ไข (ฉบับที่ ${latest.version + 1})` : `พร้อมส่งเอกสาร ${stage.shortTh}`,
  };
}

/**
 * 1. Check QE Booking Prerequisites
 * The student must be active and must have passed the 3-chapter exam (advisor approved the
 * chapter3 document) before a QE round can be booked.
 */
export function checkQEBookingPrerequisite(
  student: Student,
  trackId: TrackType,
  documents?: ProjectDocument[]
): {
  canBook: boolean;
  reasonTh: string;
} {
  if (student.status !== "active") {
    return {
      canBook: false,
      reasonTh: "สถานะนักศึกษาไม่พร้อมสำหรับการสอบ (ต้องอยู่ในสถานะปกติ)",
    };
  }

  // Rule: Must have passed the 3-chapter exam before booking QE
  if (!hasPassed3ChapterExam(student, documents)) {
    const latest = documents ? getLatestDocument(documents, "chapter3") : undefined;
    const hint =
      latest?.status === "submitted"
        ? "เอกสารสอบ 3 บทอยู่ระหว่างรออาจารย์ที่ปรึกษาบันทึกผล"
        : latest?.status === "rejected"
        ? "ผลสอบ 3 บทล่าสุด \"ไม่ผ่าน\" กรุณาส่งเอกสารฉบับแก้ไข"
        : "กรุณาส่งเอกสารสอบ 3 บท (.pdf) ในเมนูเอกสารโครงงานและรอผล \"ผ่าน\" จากอาจารย์ที่ปรึกษา";
    return {
      canBook: false,
      reasonTh: `ยังไม่ผ่านการสอบ 3 บท จึงยังไม่สามารถจองสอบ QE ได้ — ${hint}`,
    };
  }

  return {
    canBook: true,
    reasonTh: "มีคุณสมบัติครบถ้วน (ผ่านการสอบ 3 บทแล้ว) พร้อมลงทะเบียนจองสอบวัดคุณสมบัติ (QE)",
  };
}

/**
 * 2. Committee Voting Rule Engine
 * Evaluates 3-examiner matrix: Passed if pass votes >= 2 out of 3 examiners
 */
export function evaluateQEResult(
  examinerScores: ExaminerScoreItem[]
): {
  totalExaminers: 3;
  passVotesCount: number;
  failVotesCount: number;
  averageScore: number;
  finalResult: 'passed' | 'failed' | 'pending';
  isUnanimous: boolean;
  summaryTh: string;
} {
  const totalExaminers = 3;
  if (!examinerScores || examinerScores.length < totalExaminers) {
    return {
      totalExaminers: 3,
      passVotesCount: 0,
      failVotesCount: 0,
      averageScore: 0,
      finalResult: 'pending',
      isUnanimous: false,
      summaryTh: 'รอผลการประเมินจากคณะกรรมการครบ 3 ท่าน',
    };
  }

  // Count pass votes based on isPass flag (or score >= 60)
  const passVotesCount = examinerScores.filter(
    (item) => item.isPass === true || item.score >= QE_PASSING_SCORE_DEFAULT
  ).length;

  const failVotesCount = totalExaminers - passVotesCount;
  const totalScore = examinerScores.reduce((sum, item) => sum + (item.score || 0), 0);
  const averageScore = Number((totalScore / totalExaminers).toFixed(2));

  const isPassed = passVotesCount >= COMMITTEE_REQUIRED_VOTES;
  const isUnanimous = passVotesCount === 3;

  let summaryTh = "";
  if (isPassed) {
    summaryTh = isUnanimous
      ? `ผ่านเกณฑ์ประเมินด้วยมติเอกฉันท์ (3 ใน 3 เสียง) คะแนนเฉลี่ย ${averageScore}%`
      : `ผ่านเกณฑ์ประเมินด้วยมติเสียงข้างมาก (2 ใน 3 เสียง) คะแนนเฉลี่ย ${averageScore}%`;
  } else {
    summaryTh = `ไม่ผ่านเกณฑ์การประเมิน (ได้ ${passVotesCount} จาก 3 เสียง - ต้องได้ 2 ใน 3 เสียงขึ้นไป)`;
  }

  return {
    totalExaminers: 3,
    passVotesCount,
    failVotesCount,
    averageScore,
    finalResult: isPassed ? 'passed' : 'failed',
    isUnanimous,
    summaryTh,
  };
}

/**
 * 3. 3-Condition Eligibility Gate Engine
 * Condition 1: Advisor Meeting Logs (>= 6 approved logs)
 * Condition 2: Passed QE (2/3 Committee Votes)
 * Condition 3: Verified Conference Evidence (Paper presentation proof)
 * 
 * Logic: Gate Unlock = Condition 1 && Condition 2 && Condition 3
 */
export function calculateFinalExamEligibility(
  student: Student,
  meetingLogs: AdvisorMeetingLog[],
  qeResult?: QEResult | null,
  conferenceEvidence?: ConferenceEvidence | null
): FinalExamEligibility {
  // Condition 1: Advisor Logs
  const approvedLogs = (meetingLogs || []).filter((log) => log.status === 'approved');
  const advisorLogsCount = approvedLogs.length;
  const condition1_LogsApproved = advisorLogsCount >= ADVISOR_MIN_REQUIRED_LOGS;

  // Condition 2: QE Result
  const qeStatus = qeResult ? qeResult.finalResult : student.passedQE ? 'passed' : 'not_taken';
  const qePassVotes = qeResult ? qeResult.passVotesCount : student.passedQE ? 3 : 0;
  const condition2_QEPassed = qeStatus === 'passed';

  // Condition 3: Conference Evidence
  const conferenceStatus = conferenceEvidence
    ? conferenceEvidence.status
    : 'not_submitted';
  const condition3_ConferenceApproved = conferenceStatus === 'verified';

  // Final Gate Evaluation (Strict AND logic across all 3 criteria)
  const isFinalEligible =
    condition1_LogsApproved && condition2_QEPassed && condition3_ConferenceApproved;

  const certificateCode = isFinalEligible
    ? `SSRU-CE-${student.studentCode.slice(-4)}-${new Date().getFullYear()}`
    : undefined;

  return {
    studentId: student.id,
    studentCode: student.studentCode,
    studentNameTh: `${student.prefixTh} ${student.firstNameTh} ${student.lastNameTh}`,
    advisorLogsCount,
    advisorLogsRequired: ADVISOR_MIN_REQUIRED_LOGS,
    condition1_LogsApproved,
    qeStatus,
    qePassVotes,
    condition2_QEPassed,
    conferenceEvidenceId: conferenceEvidence?.id,
    conferenceStatus,
    condition3_ConferenceApproved,
    isFinalEligible,
    unlockedAt: isFinalEligible ? new Date().toISOString() : undefined,
    certificateCode,
  };
}
