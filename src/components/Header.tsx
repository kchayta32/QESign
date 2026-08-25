"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  GraduationCap,
  Users,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ChevronDown,
  UserCheck,
  Building2,
  BookOpen
} from "lucide-react";
import { UserRole } from "@/types";

export default function Header() {
  const {
    role,
    setRole,
    currentStudent,
    currentTeacher,
    allStudents,
    allTeachers,
    selectStudentById,
    selectTeacherById,
    resetAllData,
  } = useAuth();

  const [showStudentMenu, setShowStudentMenu] = useState(false);
  const [showTeacherMenu, setShowTeacherMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm transition-all">
      {/* Top Banner with SSRU CE Crimson Branding */}
      <div className="bg-gradient-to-r from-ssru-crimson via-ssru-600 to-ssru-dark text-white px-4 py-2 text-xs md:text-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white/20 text-white border border-white/30 backdrop-blur-sm">
              SSRU CE System
            </span>
            <span className="hidden sm:inline font-medium">
              สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏสวนสุนันทา
            </span>
            <span className="sm:hidden font-medium">มรภ.สวนสุนันทา (วิศวกรรมคอมพิวเตอร์)</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={resetAllData}
              title="รีเซ็ตข้อมูลตัวอย่างกลับเป็นค่าเริ่มต้น"
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white border border-white/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ตข้อมูล Mock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo and System Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-ssru-crimson to-ssru-dark flex items-center justify-center text-white shadow-glow border border-ssru-light/40 flex-shrink-0">
              <GraduationCap className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base md:text-xl font-bold font-display text-neutral-charcoal leading-tight tracking-tight">
                  ระบบจองสอบ QE &amp; โครงงาน
                </h1>
                <span className="hidden md:inline-flex px-2 py-0.5 text-[11px] font-medium bg-red-50 text-ssru-crimson rounded-full border border-ssru-crimson/20">
                  CE-SSRU
                </span>
              </div>
              <p className="text-xs text-neutral-500 hidden sm:block">
                Qualifying Examination &amp; Final Project Defense Gate Management
              </p>
            </div>
          </div>

          {/* Role Switcher Tabs */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="bg-neutral-100 p-1 rounded-xl flex items-center border border-neutral-200 shadow-inner">
              {/* Student Role Tab */}
              <button
                onClick={() => setRole("student")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  role === "student"
                    ? "bg-white text-ssru-crimson shadow-sm border border-neutral-200"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span className="hidden sm:inline">นักศึกษา</span>
                <span className="sm:hidden">นศ.</span>
              </button>

              {/* Teacher Role Tab */}
              <button
                onClick={() => setRole("teacher")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  role === "teacher"
                    ? "bg-white text-ssru-crimson shadow-sm border border-neutral-200"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">อาจารย์ / กรรมการ</span>
                <span className="sm:hidden">อาจารย์</span>
              </button>

              {/* Admin Role Tab */}
              <button
                onClick={() => setRole("admin")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  role === "admin"
                    ? "bg-white text-ssru-crimson shadow-sm border border-neutral-200"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">ผู้ดูแลระบบ</span>
                <span className="sm:hidden">Admin</span>
              </button>
            </div>

            {/* Profile Menu Selector according to Role */}
            {role === "student" && (
              <div className="relative">
                <button
                  onClick={() => setShowStudentMenu(!showStudentMenu)}
                  className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl shadow-sm text-xs md:text-sm transition-all"
                >
                  <img
                    src={currentStudent?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                    alt={currentStudent?.firstNameTh}
                    className="w-7 h-7 rounded-full object-cover border border-neutral-200"
                  />
                  <div className="text-left hidden md:block">
                    <p className="font-semibold text-neutral-charcoal text-xs leading-none">
                      {currentStudent?.firstNameTh} {currentStudent?.lastNameTh}
                    </p>
                    <span className="text-[10px] text-neutral-500">
                      {currentStudent?.studentCode}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                </button>

                {/* Dropdown for selecting demo student profile */}
                {showStudentMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-neutral-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-neutral-100">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        สลับข้อมูลนักศึกษาตัวอย่าง
                      </p>
                    </div>
                    {allStudents.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          selectStudentById(s.id);
                          setShowStudentMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center space-x-3 hover:bg-neutral-50 transition-all ${
                          currentStudent.id === s.id ? "bg-red-50/70 border-l-4 border-ssru-crimson" : ""
                        }`}
                      >
                        <img
                          src={s.avatarUrl}
                          alt={s.firstNameTh}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-neutral-charcoal truncate">
                            {s.prefixTh} {s.firstNameTh} {s.lastNameTh}
                          </p>
                          <div className="flex items-center space-x-1.5 text-[11px] text-neutral-500">
                            <span>{s.studentCode}</span>
                            <span>•</span>
                            <span className="font-medium text-ssru-crimson">{s.trackId}</span>
                          </div>
                        </div>
                        {s.finalEligible && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                            3/3 ผ่าน
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {role === "teacher" && (
              <div className="relative">
                <button
                  onClick={() => setShowTeacherMenu(!showTeacherMenu)}
                  className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl shadow-sm text-xs md:text-sm transition-all"
                >
                  <img
                    src={currentTeacher?.avatarUrl}
                    alt={currentTeacher?.firstNameTh}
                    className="w-7 h-7 rounded-full object-cover border border-neutral-200"
                  />
                  <div className="text-left hidden md:block">
                    <p className="font-semibold text-neutral-charcoal text-xs leading-none">
                      {currentTeacher?.prefixTh}{currentTeacher?.firstNameTh} {currentTeacher?.lastNameTh}
                    </p>
                    <span className="text-[10px] text-neutral-500">
                      กรรมการสอบ / ที่ปรึกษา
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                </button>

                {/* Dropdown for selecting demo teacher profile */}
                {showTeacherMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-neutral-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-neutral-100">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        สลับบัญชีอาจารย์กรรมการ
                      </p>
                    </div>
                    {allTeachers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          selectTeacherById(t.id);
                          setShowTeacherMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center space-x-3 hover:bg-neutral-50 transition-all ${
                          currentTeacher.id === t.id ? "bg-red-50/70 border-l-4 border-ssru-crimson" : ""
                        }`}
                      >
                        <img
                          src={t.avatarUrl}
                          alt={t.firstNameTh}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-neutral-charcoal truncate">
                            {t.prefixTh} {t.firstNameTh} {t.lastNameTh}
                          </p>
                          <div className="flex items-center space-x-1.5 text-[11px] text-neutral-500">
                            <span>{t.teacherCode}</span>
                            <span>•</span>
                            <span>แทร็ก {t.specializations.join(", ")}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
