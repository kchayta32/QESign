// Data Access Layer with Firebase Firestore & Mock Store Synchronization
import {
  MOCK_TRACKS,
  MOCK_TEACHERS,
  MOCK_STUDENTS,
  MOCK_EXAM_ROUNDS,
  MOCK_QE_BOOKINGS,
  MOCK_QE_RESULTS,
  MOCK_ADVISOR_LOGS,
  MOCK_CONFERENCE_EVIDENCE
} from "@/lib/mock/seedData";
import {
  Track,
  Teacher,
  Student,
  ExamRound,
  QEBooking,
  QEResult,
  AdvisorMeetingLog,
  ConferenceEvidence,
  ExaminerScoreItem,
  FinalExamEligibility,
  TrackType
} from "@/types";
import {
  evaluateQEResult,
  calculateFinalExamEligibility
} from "@/lib/rules/engine";

// In-browser State Store (Preserved across user switches & tab sessions via localStorage)
class AppDataStore {
  private static instance: AppDataStore;
  private tracks: Track[] = [...MOCK_TRACKS];
  private teachers: Teacher[] = [...MOCK_TEACHERS];
  private students: Student[] = [...MOCK_STUDENTS];
  private examRounds: ExamRound[] = [...MOCK_EXAM_ROUNDS];
  private qeBookings: QEBooking[] = [...MOCK_QE_BOOKINGS];
  private qeResults: QEResult[] = [...MOCK_QE_RESULTS];
  private advisorLogs: AdvisorMeetingLog[] = [...MOCK_ADVISOR_LOGS];
  private conferenceEvidence: ConferenceEvidence[] = [...MOCK_CONFERENCE_EVIDENCE];

  private listeners: Set<() => void> = new Set();

