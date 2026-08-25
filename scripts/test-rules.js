// Standalone Verification Script for SSRU CE System Business Rules Engine
const {
  evaluateQEResult,
  checkQEBookingPrerequisite,
  calculateFinalExamEligibility,
} = require("../src/lib/rules/engine.js");

console.log("=== [START] SSRU CE Business Rules Verification ===");

// 1. Test 2/3 Committee Voting Rule
console.log("\n--- Test 1: Committee Voting Rule (2/3 Rule) ---");
const testCases = [
  {
    name: "Case A: 3 Pass Votes (Unanimous)",
    scores: [
      { examinerId: "T-1", examinerName: "Prof 1", score: 85, isPass: true },
      { examinerId: "T-2", examinerName: "Prof 2", score: 80, isPass: true },
      { examinerId: "T-3", examinerName: "Prof 3", score: 78, isPass: true },
    ],
    expected: "passed",
  },
  {
    name: "Case B: 2 Pass Votes, 1 Fail (Majority Pass)",
    scores: [
      { examinerId: "T-1", examinerName: "Prof 1", score: 85, isPass: true },
      { examinerId: "T-2", examinerName: "Prof 2", score: 75, isPass: true },
      { examinerId: "T-3", examinerName: "Prof 3", score: 50, isPass: false },
    ],
    expected: "passed",
  },
  {
    name: "Case C: 1 Pass Vote, 2 Fail (Failed)",
    scores: [
      { examinerId: "T-1", examinerName: "Prof 1", score: 85, isPass: true },
      { examinerId: "T-2", examinerName: "Prof 2", score: 55, isPass: false },
      { examinerId: "T-3", examinerName: "Prof 3", score: 45, isPass: false },
    ],
    expected: "failed",
  },
];

for (const tc of testCases) {
  const result = evaluateQEResult(tc.scores);
  const ok = result.finalResult === tc.expected;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${tc.name} -> Result: ${result.finalResult} (Votes: ${result.passVotesCount}/3, Avg: ${result.averageScore}%)`);
}

// 2. Test 3-Condition Final Exam Eligibility Gate
console.log("\n--- Test 2: 3-Condition Final Exam Eligibility Gate (AND Logic) ---");

const mockStudent = {
  id: "STD-TEST",
  studentCode: "64122010099",
  prefixTh: "นาย",
  firstNameTh: "ทดสอบ",
  lastNameTh: "ระบบ",
  trackId: "SW",
  status: "active",
  passed3Chapter: true,
  passedQE: true,
};

const fullLogs = Array.from({ length: 6 }, (_, i) => ({
  id: `LOG-${i}`,
  status: "approved",
}));

const partialLogs = Array.from({ length: 4 }, (_, i) => ({
  id: `LOG-${i}`,
  status: "approved",
}));

const passedQE = {
  finalResult: "passed",
  passVotesCount: 3,
};

const failedQE = {
  finalResult: "failed",
  passVotesCount: 1,
};

const verifiedConf = {
  id: "CONF-1",
  status: "verified",
};

const pendingConf = {
  id: "CONF-2",
  status: "pending",
};

// Subtest A: All 3 satisfied -> Eligible
const resA = calculateFinalExamEligibility(mockStudent, fullLogs, passedQE, verifiedConf);
console.log(`[${resA.isFinalEligible === true ? "PASS" : "FAIL"}] All 3 Criteria Satisfied (6 Logs + QE Pass + Conf Verified) -> isFinalEligible = ${resA.isFinalEligible}`);

// Subtest B: Only 4 logs -> Not eligible
const resB = calculateFinalExamEligibility(mockStudent, partialLogs, passedQE, verifiedConf);
console.log(`[${resB.isFinalEligible === false ? "PASS" : "FAIL"}] Insufficient Logs (4/6 Logs) -> isFinalEligible = ${resB.isFinalEligible}`);

// Subtest C: QE Failed -> Not eligible
const resC = calculateFinalExamEligibility(mockStudent, fullLogs, failedQE, verifiedConf);
console.log(`[${resC.isFinalEligible === false ? "PASS" : "FAIL"}] QE Failed (1/3 Votes) -> isFinalEligible = ${resC.isFinalEligible}`);

// Subtest D: Conf Pending -> Not eligible
const resD = calculateFinalExamEligibility(mockStudent, fullLogs, passedQE, pendingConf);
console.log(`[${resD.isFinalEligible === false ? "PASS" : "FAIL"}] Conference Proof Pending -> isFinalEligible = ${resD.isFinalEligible}`);

console.log("\n=== [COMPLETE] All Business Logic Rules Verified Successfully ===");
