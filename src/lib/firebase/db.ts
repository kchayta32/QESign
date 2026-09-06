// Data Access Layer: in-memory store + localStorage cache, synchronised with Firebase
// Realtime Database (source of truth) and mirrored best-effort to Firestore.
import {
  MOCK_TRACKS,
  MOCK_TEACHERS,
  MOCK_STUDENTS,
  MOCK_EXAM_ROUNDS,
  MOCK_QE_BOOKINGS,
  MOCK_QE_RESULTS,
  MOCK_ADVISOR_LOGS,
  MOCK_CONFERENCE_EVIDENCE,
  CURRENT_EVALUATION_ROUND,
  createRosterStudent
} from "@/lib/mock/seedData";
import { ADMIN_ACCOUNT, studentEmailFromCode } from "@/lib/institution";
import type {
  Track,
  Teacher,
  Student,
  AdminAccount,
  AccountSecurity,
  ExamRound,
  QEBooking,
  QEResult,
  AdvisorMeetingLog,
  ConferenceEvidence,
  ExaminerScoreItem,
  FinalExamEligibility,
  UserRole
} from "@/types";
import {
  evaluateQEResult,
  calculateFinalExamEligibility
} from "@/lib/rules/engine";
import { db, auth } from "./config";
import {
  CollectionName,
  subscribeToCollection,
  pushEntityToRTDB,
  pushManyToRTDB,
  rewriteCollectionKeyed,
  hasLegacyNumericKeys,
  stripUndefined,
  isCloudDisabled
} from "./rtdb";
import { doc, setDoc } from "firebase/firestore";

const LOCAL_STORAGE_KEY = "SSRU_CE_DATA_STORE_V4";

export const SEED_ADMINS: AdminAccount[] = [
  {
    id: ADMIN_ACCOUNT.id,
    code: ADMIN_ACCOUNT.code,
    email: ADMIN_ACCOUNT.email,
    displayName: ADMIN_ACCOUNT.displayName,
    profileCompleted: true,
    passwordChanged: false,
    authProvisioned: false,
  },
];

export type AccountKind = Exclude<UserRole, never>; // 'student' | 'teacher' | 'admin'

interface Identified {
  id: string;
}

/**
 * Registry merge: the seed defines which accounts exist; a cloud/cached record for the
 * same id always wins (it carries profile edits, password hashes, login state). Records
 * that exist only in the cloud are appended so nothing is ever dropped.
 */
export function mergeRegistry<T extends Identified>(seed: T[], overlay: T[]): T[] {
  if (!overlay || overlay.length === 0) return [...seed];
  const overlayById = new Map(overlay.map((item) => [item.id, item] as const));
  const merged: T[] = seed.map((s) => overlayById.get(s.id) ?? s);
  const seedIds = new Set(seed.map((s) => s.id));
  for (const item of overlay) {
    if (!seedIds.has(item.id)) merged.push(item);
  }
  return merged;
}

/**
 * Secondary mirror into Firestore. Firestore rules require an authenticated user, so the
 * mirror only runs when a Firebase Auth session exists (i.e. after Auth is enabled on the
 * project). The Realtime Database remains the authoritative store either way.
 */
function mirrorToFirestore(collection: string, id: string, data: unknown) {
  if (!db || !auth?.currentUser || isCloudDisabled()) return;
  setDoc(doc(db, collection, id), stripUndefined(data), { merge: true }).catch((e) => {
    console.debug(`Firestore mirror skipped for ${collection}/${id}:`, e?.code || e?.message);
  });
}

class AppDataStore {
  private static instance: AppDataStore;

  private tracks: Track[] = [...MOCK_TRACKS];
  private teachers: Teacher[] = [...MOCK_TEACHERS];
  private students: Student[] = [...MOCK_STUDENTS];
  private admins: AdminAccount[] = [...SEED_ADMINS];
  private examRounds: ExamRound[] = [...MOCK_EXAM_ROUNDS];
  private qeBookings: QEBooking[] = [...MOCK_QE_BOOKINGS];
  private qeResults: QEResult[] = [...MOCK_QE_RESULTS];
  private advisorLogs: AdvisorMeetingLog[] = [...MOCK_ADVISOR_LOGS];
  private conferenceEvidence: ConferenceEvidence[] = [...MOCK_CONFERENCE_EVIDENCE];

