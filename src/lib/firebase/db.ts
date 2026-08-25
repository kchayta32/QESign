// Data Access Layer with Firebase Realtime Database & Firestore Synchronization
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
import { db, rtdb } from "./config";
import {
  subscribeToRealtimeDatabase,
  pushEntityToRTDB,
  syncAllToRealtimeDatabase
} from "./rtdb";
import { doc, setDoc } from "firebase/firestore";

// In-browser & Realtime Database Synchronized Store
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
  private isRtdbSubscribed = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
      this.initRealtimeDatabaseListener();
    }
  }

  public static getInstance(): AppDataStore {
    if (!AppDataStore.instance) {
      AppDataStore.instance = new AppDataStore();
    }
    return AppDataStore.instance;
  }

  private initRealtimeDatabaseListener() {
    if (this.isRtdbSubscribed) return;
    this.isRtdbSubscribed = true;

    // Listen to live updates in Firebase Realtime Database
    subscribeToRealtimeDatabase((liveData) => {
      let hasChanges = false;
      if (liveData.tracks && liveData.tracks.length > 0) {
        this.tracks = liveData.tracks;
        hasChanges = true;
      }
      if (liveData.teachers && liveData.teachers.length > 0) {
        this.teachers = liveData.teachers;
        hasChanges = true;
      }
      if (liveData.students && liveData.students.length > 0) {
        this.students = liveData.students;
        hasChanges = true;
      }
      if (liveData.examRounds && liveData.examRounds.length > 0) {
        this.examRounds = liveData.examRounds;
        hasChanges = true;
      }
      if (liveData.qeBookings) {
        this.qeBookings = liveData.qeBookings;
        hasChanges = true;
      }
      if (liveData.qeResults) {
        this.qeResults = liveData.qeResults;
        hasChanges = true;
      }
      if (liveData.advisorLogs) {
        this.advisorLogs = liveData.advisorLogs;
        hasChanges = true;
      }
      if (liveData.conferenceEvidence) {
        this.conferenceEvidence = liveData.conferenceEvidence;
        hasChanges = true;
      }

      if (hasChanges) {
        this.saveToLocalStorage(false);
        this.notifyListeners();
      }
    });
  }

  private loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem("SSRU_CE_DATA_STORE_V3");
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
      console.warn("Could not load from localStorage, using default seed data", e);
    }
  }

  private saveToLocalStorage(syncToCloud: boolean = true) {
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
      localStorage.setItem("SSRU_CE_DATA_STORE_V3", JSON.stringify(payload));
      this.notifyListeners();

      if (syncToCloud && rtdb) {
        syncAllToRealtimeDatabase(payload);
      }
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
    this.saveToLocalStorage(true);
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
    return this.qeBookings.filter((b) => b.studentId === studentId || b.studentCode === studentId);
  }

  public getQEResults(): QEResult[] {
    return this.qeResults;
  }

  public getQEResultByBooking(bookingId: string): QEResult | undefined {
    return this.qeResults.find((r) => r.bookingId === bookingId);
  }

  public getQEResultByStudent(studentId: string): QEResult | undefined {
    return this.qeResults.find((r) => r.studentId === studentId || r.studentCode === studentId);
  }

  public getAdvisorLogs(studentId?: string): AdvisorMeetingLog[] {
    if (!studentId) return this.advisorLogs;
    return this.advisorLogs.filter((l) => l.studentId === studentId || l.studentCode === studentId);
  }

  public getConferenceEvidence(studentId?: string): ConferenceEvidence[] {
    if (!studentId) return this.conferenceEvidence;
    return this.conferenceEvidence.filter((c) => c.studentId === studentId || c.studentCode === studentId);
  }

  public getStudentEligibility(studentId: string): FinalExamEligibility {
    const student = this.getStudentById(studentId) || this.students[0];
    const logs = this.getAdvisorLogs(student.id);
    const qeResult = this.getQEResultByStudent(student.id);
    const conf = this.getConferenceEvidence(student.id)[0] || null;
    return calculateFinalExamEligibility(student, logs, qeResult, conf);
  }

  // --- MUTATIONS ---
  public registerNewStudent(student: Student): Student {
    const existingIndex = this.students.findIndex(
      (s) => s.id === student.id || s.studentCode === student.studentCode
    );

    if (existingIndex >= 0) {
      this.students[existingIndex] = student;
    } else {
      this.students = [student, ...this.students];
    }

    pushEntityToRTDB("students", student.id, student);
    this.saveToLocalStorage(true);
    return student;
  }

  public updateStudentProfile(studentId: string, updates: Partial<Student>): Student | undefined {
    const targetIndex = this.students.findIndex((s) => s.id === studentId || s.studentCode === studentId);
    if (targetIndex >= 0) {
      this.students[targetIndex] = {
        ...this.students[targetIndex],
        ...updates,
      };
      pushEntityToRTDB("students", this.students[targetIndex].id, this.students[targetIndex]);
      this.saveToLocalStorage(true);
      return this.students[targetIndex];
    }
    return undefined;
  }

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

    pushEntityToRTDB("qeBookings", newBooking.id, newBooking);
    pushEntityToRTDB("tracks", booking.trackId, this.tracks.find((t) => t.id === booking.trackId));

    try {
      if (db) {
        setDoc(doc(db, "qe_bookings", newBooking.id), newBooking, { merge: true });
      }
    } catch (e) {
      console.warn("Firestore sync error:", e);
    }

    this.saveToLocalStorage(true);
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

    pushEntityToRTDB("qeResults", newResult.id, newResult);
    pushEntityToRTDB("qeBookings", booking.id, { ...booking, status: "evaluated" });

    this.saveToLocalStorage(true);
    return newResult;
  }

  public addAdvisorLog(log: Omit<AdvisorMeetingLog, "id">): AdvisorMeetingLog {
    const newLog: AdvisorMeetingLog = {
      ...log,
      id: `LOG-${Date.now().toString().slice(-4)}`,
    };
    this.advisorLogs = [newLog, ...this.advisorLogs];

    pushEntityToRTDB("advisorLogs", newLog.id, newLog);
    this.saveToLocalStorage(true);
    return newLog;
  }

  public updateAdvisorLogStatus(logId: string, status: 'approved' | 'rejected', feedback?: string): void {
    let updatedLog: AdvisorMeetingLog | undefined;
    this.advisorLogs = this.advisorLogs.map((log) => {
      if (log.id === logId) {
        updatedLog = {
          ...log,
          status,
          advisorFeedback: feedback || log.advisorFeedback,
          verifiedAt: new Date().toISOString(),
        };
        return updatedLog;
      }
      return log;
    });

    if (updatedLog) {
      pushEntityToRTDB("advisorLogs", logId, updatedLog);
    }
    this.saveToLocalStorage(true);
  }

  public addConferenceEvidence(evidence: Omit<ConferenceEvidence, "id">): ConferenceEvidence {
    const newEvidence: ConferenceEvidence = {
      ...evidence,
      id: `CONF-${Date.now().toString().slice(-4)}`,
    };
    this.conferenceEvidence = [newEvidence, ...this.conferenceEvidence];

    pushEntityToRTDB("conferenceEvidence", newEvidence.id, newEvidence);
    this.saveToLocalStorage(true);
    return newEvidence;
  }

  public updateConferenceStatus(evidenceId: string, status: 'verified' | 'rejected', rejectionReason?: string): void {
    let updatedEvidence: ConferenceEvidence | undefined;
    this.conferenceEvidence = this.conferenceEvidence.map((ev) => {
      if (ev.id === evidenceId) {
        updatedEvidence = {
          ...ev,
          status,
          rejectionReason,
          verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
        };
        return updatedEvidence;
      }
      return ev;
    });

    if (updatedEvidence) {
      pushEntityToRTDB("conferenceEvidence", evidenceId, updatedEvidence);
    }
    this.saveToLocalStorage(true);
  }
}

export const dbStore = AppDataStore.getInstance();
