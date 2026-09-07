// TypeScript Data Models for SSRU CE QE & Project Booking System

export type UserRole = 'student' | 'teacher' | 'admin';

export type TrackType = 'HW' | 'SW' | 'NW' | 'DB';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  phone?: string;
  studentId?: string; // Student code e.g. 64123456001
  teacherCode?: string; // Teacher code e.g. kwanruan.ru
  department: string;
  createdAt: string;
}

/**
 * Credential & onboarding state shared by every account type.
 * Passwords are verified against `passwordHash` (PBKDF2). When no hash is stored
 * yet, the default password rule applies: password === account code.
 */
export interface AccountSecurity {
  passwordHash?: string;
  passwordChanged?: boolean;
  authProvisioned?: boolean; // Firebase Auth user has been created for this e-mail
  profileCompleted?: boolean; // First-login profile form has been submitted
  lastLoginAt?: string;
}

export interface Student extends AccountSecurity {
  id: string;
  uid: string;
  studentCode: string;
  prefixTh: string;
  firstNameTh: string;
  lastNameTh: string;
  prefixEn: string;
  firstNameEn: string;
  lastNameEn: string;
  email: string;
  phone: string;
  trackId: TrackType;
  yearLevel: number; // 1-8 (derived from the enrolment year in the student code)
  status: 'active' | 'graduated' | 'suspended';
  advisorId: string; // Teacher id, "CUSTOM-<name>" for an external advisor, or "" when unassigned
  coAdvisorId?: string;
  projectTitleTh?: string;
  projectTitleEn?: string;
  passed3Chapter: boolean; // 3-chapter exam passed — set when the advisor approves the chapter3 document (QE prerequisite)
  passed5Chapter?: boolean; // 5-chapter (final book) exam passed — set when the advisor approves the chapter5 document
  passedQE: boolean;
  finalEligible: boolean;
  avatarUrl?: string;
}

export interface Teacher extends AccountSecurity {
  id: string;
  uid: string;
  teacherCode: string; // Login code = e-mail local part, e.g. "kwanruan.ru"
  prefixTh: string;
  firstNameTh: string;
  lastNameTh: string;
  academicRankTh: string; // เช่น ผู้ช่วยศาสตราจารย์ ดร., อาจารย์
  email: string;
  phone: string;
  department?: string; // สาขาวิชา
  faculty?: string;
  website?: string;
  specializations: TrackType[];
  isCommittee: boolean;
  avatarUrl?: string;
  currentAdviseesCount?: number;
}