  private listeners: Set<() => void> = new Set();
  private cloudSynced: Partial<Record<CollectionName, boolean>> = {};
  private seedPushed: Partial<Record<CollectionName, boolean>> = {};
  private unsubscribers: Array<() => void> = [];

  private constructor() {
    if (typeof window !== "undefined") {
      this.loadFromLocalStorage();
      this.initRealtimeListeners();
    }
  }

  public static getInstance(): AppDataStore {
    if (!AppDataStore.instance) {
      AppDataStore.instance = new AppDataStore();
    }
    return AppDataStore.instance;
  }

  // ---------------------------------------------------------------------------
  // Cloud synchronisation
  // ---------------------------------------------------------------------------
  private initRealtimeListeners() {
    if (this.unsubscribers.length > 0) return;

    this.unsubscribers.push(
      subscribeToCollection<Teacher>("teachers", (items, raw, exists) => {
        this.teachers = mergeRegistry(MOCK_TEACHERS, items);
        this.afterCloudSnapshot("teachers", this.teachers, items, raw, exists);
      }),
      subscribeToCollection<Student>("students", (items, raw, exists) => {
        this.students = mergeRegistry(MOCK_STUDENTS, items);
        this.afterCloudSnapshot("students", this.students, items, raw, exists);
      }),
      subscribeToCollection<AdminAccount>("admins", (items, raw, exists) => {
        this.admins = mergeRegistry(SEED_ADMINS, items);
        this.afterCloudSnapshot("admins", this.admins, items, raw, exists);
      }),
      subscribeToCollection<QEBooking>("qeBookings", (items, raw, exists) => {
        this.qeBookings = exists ? items : this.qeBookings;
        this.afterCloudSnapshot("qeBookings", this.qeBookings, items, raw, exists);
      }),
      subscribeToCollection<QEResult>("qeResults", (items, raw, exists) => {
        this.qeResults = exists ? items : this.qeResults;
        this.afterCloudSnapshot("qeResults", this.qeResults, items, raw, exists);
      }),
      subscribeToCollection<AdvisorMeetingLog>("advisorLogs", (items, raw, exists) => {
        this.advisorLogs = exists ? items : this.advisorLogs;
        this.afterCloudSnapshot("advisorLogs", this.advisorLogs, items, raw, exists);
      }),
      subscribeToCollection<ConferenceEvidence>("conferenceEvidence", (items, raw, exists) => {
        this.conferenceEvidence = exists ? items : this.conferenceEvidence;
        this.afterCloudSnapshot("conferenceEvidence", this.conferenceEvidence, items, raw, exists);
      })
    );
  }

  /**
   * Runs after every cloud snapshot: persists the cache, notifies React, and — once per
   * session — heals the cloud layout (legacy numeric keys) and uploads seed records that
   * the cloud does not have yet (e.g. the pre-registered student roster).
   */
  private afterCloudSnapshot<T extends Identified>(
    name: CollectionName,
    merged: T[],
    cloudItems: T[],
    raw: unknown,
    exists: boolean
  ) {
    this.cloudSynced[name] = true;
    this.saveToLocalStorage();
    this.notifyListeners();

    if (this.seedPushed[name]) return;
    this.seedPushed[name] = true;

    if (exists && hasLegacyNumericKeys(raw)) {
      // One-time migration from array-indexed layout to id-keyed layout.
      void rewriteCollectionKeyed(name, merged);
      return;
    }

    const cloudIds = new Set(cloudItems.map((i) => i.id));
    const missing = merged.filter((i) => !cloudIds.has(i.id));
    if (missing.length > 0) {
      void pushManyToRTDB(name, missing);
    }
  }

  public isCloudSynced(name: CollectionName): boolean {
    return !!this.cloudSynced[name];
  }

