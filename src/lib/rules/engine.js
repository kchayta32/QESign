const QE_PASSING_SCORE_DEFAULT = 60;
const ADVISOR_MIN_REQUIRED_LOGS = 6;
const COMMITTEE_REQUIRED_VOTES = 2;

function checkQEBookingPrerequisite(student, trackId) {
  if (student.status !== "active") {
    return {
      canBook: false,
      reasonTh: "สถานะนักศึกษาไม่พร้อมสำหรับการสอบ (ต้องอยู่ในสถานะปกติ)",
    };
  }

  if (!student.passed3Chapter) {
    return {
      canBook: false,
      reasonTh: "ยังไม่ผ่านการสอบหัวข้อและเค้าโครงโครงงาน 3 บท (Prerequisite Required)",
    };
  }

  return {
    canBook: true,
    reasonTh: "มีคุณสมบัติครบถ้วน พร้อมลงทะเบียนจองสอบวัดคุณสมบัติ (QE)",
  };
}

function evaluateQEResult(examinerScores) {
  const totalExaminers = 3;
  if (!examinerScores || examinerScores.length < totalExaminers) {
    return {
      totalExaminers: 3,
      passVotesCount: 0,
      failVotesCount: 0,
      averageScore: 0,
      finalResult: "pending",
      isUnanimous: false,
      summaryTh: "รอผลการประเมินจากคณะกรรมการครบ 3 ท่าน",
    };
  }

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
    finalResult: isPassed ? "passed" : "failed",
    isUnanimous,
    summaryTh,
  };
}

function calculateFinalExamEligibility(
  student,
  meetingLogs,
  qeResult,
  conferenceEvidence
) {
  const approvedLogs = (meetingLogs || []).filter((log) => log.status === "approved");
  const advisorLogsCount = approvedLogs.length;
  const condition1_LogsApproved = advisorLogsCount >= ADVISOR_MIN_REQUIRED_LOGS;

  const qeStatus = qeResult ? qeResult.finalResult : student.passedQE ? "passed" : "not_taken";
  const qePassVotes = qeResult ? qeResult.passVotesCount : student.passedQE ? 3 : 0;
  const condition2_QEPassed = qeStatus === "passed";

  const conferenceStatus = conferenceEvidence
    ? conferenceEvidence.status
    : "not_submitted";
  const condition3_ConferenceApproved = conferenceStatus === "verified";

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

module.exports = {
  QE_PASSING_SCORE_DEFAULT,
  ADVISOR_MIN_REQUIRED_LOGS,
  COMMITTEE_REQUIRED_VOTES,
  checkQEBookingPrerequisite,
  evaluateQEResult,
  calculateFinalExamEligibility,
};
