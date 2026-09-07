"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { UserRole, Student, Teacher, AdminAccount } from "@/types";
import { dbStore, AccountKind } from "@/lib/firebase/db";
import {
  loginAccount,
  logoutAccount,
  changeAccountPassword,
  setInitialPassword
} from "@/lib/firebase/authService";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  currentStudent: Student | null;
  currentTeacher: Teacher | null;
  currentAdmin: AdminAccount | null;
  /** True when the signed-in student/teacher has not completed the first-login profile form. */
  needsProfileSetup: boolean;
  allStudents: Student[];
  allTeachers: Teacher[];
  /** Increments on every data-store change (cloud snapshot or local mutation) — use as a memo dependency. */
  dataVersion: number;
  login: (identifier: string, password: string, selectedRole?: UserRole) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  logout: () => Promise<void>;
  completeStudentProfile: (updates: Partial<Student>, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  completeTeacherProfile: (updates: Partial<Teacher>, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "SSRU_CE_AUTH_SESSION_V2";

interface StoredSession {
  role: UserRole;
  entityId: string;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.role === "string" && typeof parsed.entityId === "string") return parsed;
  } catch {
    /* ignore corrupt session */
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [session, setSession] = useState<StoredSession | null>(null);
  // Bumped on every store change so derived "current*" values re-resolve.
  const [storeVersion, setStoreVersion] = useState(0);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    setStudents(dbStore.getStudents());
    setTeachers(dbStore.getTeachers());
    setSession(readStoredSession());
    setIsLoading(false);

    const unsubscribe = dbStore.subscribe(() => {
      setStudents(dbStore.getStudents());
      setTeachers(dbStore.getTeachers());
      setStoreVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Resolve the active account from the (live) store so profile edits & cloud updates show immediately.
  const { currentStudent, currentTeacher, currentAdmin, role, isAuthenticated } = useMemo(() => {
    void storeVersion;
    if (!session) {
      return { currentStudent: null, currentTeacher: null, currentAdmin: null, role: null as UserRole | null, isAuthenticated: false };
    }
    if (session.role === "student") {
      const s = dbStore.getStudentById(session.entityId) || null;
      return { currentStudent: s, currentTeacher: null, currentAdmin: null, role: s ? ("student" as UserRole) : null, isAuthenticated: !!s };
    }
    if (session.role === "teacher") {
      const t = dbStore.getTeacherById(session.entityId) || null;
      return { currentStudent: null, currentTeacher: t, currentAdmin: null, role: t ? ("teacher" as UserRole) : null, isAuthenticated: !!t };
    }
    const a = dbStore.getAdminById(session.entityId) || null;
    return { currentStudent: null, currentTeacher: null, currentAdmin: a, role: a ? ("admin" as UserRole) : null, isAuthenticated: !!a };
  }, [session, storeVersion]);

  const needsProfileSetup =
    profileSaving ||
    (role === "student" && !!currentStudent && !currentStudent.profileCompleted) ||
    (role === "teacher" && !!currentTeacher && !currentTeacher.profileCompleted);

  const persistSession = (next: StoredSession | null) => {
    setSession(next);
    if (next) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const login = useCallback(async (identifier: string, password: string, selectedRole?: UserRole) => {
    const result = await loginAccount(identifier, password, selectedRole);
    if (!result.success || !result.role || !result.entityId) {
      return { success: false, error: result.error || "เข้าสู่ระบบไม่สำเร็จ" };
    }
    persistSession({ role: result.role, entityId: result.entityId });
    return { success: true, role: result.role };
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    persistSession(null);
  }, []);

  const completeStudentProfile = useCallback(
    async (updates: Partial<Student>, newPassword?: string) => {
      if (!session || session.role !== "student") return { success: false, error: "ไม่พบบัญชีนักศึกษาที่เข้าสู่ระบบ" };
      setProfileSaving(!dbStore.getStudentById(session.entityId)?.profileCompleted);
      try {
        if (newPassword) {
          const pw = await setInitialPassword("student", session.entityId, newPassword);
          if (!pw.success) return pw;
        }
        await dbStore.saveProfile("student", session.entityId, { ...updates, profileCompleted: true });
        return { success: true };
      } finally {
        setProfileSaving(false);
      }
    },
    [session]
  );

  const completeTeacherProfile = useCallback(
    async (updates: Partial<Teacher>, newPassword?: string) => {
      if (!session || session.role !== "teacher") return { success: false, error: "ไม่พบบัญชีอาจารย์ที่เข้าสู่ระบบ" };
      setProfileSaving(!dbStore.getTeacherById(session.entityId)?.profileCompleted);
      try {
        if (newPassword) {
          const pw = await setInitialPassword("teacher", session.entityId, newPassword);
          if (!pw.success) return pw;
        }
        await dbStore.saveProfile("teacher", session.entityId, { ...updates, profileCompleted: true });
        return { success: true };
      } finally {
        setProfileSaving(false);
      }
    },
    [session]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!session) return { success: false, error: "กรุณาเข้าสู่ระบบก่อน" };
      return changeAccountPassword(session.role as AccountKind, session.entityId, currentPassword, newPassword);
    },
    [session]
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        role,
        currentStudent,
        currentTeacher,
        currentAdmin,
        needsProfileSetup,
        allStudents: students,
        allTeachers: teachers,
        dataVersion: storeVersion,
        login,
        logout,
        completeStudentProfile,
        completeTeacherProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
