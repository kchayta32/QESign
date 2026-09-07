import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { auth } from "./config";
import { dbStore, AccountKind } from "./db";
import { isCloudDisabled } from "./rtdb";
import { hashPassword, verifyPassword, validateNewPassword } from "@/lib/security/password";
import { studentEmailFromCode, studentCodeFromEmail } from "@/lib/institution";
import type { Student, Teacher, AdminAccount, AccountSecurity, UserRole } from "@/types";

/**
 * Authentication model
 * --------------------
 * Every account (student / teacher / admin) is pre-registered in the data store.
 *   • Login identifier : student code, teacher code (e-mail local part) or e-mail.
 *   • Default password : the account's code (e.g. 66122519001, parinwat.th).
 *   • Changed passwords are stored as a PBKDF2 hash on the account record in the
 *     Realtime Database, so verification does not depend on Firebase Auth being
 *     enabled. Firebase Auth is provisioned opportunistically (best effort) so that
 *     Firestore security rules can rely on request.auth once Auth is switched on.
 */

export interface ResolvedAccount {
  kind: AccountKind;
  id: string;
  code: string;
  email: string;
  displayName: string;
  security: AccountSecurity;
  needsProfileSetup: boolean;
}

export interface LoginResult {
  success: boolean;
  role?: UserRole;
  entityId?: string;
  needsProfileSetup?: boolean;
  error?: string;
}

const GENERIC_LOGIN_ERROR = "ไม่พบบัญชีผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูล";