  // ---------------------------------------------------------------------------
  // Local cache
  // ---------------------------------------------------------------------------
  private loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.teachers)) this.teachers = mergeRegistry(MOCK_TEACHERS, parsed.teachers);
      if (Array.isArray(parsed.students)) this.students = mergeRegistry(MOCK_STUDENTS, parsed.students);
      if (Array.isArray(parsed.admins)) this.admins = mergeRegistry(SEED_ADMINS, parsed.admins);
      if (Array.isArray(parsed.qeBookings)) this.qeBookings = parsed.qeBookings;
      if (Array.isArray(parsed.qeResults)) this.qeResults = parsed.qeResults;
      if (Array.isArray(parsed.advisorLogs)) this.advisorLogs = parsed.advisorLogs;
      if (Array.isArray(parsed.conferenceEvidence)) this.conferenceEvidence = parsed.conferenceEvidence;
    } catch (e) {
      console.warn("Could not load cached data, using seed data:", e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        teachers: this.teachers,
        students: this.students,
        admins: this.admins,
        qeBookings: this.qeBookings,
        qeResults: this.qeResults,
        advisorLogs: this.advisorLogs,
        conferenceEvidence: this.conferenceEvidence,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Could not persist local cache:", e);
    }
  }

  /** Persist + broadcast after a local mutation. */
  private commit() {
    this.saveToLocalStorage();
    this.notifyListeners();
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

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------
  /** Tracks with live seat usage computed from non-cancelled QE bookings. */
  public getTracks(): Track[] {
    return this.tracks.map((t) => ({
      ...t,
      activeBookingsCount: this.qeBookings.filter((b) => b.trackId === t.id && b.status !== "cancelled").length,
    }));
  }

  public getTeachers(): Teacher[] {
    return this.teachers;
  }

  public getStudents(): Student[] {
    return this.students;
  }

  public getAdmins(): AdminAccount[] {
    return this.admins;
  }

  public getStudentById(studentId: string): Student | undefined {
    return this.students.find((s) => s.id === studentId || s.studentCode === studentId);
  }

  public getTeacherById(teacherId: string): Teacher | undefined {
    return this.teachers.find((t) => t.id === teacherId || t.teacherCode === teacherId);
  }

  public getAdminById(adminId: string): AdminAccount | undefined {
    return this.admins.find((a) => a.id === adminId || a.code === adminId);
  }

  public getTeacherDisplayName(teacherId?: string): string {
    if (!teacherId) return "ยังไม่ระบุ";
    if (teacherId.startsWith("CUSTOM-")) return teacherId.replace("CUSTOM-", "");
    const t = this.getTeacherById(teacherId);
    return t ? `${t.prefixTh}${t.firstNameTh} ${t.lastNameTh}` : "ยังไม่ระบุ";
  }

  public getExamRounds(): ExamRound[] {
    return this.examRounds;
  }

  public getActiveRound(type: ExamRound["type"]): ExamRound | undefined {
    return this.examRounds.find((r) => r.type === type && r.isActive) || this.examRounds.find((r) => r.type === type);
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
    const student = this.getStudentById(studentId) || createRosterStudent(studentId.replace(/^STD-/, ""));
    const logs = this.getAdvisorLogs(student.id);
    const qeResult = this.getQEResultByStudent(student.id);
    const evidence = this.getConferenceEvidence(student.id);
    const conf = evidence.find((c) => c.status === "verified") || evidence.find((c) => c.status === "pending") || evidence[0] || null;
    return calculateFinalExamEligibility(student, logs, qeResult, conf);
  }

  // ---------------------------------------------------------------------------
  // Account mutations
  // ---------------------------------------------------------------------------
  public upsertStudent(student: Student): Student {
    const idx = this.students.findIndex((s) => s.id === student.id || s.studentCode === student.studentCode);
    if (idx >= 0) this.students[idx] = student;
    else this.students = [...this.students, student];
    void pushEntityToRTDB("students", student.id, student);
    mirrorToFirestore("students", student.id, student);
    this.commit();
    return student;
  }

  /** Admin: add a student code that is not part of the seeded roster. */
  public addStudentToRoster(studentCode: string): { ok: boolean; student?: Student; error?: string } {
    const code = studentCode.trim();
    if (!/^\d{11}$/.test(code)) return { ok: false, error: "รหัสนักศึกษาต้องเป็นตัวเลข 11 หลัก" };
    if (this.getStudentById(code)) return { ok: false, error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" };
    const student = createRosterStudent(code);
    student.email = studentEmailFromCode(code);
    return { ok: true, student: this.upsertStudent(student) };
  }

  public updateStudentProfile(studentId: string, updates: Partial<Student>): Student | undefined {
    const idx = this.students.findIndex((s) => s.id === studentId || s.studentCode === studentId);
    if (idx < 0) return undefined;
    const updated: Student = { ...this.students[idx], ...updates };
    this.students[idx] = updated;
    void pushEntityToRTDB("students", updated.id, updated);
    mirrorToFirestore("students", updated.id, updated);
    this.commit();
    return updated;
  }

  public updateTeacherProfile(teacherId: string, updates: Partial<Teacher>): Teacher | undefined {
    const idx = this.teachers.findIndex((t) => t.id === teacherId || t.teacherCode === teacherId);
    if (idx < 0) return undefined;
    const updated: Teacher = { ...this.teachers[idx], ...updates };
    this.teachers[idx] = updated;
    void pushEntityToRTDB("teachers", updated.id, updated);
    mirrorToFirestore("teachers", updated.id, updated);
    this.commit();
    return updated;
  }

  public updateAdminProfile(adminId: string, updates: Partial<AdminAccount>): AdminAccount | undefined {
    const idx = this.admins.findIndex((a) => a.id === adminId || a.code === adminId);
    if (idx < 0) return undefined;
    const updated: AdminAccount = { ...this.admins[idx], ...updates };
    this.admins[idx] = updated;
    void pushEntityToRTDB("admins", updated.id, updated);
    this.commit();
    return updated;
  }

  /** Credential / login-state update for any account type. */
  public updateAccountSecurity(
    kind: AccountKind,
    id: string,
    updates: Partial<AccountSecurity> & { uid?: string }
  ): Student | Teacher | AdminAccount | undefined {
    if (kind === "student") return this.updateStudentProfile(id, updates);
    if (kind === "teacher") return this.updateTeacherProfile(id, updates);
    return this.updateAdminProfile(id, updates);
  }

  /** Admin action: revert an account to the default password (= its login code). */
  public resetPasswordToDefault(kind: AccountKind, id: string) {
    return this.updateAccountSecurity(kind, id, { passwordHash: undefined, passwordChanged: false });
  }

  /** Advisor confirms/revokes the 3-chapter proposal exam (QE prerequisite). */
  public setStudentPassed3Chapter(studentId: string, passed: boolean): Student | undefined {
    return this.updateStudentProfile(studentId, { passed3Chapter: passed });
  }

  // ---------------------------------------------------------------------------
  // QE booking & evaluation
  // ---------------------------------------------------------------------------
  public createQEBooking(booking: Omit<QEBooking, "id">): QEBooking {
    const newBooking: QEBooking = {
      ...booking,
      id: `BK-QE-${Date.now().toString(36).toUpperCase()}`,
    };
    this.qeBookings = [newBooking, ...this.qeBookings];
    void pushEntityToRTDB("qeBookings", newBooking.id, newBooking);
    mirrorToFirestore("qe_bookings", newBooking.id, newBooking);
    this.commit();
    return newBooking;
  }

  public cancelQEBooking(bookingId: string): QEBooking | undefined {
    let updated: QEBooking | undefined;
    this.qeBookings = this.qeBookings.map((b) => {
      if (b.id !== bookingId) return b;
      updated = { ...b, status: "cancelled" };
      return updated;
    });
    if (updated) {
      void pushEntityToRTDB("qeBookings", updated.id, updated);
      mirrorToFirestore("qe_bookings", updated.id, updated);
      this.commit();
    }
    return updated;
  }

  public updateExaminerEvaluation(bookingId: string, examinerScores: ExaminerScoreItem[]): QEResult {
    const booking = this.qeBookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    const evaluation = evaluateQEResult(examinerScores);
    const round = this.examRounds.find((r) => r.id === booking.roundId);
    const evaluationRound = round ? `${round.semester}/${round.academicYear}` : CURRENT_EVALUATION_ROUND;

    const existingIndex = this.qeResults.findIndex((r) => r.bookingId === bookingId);
    const newResult: QEResult = {
      id: existingIndex >= 0 ? this.qeResults[existingIndex].id : `RES-QE-${Date.now().toString(36).toUpperCase()}`,
      bookingId,
      studentId: booking.studentId,
      studentCode: booking.studentCode,
      studentNameTh: booking.studentNameTh,
      trackId: booking.trackId,
      evaluationRound,
      examinerScores,
      totalExaminers: 3,
      passVotesCount: evaluation.passVotesCount,
      finalResult: evaluation.finalResult,
      averageScore: evaluation.averageScore,
      certifiedDate: new Date().toISOString().split("T")[0],
      announced: true,
    };

    if (existingIndex >= 0) this.qeResults[existingIndex] = newResult;
    else this.qeResults = [...this.qeResults, newResult];

    const updatedBooking: QEBooking = { ...booking, status: "evaluated" };
    this.qeBookings = this.qeBookings.map((b) => (b.id === bookingId ? updatedBooking : b));

    void pushEntityToRTDB("qeResults", newResult.id, newResult);
    void pushEntityToRTDB("qeBookings", updatedBooking.id, updatedBooking);
    mirrorToFirestore("qe_results", newResult.id, newResult);
    mirrorToFirestore("qe_bookings", updatedBooking.id, updatedBooking);

    // Keep the student's passedQE flag in step with the committee decision.
    const student = this.getStudentById(booking.studentId);
    if (student && student.passedQE !== (evaluation.finalResult === "passed")) {
      this.updateStudentProfile(student.id, { passedQE: evaluation.finalResult === "passed" });
    } else {
      this.commit();
    }
    return newResult;
  }

  // ---------------------------------------------------------------------------
  // Advisor logs & conference evidence
  // ---------------------------------------------------------------------------
  public addAdvisorLog(log: Omit<AdvisorMeetingLog, "id">): AdvisorMeetingLog {
    const newLog: AdvisorMeetingLog = { ...log, id: `LOG-${Date.now().toString(36).toUpperCase()}` };
    this.advisorLogs = [newLog, ...this.advisorLogs];
    void pushEntityToRTDB("advisorLogs", newLog.id, newLog);
    mirrorToFirestore("advisor_meeting_logs", newLog.id, newLog);
    this.commit();
    return newLog;
  }

  public updateAdvisorLogStatus(logId: string, status: "approved" | "rejected", feedback?: string): void {
    let updatedLog: AdvisorMeetingLog | undefined;
    this.advisorLogs = this.advisorLogs.map((log) => {
      if (log.id !== logId) return log;
      updatedLog = {
        ...log,
        status,
        advisorFeedback: feedback || log.advisorFeedback,
        verifiedAt: new Date().toISOString(),
      };
      return updatedLog;
    });
    if (updatedLog) {
      void pushEntityToRTDB("advisorLogs", logId, updatedLog);
      mirrorToFirestore("advisor_meeting_logs", logId, updatedLog);
    }
    this.commit();
  }

  public addConferenceEvidence(evidence: Omit<ConferenceEvidence, "id">): ConferenceEvidence {
    const newEvidence: ConferenceEvidence = { ...evidence, id: `CONF-${Date.now().toString(36).toUpperCase()}` };
    this.conferenceEvidence = [newEvidence, ...this.conferenceEvidence];
    void pushEntityToRTDB("conferenceEvidence", newEvidence.id, newEvidence);
    mirrorToFirestore("conference_evidence", newEvidence.id, newEvidence);
    this.commit();
    return newEvidence;
  }

  public updateConferenceStatus(
    evidenceId: string,
    status: "verified" | "rejected",
    rejectionReason?: string,
    reviewer?: Teacher
  ): void {
    let updatedEvidence: ConferenceEvidence | undefined;
    this.conferenceEvidence = this.conferenceEvidence.map((ev) => {
      if (ev.id !== evidenceId) return ev;
      updatedEvidence = {
        ...ev,
        status,
        rejectionReason: status === "rejected" ? rejectionReason : undefined,
        verifiedAt: status === "verified" ? new Date().toISOString() : undefined,
        reviewedByAdvisorId: reviewer?.id ?? ev.reviewedByAdvisorId,
        reviewedByAdvisorName: reviewer ? `${reviewer.prefixTh}${reviewer.firstNameTh} ${reviewer.lastNameTh}` : ev.reviewedByAdvisorName,
      };
      return updatedEvidence;
    });
    if (updatedEvidence) {
      void pushEntityToRTDB("conferenceEvidence", evidenceId, updatedEvidence);
      mirrorToFirestore("conference_evidence", evidenceId, updatedEvidence);
    }
    this.commit();
  }
}

export const dbStore = AppDataStore.getInstance();
