"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserRole, Student, Teacher } from "@/types";
import { dbStore } from "@/lib/firebase/db";

interface AuthContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentStudent: Student;
  setCurrentStudent: (student: Student) => void;
  currentTeacher: Teacher;
  setCurrentTeacher: (teacher: Teacher) => void;
  allStudents: Student[];
  allTeachers: Teacher[];
  selectStudentById: (studentId: string) => void;
  selectTeacherById: (teacherId: string) => void;
  resetAllData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>(dbStore.getStudents());
  const [teachers, setTeachers] = useState<Teacher[]>(dbStore.getTeachers());
  const [role, setRole] = useState<UserRole>("student");
  const [currentStudent, setCurrentStudent] = useState<Student>(students[0]);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher>(teachers[0]);

  useEffect(() => {
    const unsubscribe = dbStore.subscribe(() => {
      const updatedStudents = dbStore.getStudents();
      const updatedTeachers = dbStore.getTeachers();
      setStudents(updatedStudents);
      setTeachers(updatedTeachers);

      // Keep active student and teacher in sync
      const currentS = updatedStudents.find((s) => s.id === currentStudent?.id);
      if (currentS) setCurrentStudent(currentS);

      const currentT = updatedTeachers.find((t) => t.id === currentTeacher?.id);
      if (currentT) setCurrentTeacher(currentT);
    });

    return () => unsubscribe();
  }, [currentStudent?.id, currentTeacher?.id]);

  const selectStudentById = (studentId: string) => {
    const target = students.find((s) => s.id === studentId);
    if (target) {
      setCurrentStudent(target);
      setRole("student");
    }
  };

  const selectTeacherById = (teacherId: string) => {
    const target = teachers.find((t) => t.id === teacherId);
    if (target) {
      setCurrentTeacher(target);
      setRole("teacher");
    }
  };

  const resetAllData = () => {
    dbStore.resetToDefault();
    const freshStudents = dbStore.getStudents();
    const freshTeachers = dbStore.getTeachers();
    setStudents(freshStudents);
    setTeachers(freshTeachers);
    setCurrentStudent(freshStudents[0]);
    setCurrentTeacher(freshTeachers[0]);
    setRole("student");
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        currentStudent,
        setCurrentStudent,
        currentTeacher,
        setCurrentTeacher,
        allStudents: students,
        allTeachers: teachers,
        selectStudentById,
        selectTeacherById,
        resetAllData,
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