function norm(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

function toResolved(kind: AccountKind, entity: Student | Teacher | AdminAccount): ResolvedAccount {
  if (kind === "student") {
    const s = entity as Student;
    return {
      kind,
      id: s.id,
      code: s.studentCode,
      email: s.email || studentEmailFromCode(s.studentCode),
      displayName: `${s.prefixTh} ${s.firstNameTh} ${s.lastNameTh}`.trim(),
      security: s,
      needsProfileSetup: !s.profileCompleted,
    };
  }
  if (kind === "teacher") {
    const t = entity as Teacher;
    return {
      kind,
      id: t.id,
      code: t.teacherCode,
      email: t.email,
      displayName: `${t.prefixTh}${t.firstNameTh} ${t.lastNameTh}`.trim(),
      security: t,
      needsProfileSetup: !t.profileCompleted,
    };
  }
  const a = entity as AdminAccount;
  return {
    kind,
    id: a.id,
    code: a.code,
    email: a.email,
    displayName: a.displayName,
    security: a,
    needsProfileSetup: false,
  };
}

/** Find the account matching a login identifier (code, id or e-mail; case-insensitive). */
export function resolveAccount(identifier: string): ResolvedAccount | undefined {
  const id = norm(identifier);
  if (!id) return undefined;

  const emailCode = studentCodeFromEmail(id);
  if (emailCode) {
    const student = dbStore.getStudentById(emailCode);
    return student ? toResolved("student", student) : undefined;
  }

  const student = dbStore.getStudents().find(
    (s) =>
      norm(s.studentCode) === id ||
      norm(s.id) === id ||
      norm(s.email) === id ||
      norm(studentEmailFromCode(s.studentCode)) === id
  );
  if (student) return toResolved("student", student);

  const teacher = dbStore.getTeachers().find(
    (t) => norm(t.teacherCode) === id || norm(t.id) === id || norm(t.email) === id
  );
  if (teacher) return toResolved("teacher", teacher);

  const admin = dbStore.getAdmins().find(
    (a) => norm(a.code) === id || norm(a.id) === id || norm(a.email) === id
  );
  if (admin) return toResolved("admin", admin);

  return undefined;
}

/** Password check: stored hash if present, otherwise the default-password rule. */
export async function verifyAccountPassword(account: ResolvedAccount, password: string): Promise<boolean> {
  if (!password) return false;
  if (account.security.passwordHash) {
    return verifyPassword(password, account.code, account.security.passwordHash);
  }
  return password === account.code;
}

/**
 * Remembered for the lifetime of the page once Firebase Auth reports that the provider is
 * not configured on the project, so later logins skip the pointless network round-trip.
 */
let firebaseAuthUnavailable = false;

/**
 * Best-effort Firebase Auth sync. Never throws; returns the Firebase uid when a session
 * was established. Silently skips when Auth is disabled on the project
 * (auth/configuration-not-found) or the network is unavailable.
 */
async function syncFirebaseAuth(account: ResolvedAccount, password: string): Promise<string | undefined> {
  if (!auth || isCloudDisabled() || firebaseAuthUnavailable) return undefined;
  try {
    const cred = await signInWithEmailAndPassword(auth, account.email, password);
    return cred.user.uid;
  } catch (err: any) {
    const code: string = err?.code || "";
    if (code === "auth/configuration-not-found" || code === "auth/operation-not-allowed") {
      firebaseAuthUnavailable = true;
      console.debug("Firebase Auth is not enabled on this project; using database credentials only.");
      return undefined;
    }
    const canCreate =
      !account.security.authProvisioned &&
      (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials");
    if (!canCreate) {
      if (code && !["auth/wrong-password", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(code)) {
        console.debug("Firebase Auth unavailable, continuing with database credentials:", code);
      }
      return undefined;
    }
    try {
      const created = await createUserWithEmailAndPassword(auth, account.email, password);
      await updateProfile(created.user, { displayName: account.displayName }).catch(() => undefined);
      return created.user.uid;
    } catch (createErr: any) {
      console.debug("Firebase Auth provisioning skipped:", createErr?.code || createErr?.message);
      return undefined;
    }
  }
}

/**
 * Login with student code / teacher code / e-mail + password.
 */
export async function loginAccount(identifier: string, password: string, selectedRole?: UserRole): Promise<LoginResult> {
  try {
    if (studentCodeFromEmail(identifier) && selectedRole && selectedRole !== "student") {
      return { success: false, error: "อีเมลรหัสนักศึกษา 11 หลัก @ssru.ac.th ต้องเลือกประเภทนักศึกษา" };
    }
    // Credentials live in the cloud records; never verify against seed/cached data alone
    // (otherwise a changed password could be bypassed with the default code on a fresh device).
    const synced = await dbStore.waitForCloudSync(["students", "teachers", "admins"]);
    if (!synced) {
      return {
        success: false,
        error: "ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
      };
    }

    const account = resolveAccount(identifier);
    if (!account) return { success: false, error: GENERIC_LOGIN_ERROR };
    if (selectedRole && selectedRole !== account.kind) {
      return { success: false, error: "ประเภทผู้ใช้งานไม่ตรงกับบัญชี กรุณาเลือกประเภทผู้ใช้งานให้ถูกต้อง" };
    }

    const ok = await verifyAccountPassword(account, password);
    if (!ok) return { success: false, error: GENERIC_LOGIN_ERROR };

    const uid = await syncFirebaseAuth(account, password);
    const securityUpdate: Partial<AccountSecurity> & { uid?: string } = {
      lastLoginAt: new Date().toISOString(),
    };
    if (uid) {
      securityUpdate.authProvisioned = true;
      securityUpdate.uid = uid;
    }
    dbStore.updateAccountSecurity(account.kind, account.id, securityUpdate);

    return {
      success: true,
      role: account.kind,
      entityId: account.id,
      needsProfileSetup: account.needsProfileSetup,
    };
  } catch (err: any) {
    console.error("Login error:", err);
    return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" };
  }
}

/**
 * Change the password of the signed-in account. Verifies the current password first,
 * stores the new PBKDF2 hash in the database and (best effort) updates Firebase Auth.
 */
export async function changeAccountPassword(
  kind: AccountKind,
  entityId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const synced = await dbStore.waitForCloudSync(["students", "teachers", "admins"]);
  if (!synced) {
    return { success: false, error: "ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase ได้ กรุณาลองใหม่อีกครั้ง" };
  }

  const entity =
    kind === "student"
      ? dbStore.getStudentById(entityId)
      : kind === "teacher"
      ? dbStore.getTeacherById(entityId)
      : dbStore.getAdminById(entityId);
  if (!entity) return { success: false, error: "ไม่พบบัญชีผู้ใช้งาน" };

  const account = toResolved(kind, entity);
  const validation = validateNewPassword(newPassword);
  if (validation) return { success: false, error: validation };
  if (newPassword === account.code) {
    return { success: false, error: "รหัสผ่านใหม่ต้องไม่เหมือนกับรหัสประจำตัว (รหัสผ่านเริ่มต้น)" };
  }

  const ok = await verifyAccountPassword(account, currentPassword);
  if (!ok) return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

  const passwordHash = await hashPassword(newPassword, account.code);
  dbStore.updateAccountSecurity(kind, account.id, { passwordHash, passwordChanged: true });

  // Keep Firebase Auth in step when a session exists (ignored when Auth is disabled).
  try {
    if (auth?.currentUser && norm(auth.currentUser.email) === norm(account.email)) {
      const credential = EmailAuthProvider.credential(account.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
    }
  } catch (e: any) {
    console.debug("Firebase Auth password sync skipped:", e?.code || e?.message);
  }

  return { success: true };
}

/**
 * Set a brand-new password during first-login profile setup (no current password
 * prompt: the caller has just authenticated with the default password).
 */
export async function setInitialPassword(kind: AccountKind, entityId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const entity =
    kind === "student"
      ? dbStore.getStudentById(entityId)
      : kind === "teacher"
      ? dbStore.getTeacherById(entityId)
      : dbStore.getAdminById(entityId);
  if (!entity) return { success: false, error: "ไม่พบบัญชีผู้ใช้งาน" };
  const account = toResolved(kind, entity);

  const validation = validateNewPassword(newPassword);
  if (validation) return { success: false, error: validation };
  if (newPassword === account.code) {
    return { success: false, error: "รหัสผ่านใหม่ต้องไม่เหมือนกับรหัสประจำตัว (รหัสผ่านเริ่มต้น)" };
  }

  const passwordHash = await hashPassword(newPassword, account.code);
  if (kind === "student" || kind === "teacher") {
    await dbStore.saveProfile(kind, account.id, { passwordHash, passwordChanged: true });
  } else {
    dbStore.updateAccountSecurity(kind, account.id, { passwordHash, passwordChanged: true });
  }

  try {
    if (auth?.currentUser && norm(auth.currentUser.email) === norm(account.email)) {
      // Optional Auth mirror must not block first-login profile saving.
      void updatePassword(auth.currentUser, newPassword).catch((e) => {
        console.debug("Firebase Auth password sync skipped:", e?.code || e?.message);
      });
    }
  } catch (e: any) {
    console.debug("Firebase Auth password sync skipped:", e?.code || e?.message);
  }
  return { success: true };
}

export async function logoutAccount(): Promise<void> {
  try {
    if (auth?.currentUser) await signOut(auth);
  } catch (e) {
    console.warn("Logout notice:", e);
  }
}