export interface AdminAccount extends AccountSecurity {
  id: string;
  code: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Track {
  id: TrackType;
  code: TrackType;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  iconName: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  quotaTotal: number;
  activeBookingsCount: number;
  examinersDefault: string[]; // Teacher IDs
}

export type BookingStatus = 'pending' | 'confirmed' | 'evaluating' | 'evaluated' | 'cancelled';

export interface QEBooking {
  id: string;
  studentId: string;
  studentUid: string;
  studentCode: string;
  studentNameTh: string;
  trackId: TrackType;
  roundId: string;
  roundName: string;
  examDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00 - 10:30"
  room: string; // e.g. "CE Lab 4731"
  status: BookingStatus;
  resultId?: string; // Stable result pointer, validated atomically with the decision.
  examinerIds: [string, string, string]; // Exactly 3 examiners
  examinerNames: [string, string, string];
  prerequisitePassed: boolean;
  submissionDate: string;
  notes?: string;
}

export interface ExaminerScoreItem {
  examinerId: string;
  examinerName: string;
  score: number; // 0 - 100
  isPass: boolean; // >= 60 or explicitly passed
  comments: string;
  evaluatedAt: string;
  signatureStatus: boolean;
}

export interface QEResult {
  id: string;
  bookingId: string;
  studentId: string;
  studentCode: string;
  studentNameTh: string;
  trackId: TrackType;
  evaluationRound: string;
  examinerScores: ExaminerScoreItem[];
  totalExaminers: 3;
  passVotesCount: number; // Count of isPass === true
  finalResult: 'passed' | 'failed' | 'pending'; // 2/3 Rule: passVotesCount >= 2
  averageScore: number;
  certifiedDate?: string;
  announced: boolean;
}

export interface AdvisorMeetingLog {
  id: string;
  studentId: string;
  studentUid: string;
  studentCode: string;
  studentNameTh: string;
  projectTitle: string;
  meetingDate: string; // YYYY-MM-DD
  meetingType: 'onsite' | 'online';
  topic: string;
  discussionSummary: string;
  progressPercentage: number; // 0 - 100
  nextGoals: string;
  advisorId: string;
  advisorNameTh: string;
  status: 'pending' | 'approved' | 'rejected';
  advisorFeedback?: string;
  verifiedAt?: string;
}

export interface ConferenceEvidence {
  id: string;
  studentId: string;
  studentUid: string;
  studentCode: string;
  studentNameTh: string;
  projectTitle: string;
  paperTitle: string;
  conferenceName: string;
  presentationDate: string;
  conferenceLevel: 'national' | 'international';
  indexedBy: 'TCI-1' | 'TCI-2' | 'Scopus' | 'IEEE Xplore' | 'Other';
  proofType: 'certificate' | 'proceeding' | 'acceptance_letter';
  proofFileUrl: string;
  fileName: string;
  fileSize?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  reviewedByAdvisorId?: string;
  reviewedByAdvisorName?: string;
  verifiedAt?: string;
  submissionDate: string;
}

/**
 * Project document pipeline (PDF submissions reviewed by the advisor):
 *   proposal  → โครงร่างโครงงาน (Proposal)
 *   chapter3  → เอกสารสอบ 3 บท (prerequisite for QE booking)
 *   chapter5  → เอกสารสอบ 5 บท (final book)
 */
export type ProjectDocumentType = 'proposal' | 'chapter3' | 'chapter5';

/** submitted = waiting for the advisor; approved = exam passed; rejected = failed / needs a new version. */
export type ProjectDocumentStatus = 'submitted' | 'approved' | 'rejected';

export interface ProjectDocument {
  id: string;
  studentId: string;
  studentUid: string;
  studentCode: string;
  studentNameTh: string;
  projectTitle: string;
  docType: ProjectDocumentType;
  version: number; // 1, 2, … per docType (every resubmission is a new version)
  fileName: string; // original file name (*.pdf)
  fileSize: number; // bytes
  fileRef: string; // pdf://<docId> (Realtime Database node) or an https download URL
  studentNote?: string;
  status: ProjectDocumentStatus;
  advisorId: string;
  advisorNameTh: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewFeedback?: string;
  reviewedAt?: string;
  submittedAt: string; // ISO timestamp
}

export interface FinalExamEligibility {
  studentId: string;
  studentCode: string;
  studentNameTh: string;
  // Condition 1: Advisor Meeting Logs
  advisorLogsCount: number;
  advisorLogsRequired: number; // e.g. minimum 6 logs
  condition1_LogsApproved: boolean;

  // Condition 2: QE Result Pass (>= 2 of 3)
  qeStatus: 'passed' | 'failed' | 'not_taken' | 'pending';
  qePassVotes: number;
  condition2_QEPassed: boolean;

  // Condition 3: Conference Evidence Verified
  conferenceEvidenceId?: string;
  conferenceStatus: 'verified' | 'pending' | 'rejected' | 'not_submitted';
  condition3_ConferenceApproved: boolean;

  // Final Result Gate: Condition1 && Condition2 && Condition3
  isFinalEligible: boolean;
  unlockedAt?: string;
  certificateCode?: string;
}

export interface ExamRound {
  id: string;
  roundNumber: number;
  academicYear: string; // e.g. "2567"
  semester: number; // 1 or 2
  titleTh: string;
  type: 'QE' | 'PROJECT_PROPOSAL' | 'FINAL_DEFENSE';
  startDate: string;
  endDate: string;
  bookingDeadline: string;
  isActive: boolean;
  availableRooms: string[];
  slotsPerDay: string[];
}
