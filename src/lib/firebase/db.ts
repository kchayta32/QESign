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
  ProjectDocument,
  ProjectDocumentType,
  UserRole
} from "@/types";
import {
  evaluateQEResult,
  calculateFinalExamEligibility,
  getLatestDocument,
  isDocumentStageApproved,
  checkQEBookingPrerequisite,
  checkDocumentSubmissionPrerequisite
} from "@/lib/rules/engine";
import { db, auth } from "./config";
import {
  CollectionName,
  subscribeToCollection,
  pushEntityToRTDB,
  pushManyToRTDB,
  persistChanges,
  toSafeKey,
  rewriteCollectionKeyed,
  hasLegacyNumericKeys,
  stripUndefined,
  isCloudDisabled
} from "./rtdb";
import { doc, setDoc } from "firebase/firestore";

// V5: drops caches that still contain the (now disabled) demo bookings/results.
const LOCAL_STORAGE_KEY = "SSRU_CE_DATA_STORE_V5";

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
  private projectDocuments: ProjectDocument[] = [];

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

    // Account registries: seed defines which accounts exist, cloud records win per id.
    // Transactional collections (bookings, results, logs, evidence): the cloud is the single
    // source of truth — an empty/missing node means "no records", never "keep the cache".
    this.unsubscribers.push(
      subscribeToCollection<Teacher>("teachers", (items, raw, exists) => {
        this.teachers = mergeRegistry(MOCK_TEACHERS, items);
        this.afterCloudSnapshot("teachers", this.teachers, MOCK_TEACHERS, items, raw, exists);
      }),
      subscribeToCollection<Student>("students", (items, raw, exists) => {
        this.students = mergeRegistry(MOCK_STUDENTS, items);
        this.afterCloudSnapshot("students", this.students, MOCK_STUDENTS, items, raw, exists);
      }),
      subscribeToCollection<AdminAccount>("admins", (items, raw, exists) => {
        this.admins = mergeRegistry(SEED_ADMINS, items);
        this.afterCloudSnapshot("admins", this.admins, SEED_ADMINS, items, raw, exists);
      }),
      subscribeToCollection<QEBooking>("qeBookings", (items, raw, exists) => {
        this.qeBookings = items;
        this.afterCloudSnapshot("qeBookings", this.qeBookings, MOCK_QE_BOOKINGS, items, raw, exists);
      }),
      subscribeToCollection<QEResult>("qeResults", (items, raw, exists) => {
        this.qeResults = items;
        this.afterCloudSnapshot("qeResults", this.qeResults, MOCK_QE_RESULTS, items, raw, exists);
      }),
      subscribeToCollection<AdvisorMeetingLog>("advisorLogs", (items, raw, exists) => {
        this.advisorLogs = items;
        this.afterCloudSnapshot("advisorLogs", this.advisorLogs, MOCK_ADVISOR_LOGS, items, raw, exists);
      }),
      subscribeToCollection<ConferenceEvidence>("conferenceEvidence", (items, raw, exists) => {
        this.conferenceEvidence = items;
        this.afterCloudSnapshot("conferenceEvidence", this.conferenceEvidence, MOCK_CONFERENCE_EVIDENCE, items, raw, exists);
      }),
      subscribeToCollection<ProjectDocument>("projectDocuments", (items, raw, exists) => {
        this.projectDocuments = items;
        this.afterCloudSnapshot("projectDocuments", this.projectDocuments, [], items, raw, exists);
      })
    );
  }

  /**
   * Runs after every cloud snapshot: persists the cache, notifies React, and — once per
   * session — heals the cloud layout (legacy numeric keys) and uploads *seed* records that
   * the cloud does not have yet (e.g. the pre-registered student roster).
   *
   * Only records defined in code (`seed`) are ever back-filled. Records that merely sit in
   * a browser's localStorage cache must never be re-uploaded, otherwise data an admin has
   * deleted from the cloud would silently reappear from any stale client.
   */
  private afterCloudSnapshot<T extends Identified>(
    name: CollectionName,
    current: T[],
    seed: T[],
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
      void rewriteCollectionKeyed(name, current);
      return;
    }

    const cloudIds = new Set(cloudItems.map((i) => i.id));
    const missing = seed.filter((i) => !cloudIds.has(i.id));
    if (missing.length > 0) {
      void pushManyToRTDB(name, missing);
    }
  }

  public isCloudSynced(name: CollectionName): boolean {
    return !!this.cloudSynced[name];
  }

  /**
   * Resolve once every listed collection has received its first cloud snapshot (or
   * immediately when the cloud is intentionally disabled, e.g. in local test runs).
   * Resolves `false` on timeout so callers can refuse security-sensitive operations
   * that must not run against seed/cached data alone.
   */
  public waitForCloudSync(names: CollectionName[], timeoutMs: number = 8000): Promise<boolean> {
    if (isCloudDisabled() || typeof window === "undefined") return Promise.resolve(true);
    if (names.every((n) => this.cloudSynced[n])) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(ok);
      };
      const unsubscribe = this.subscribe(() => {
        if (names.every((n) => this.cloudSynced[n])) finish(true);
      });
      const timer = setTimeout(() => finish(false), timeoutMs);
    });
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
      if (Array.isArray(parsed.projectDocuments)) this.projectDocuments = parsed.projectDocuments;
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
        projectDocuments: this.projectDocuments,
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

  /**
   * A student's bookings, newest first. Cloud snapshots arrive keyed by id (oldest first),
   * so callers must not rely on insertion order — sort explicitly.
   */
  public getQEBookingsByStudent(studentId: string): QEBooking[] {
    return this.qeBookings
      .filter((b) => b.studentId === studentId || b.studentCode === studentId)
      .sort((a, b) => (b.submissionDate || "").localeCompare(a.submissionDate || "") || b.id.localeCompare(a.id));
  }

  public getQEResults(): QEResult[] {
    return this.qeResults;
  }

  public getQEResultByBooking(bookingId: string): QEResult | undefined {
    return this.qeResults.find((r) => r.bookingId === bookingId);
  }

  /**
   * The result that counts for a student: a passed result wins over any failed attempt,
   * otherwise the most recent one (cloud order is by id, not by time).
   */
  public getQEResultByStudent(studentId: string): QEResult | undefined {
    const mine = this.qeResults
      .filter((r) => r.studentId === studentId || r.studentCode === studentId)
      .sort((a, b) => (b.certifiedDate || "").localeCompare(a.certifiedDate || "") || b.id.localeCompare(a.id));
    return mine.find((r) => r.finalResult === "passed") || mine[0];
  }

  /** Active (not cancelled, not yet evaluated) QE booking of a student in any round. */
  public getOpenQEBookingByStudent(studentId: string): QEBooking | undefined {
    return this.getQEBookingsByStudent(studentId).find((b) => b.status !== "cancelled" && b.status !== "evaluated");
  }

  // ---------------------------------------------------------------------------
  // Project documents (Proposal / สอบ 3 บท / สอบ 5 บท)
  // ---------------------------------------------------------------------------
  public getProjectDocuments(studentId?: string): ProjectDocument[] {
    const list = studentId
      ? this.projectDocuments.filter((d) => d.studentId === studentId || d.studentCode === studentId)
      : this.projectDocuments;
    return [...list].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "") || b.id.localeCompare(a.id));
  }

  public getLatestProjectDocument(studentId: string, type: ProjectDocumentType): ProjectDocument | undefined {
    return getLatestDocument(this.getProjectDocuments(studentId), type);
  }

  /** Documents waiting for a given advisor (or for everyone when no advisor is given). */
  public getPendingProjectDocuments(advisorId?: string): ProjectDocument[] {
    return this.getProjectDocuments().filter((d) => d.status === "submitted" && (!advisorId || d.advisorId === advisorId));
  }

  /** Id for a new document; generated before the PDF is uploaded so the file can be keyed by it. */
  public newProjectDocumentId(type: ProjectDocumentType): string {
    return `DOC-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  public nextProjectDocumentVersion(studentId: string, type: ProjectDocumentType): number {
    const latest = this.getLatestProjectDocument(studentId, type);
    return (latest?.version || 0) + 1;
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

  /** Profile form waits only for the small primary-database write, not optional mirrors. */
  public async saveProfile(kind: "student" | "teacher", id: string, updates: Partial<Student> | Partial<Teacher>): Promise<void> {
    const entity = kind === "student" ? this.getStudentById(id) : this.getTeacherById(id);
    if (!entity) throw new Error("ไม่พบบัญชีผู้ใช้งาน");
    const collection = kind === "student" ? "students" : "teachers";
    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) changes[`${collection}/${toSafeKey(entity.id)}/${key}`] = value;
    }
    await persistChanges(changes);
    if (kind === "student") this.students = this.students.map((s) => s.id === entity.id ? { ...s, ...updates } as Student : s);
    else this.teachers = this.teachers.map((t) => t.id === entity.id ? { ...t, ...updates } as Teacher : t);
    mirrorToFirestore(collection, entity.id, updates);
    this.commit();
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
  // Project document submissions & review
  // ---------------------------------------------------------------------------
  /**
   * Record a submitted PDF (the file itself has already been persisted under `fileRef`).
   * The caller supplies the id it used to upload the file; the version is assigned here.
   */
  public async submitProjectDocument(
    input: Omit<ProjectDocument, "version" | "status" | "submittedAt" | "reviewerId" | "reviewerName" | "reviewFeedback" | "reviewedAt">
  ): Promise<ProjectDocument> {
    const student = this.getStudentById(input.studentId);
    if (!student) throw new Error("ไม่พบนักศึกษา");
    const prerequisite = checkDocumentSubmissionPrerequisite(student, this.getProjectDocuments(student.id), input.docType);
    if (!prerequisite.canSubmit) throw new Error(prerequisite.reasonTh);
    const doc: ProjectDocument = {
      ...input,
      version: this.nextProjectDocumentVersion(input.studentId, input.docType),
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
    await persistChanges({ [`projectDocuments/${toSafeKey(doc.id)}`]: doc });
    this.projectDocuments = [doc, ...this.projectDocuments.filter((d) => d.id !== doc.id)];
    mirrorToFirestore("project_documents", doc.id, doc);
    this.commit();
    return doc;
  }

  /** Student withdraws a submission that has not been reviewed yet. Returns the removed record. */
  public async withdrawProjectDocument(docId: string): Promise<ProjectDocument | undefined> {
    const doc = this.projectDocuments.find((d) => d.id === docId);
    if (!doc || doc.status !== "submitted") return undefined;
    await persistChanges({ [`projectDocuments/${toSafeKey(docId)}`]: null });
    this.projectDocuments = this.projectDocuments.filter((d) => d.id !== docId);
    this.commit();
    return doc;
  }

  /**
   * Advisor records the exam result for a document. Approving the chapter3 document is what
   * marks the 3-chapter exam as passed (and unlocks QE booking); rejecting an approved
   * chapter3 document revokes it. chapter5 approval is tracked the same way.
   */
  public async reviewProjectDocument(
    docId: string,
    decision: "approved" | "rejected",
    reviewer: Teacher,
    feedback?: string
  ): Promise<ProjectDocument | undefined> {
    const doc = this.projectDocuments.find((d) => d.id === docId);
    if (!doc) return undefined;
    if (decision === "rejected" && !feedback?.trim()) throw new Error("กรุณาระบุเหตุผลที่ไม่ผ่าน");
    const updated: ProjectDocument = {
      ...doc,
      status: decision,
      reviewerId: reviewer.id,
      reviewerName: `${reviewer.prefixTh}${reviewer.firstNameTh} ${reviewer.lastNameTh}`,
      reviewFeedback: feedback?.trim() || undefined,
      reviewedAt: new Date().toISOString(),
    };
    const student = this.getStudentById(doc.studentId);
    const docs = this.getProjectDocuments(doc.studentId).map((d) => d.id === docId ? updated : d);
    const flags: Partial<Student> = {};
    if (doc.docType === "chapter3") flags.passed3Chapter = isDocumentStageApproved(docs, "chapter3");
    if (doc.docType === "chapter5") flags.passed5Chapter = isDocumentStageApproved(docs, "chapter5");
    // One atomic write: a failed review cannot leave an exam flag unlocked in the cloud.
    const changes: Record<string, unknown> = { [`projectDocuments/${toSafeKey(docId)}`]: updated };
    if (student) {
      for (const [key, value] of Object.entries(flags)) changes[`students/${toSafeKey(student.id)}/${key}`] = value;
    }
    await persistChanges(changes);
    this.projectDocuments = this.projectDocuments.map((d) => d.id === docId ? updated : d);
    if (student) this.students = this.students.map((s) => s.id === student.id ? { ...s, ...flags } : s);
    mirrorToFirestore("project_documents", docId, updated);
    this.commit();
    return updated;
  }

  // ---------------------------------------------------------------------------
  // QE booking & evaluation
  // ---------------------------------------------------------------------------
  public createQEBooking(booking: Omit<QEBooking, "id">): QEBooking {
    const student = this.getStudentById(booking.studentId);
    if (!student) throw new Error("ไม่พบนักศึกษา");
    const prerequisite = checkQEBookingPrerequisite(student, booking.trackId, this.getProjectDocuments(student.id));
    if (!prerequisite.canBook) throw new Error(prerequisite.reasonTh);
    if (student.passedQE || this.getQEResultByStudent(student.id)?.finalResult === "passed") throw new Error("คุณผ่านการสอบ QE แล้ว");
    if (this.getOpenQEBookingByStudent(student.id)) throw new Error("มีคำร้องจองสอบที่ยังไม่ได้ประเมินผลอยู่แล้ว");
    const newBooking: QEBooking = {
      ...booking,
      id: `BK-QE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`,
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
      id: existingIndex >= 0 ? this.qeResults[existingIndex].id : `RES-QE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`,
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
    const passedQE = this.getQEResultByStudent(booking.studentId)?.finalResult === "passed";
    if (student && student.passedQE !== passedQE) {
      this.updateStudentProfile(student.id, { passedQE });
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