  private constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
    }
  }

  public static getInstance(): AppDataStore {
    if (!AppDataStore.instance) {
      AppDataStore.instance = new AppDataStore();
    }
    return AppDataStore.instance;
  }

  private loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem("SSRU_CE_DATA_STORE");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tracks) this.tracks = parsed.tracks;
        if (parsed.teachers) this.teachers = parsed.teachers;
        if (parsed.students) this.students = parsed.students;
        if (parsed.examRounds) this.examRounds = parsed.examRounds;
        if (parsed.qeBookings) this.qeBookings = parsed.qeBookings;
        if (parsed.qeResults) this.qeResults = parsed.qeResults;
        if (parsed.advisorLogs) this.advisorLogs = parsed.advisorLogs;
        if (parsed.conferenceEvidence) this.conferenceEvidence = parsed.conferenceEvidence;
      }
    } catch (e) {
      console.warn("Could not load from localStorage, using initial mock data", e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        tracks: this.tracks,
        teachers: this.teachers,
        students: this.students,
        examRounds: this.examRounds,
        qeBookings: this.qeBookings,
        qeResults: this.qeResults,
        advisorLogs: this.advisorLogs,
        conferenceEvidence: this.conferenceEvidence,
      };
      localStorage.setItem("SSRU_CE_DATA_STORE", JSON.stringify(payload));
      this.notifyListeners();
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }

  public resetToDefault() {
    this.tracks = [...MOCK_TRACKS];
    this.teachers = [...MOCK_TEACHERS];
    this.students = [...MOCK_STUDENTS];
    this.examRounds = [...MOCK_EXAM_ROUNDS];
    this.qeBookings = [...MOCK_QE_BOOKINGS];
    this.qeResults = [...MOCK_QE_RESULTS];
    this.advisorLogs = [...MOCK_ADVISOR_LOGS];
    this.conferenceEvidence = [...MOCK_CONFERENCE_EVIDENCE];
    this.saveToLocalStorage();
  }

  // --- GETTERS ---
  public getTracks(): Track[] {
    return this.tracks;
  }

  public getTeachers(): Teacher[] {
    return this.teachers;
  }

  public getStudents(): Student[] {
    return this.students;
  }

  public getStudentById(studentId: string): Student | undefined {
    return this.students.find((s) => s.id === studentId || s.studentCode === studentId);
  }

  public getExamRounds(): ExamRound[] {
    return this.examRounds;
  }

  public getQEBookings(): QEBooking[] {
    return this.qeBookings;
  }

  public getQEBookingsByStudent(studentId: string): QEBooking[] {
    return this.qeBookings.filter((b) => b.studentId === studentId);
  }

  public getQEResults(): QEResult[] {
    return this.qeResults;
  }

  public getQEResultByBooking(bookingId: string): QEResult | undefined {
    return this.qeResults.find((r) => r.bookingId === bookingId);
  }

  public getQEResultByStudent(studentId: string): QEResult | undefined {
    return this.qeResults.find((r) => r.studentId === studentId);
  }

  public getAdvisorLogs(studentId?: string): AdvisorMeetingLog[] {
    if (!studentId) return this.advisorLogs;
    return this.advisorLogs.filter((l) => l.studentId === studentId);
  }

  public getConferenceEvidence(studentId?: string): ConferenceEvidence[] {
    if (!studentId) return this.conferenceEvidence;
    return this.conferenceEvidence.filter((c) => c.studentId === studentId);
  }

  public getStudentEligibility(studentId: string): FinalExamEligibility {
    const student = this.getStudentById(studentId) || this.students[0];
    const logs = this.getAdvisorLogs(student.id);
    const qeResult = this.getQEResultByStudent(student.id);
    const conf = this.getConferenceEvidence(student.id)[0] || null;
    return calculateFinalExamEligibility(student, logs, qeResult, conf);
  }

  // --- MUTATIONS ---
  public createQEBooking(booking: Omit<QEBooking, "id">): QEBooking {
    const newBooking: QEBooking = {
      ...booking,
      id: `BK-QE-${Date.now().toString().slice(-4)}`,
    };
    this.qeBookings = [newBooking, ...this.qeBookings];

    // Update track active count
    this.tracks = this.tracks.map((t) =>
      t.id === booking.trackId
        ? { ...t, activeBookingsCount: t.activeBookingsCount + 1 }
        : t
    );

    this.saveToLocalStorage();
    return newBooking;
  }

  public updateExaminerEvaluation(
    bookingId: string,
    examinerScores: ExaminerScoreItem[]
  ): QEResult {
    const booking = this.qeBookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    const evaluation = evaluateQEResult(examinerScores);

    const existingResultIndex = this.qeResults.findIndex((r) => r.bookingId === bookingId);
    const newResult: QEResult = {
      id: existingResultIndex >= 0 ? this.qeResults[existingResultIndex].id : `RES-QE-${Date.now().toString().slice(-4)}`,
      bookingId,
      studentId: booking.studentId,
      studentCode: booking.studentCode,
      studentNameTh: booking.studentNameTh,
      trackId: booking.trackId,
      evaluationRound: "1/2567",
      examinerScores,
      totalExaminers: 3,
      passVotesCount: evaluation.passVotesCount,
      finalResult: evaluation.finalResult,
      averageScore: evaluation.averageScore,
      certifiedDate: new Date().toISOString().split("T")[0],
      announced: true,
    };

    if (existingResultIndex >= 0) {
      this.qeResults[existingResultIndex] = newResult;
    } else {
      this.qeResults.push(newResult);
    }

    // Update booking status
    this.qeBookings = this.qeBookings.map((b) =>
      b.id === bookingId ? { ...b, status: "evaluated" } : b
    );

    // Update student passedQE flag if passed
    if (evaluation.finalResult === "passed") {
      this.students = this.students.map((s) =>
        s.id === booking.studentId ? { ...s, passedQE: true } : s
      );
    }

    this.saveToLocalStorage();
    return newResult;
  }

  public addAdvisorLog(log: Omit<AdvisorMeetingLog, "id">): AdvisorMeetingLog {
    const newLog: AdvisorMeetingLog = {
      ...log,
      id: `LOG-${Date.now().toString().slice(-4)}`,
    };
    this.advisorLogs = [newLog, ...this.advisorLogs];
    this.saveToLocalStorage();
    return newLog;
  }

  public updateAdvisorLogStatus(logId: string, status: 'approved' | 'rejected', feedback?: string): void {
    this.advisorLogs = this.advisorLogs.map((log) =>
      log.id === logId
        ? {
            ...log,
            status,
            advisorFeedback: feedback || log.advisorFeedback,
            verifiedAt: new Date().toISOString(),
          }
        : log
    );
    this.saveToLocalStorage();
  }

  public addConferenceEvidence(evidence: Omit<ConferenceEvidence, "id">): ConferenceEvidence {
    const newEvidence: ConferenceEvidence = {
      ...evidence,
      id: `CONF-${Date.now().toString().slice(-4)}`,
    };
    this.conferenceEvidence = [newEvidence, ...this.conferenceEvidence];
    this.saveToLocalStorage();
    return newEvidence;
  }

  public updateConferenceStatus(evidenceId: string, status: 'verified' | 'rejected', rejectionReason?: string): void {
    this.conferenceEvidence = this.conferenceEvidence.map((ev) =>
      ev.id === evidenceId
        ? {
            ...ev,
            status,
            rejectionReason,
            verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
          }
        : ev
    );
    this.saveToLocalStorage();
  }
}

export const dbStore = AppDataStore.getInstance();
