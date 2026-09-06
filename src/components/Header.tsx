"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, ChevronDown, LogIn, LogOut, UserCog, KeyRound } from "lucide-react";
import AuthModal from "./AuthModal";
import ProfileFormModal from "./ProfileFormModal";
import ChangePasswordModal from "./ChangePasswordModal";
import Avatar from "./Avatar";
import { DEPARTMENT_CE_TH, FACULTY_NAME_TH, UNIVERSITY_NAME_TH } from "@/lib/institution";

export default function Header() {
  const { isAuthenticated, role, currentStudent, currentTeacher, currentAdmin, needsProfileSetup, logout } = useAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu when clicking outside of it.
  useEffect(() => {
    if (!showProfileMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showProfileMenu]);

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
  };

  let avatarUrl = "";
  let displayName = "";
  let subText = "";
  let roleBadge = "";
  let roleBadgeColor = "bg-ssru-50 text-ssru-crimson border-ssru-crimson/20";

  if (role === "student" && currentStudent) {
    displayName = `${currentStudent.prefixTh} ${currentStudent.firstNameTh} ${currentStudent.lastNameTh}`.trim();
    avatarUrl = currentStudent.avatarUrl || "";
    subText = `รหัส ${currentStudent.studentCode} • แทร็ก ${currentStudent.trackId}`;
    roleBadge = `นักศึกษาปี ${currentStudent.yearLevel}`;
  } else if (role === "teacher" && currentTeacher) {
    displayName = `${currentTeacher.prefixTh}${currentTeacher.firstNameTh} ${currentTeacher.lastNameTh}`;
    avatarUrl = currentTeacher.avatarUrl || "";
    subText = `${currentTeacher.teacherCode} • ${currentTeacher.department || DEPARTMENT_CE_TH}`;
    roleBadge = "อาจารย์ / กรรมการสอบ";
    roleBadgeColor = "bg-blue-50 text-blue-800 border-blue-200";
  } else if (role === "admin" && currentAdmin) {
    displayName = currentAdmin.displayName;
    avatarUrl = currentAdmin.avatarUrl || "";
    subText = currentAdmin.email;
    roleBadge = "ผู้ดูแลระบบ";
    roleBadgeColor = "bg-neutral-900 text-amber-400 border-neutral-700";
  }

  const canEditProfile = role === "student" || role === "teacher";

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm transition-all">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-ssru-crimson via-ssru-600 to-ssru-dark text-white px-4 py-2 text-xs md:text-sm">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                SSRU CE System
              </span>
              <span className="hidden lg:inline font-medium truncate">
                {DEPARTMENT_CE_TH} {FACULTY_NAME_TH} {UNIVERSITY_NAME_TH}
              </span>
              <span className="lg:hidden font-medium truncate">มรภ.สวนสุนันทา (วิศวกรรมคอมพิวเตอร์)</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-400/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden md:inline">Firebase Realtime Sync</span>
                <span className="md:hidden">Live</span>
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              {!isAuthenticated ? (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-white font-medium border border-white/25"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-white/80 hidden sm:inline text-xs">
                    เข้าสู่ระบบโดย: <strong className="text-white">{displayName}</strong>
                  </span>
                  <button
                    onClick={handleLogout}
                    title="ออกจากระบบ"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white font-medium border border-white/20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
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

            <div className="flex items-center space-x-3">
              {isAuthenticated ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center space-x-2.5 pl-2 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-2xl shadow-sm text-xs md:text-sm transition-all"
                  >
                    <Avatar src={avatarUrl} name={displayName} className="w-8 h-8 md:w-9 md:h-9 rounded-xl object-cover border border-neutral-200 shadow-xs bg-white" />
                    <div className="text-left hidden md:block">
                      <div className="flex items-center space-x-1.5">
                        <p className="font-bold text-neutral-charcoal text-xs leading-none">{displayName}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${roleBadgeColor}`}>{roleBadge}</span>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">{subText}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-neutral-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-neutral-100">
                      <div className="px-4 py-3">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">บัญชีที่กำลังใช้งาน</span>
                        <p className="text-xs font-bold text-neutral-charcoal">{displayName}</p>
                        <p className="text-[11px] text-neutral-500 font-mono">{subText}</p>
                        <span className={`mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadgeColor}`}>{roleBadge}</span>
                      </div>

                      <div className="px-2 py-1.5 space-y-0.5">
                        {canEditProfile && (
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              setIsProfileEditOpen(true);
                            }}
                            className="w-full px-3 py-2 text-xs font-bold text-neutral-700 hover:text-ssru-crimson hover:bg-red-50/70 rounded-xl flex items-center space-x-2 transition-colors"
                          >
                            <UserCog className="w-4 h-4 text-ssru-crimson" />
                            <span>แก้ไขข้อมูลโปรไฟล์</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setIsPasswordOpen(true);
                          }}
                          className="w-full px-3 py-2 text-xs font-bold text-neutral-700 hover:text-ssru-crimson hover:bg-red-50/70 rounded-xl flex items-center space-x-2 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-ssru-crimson" />
                          <span>เปลี่ยนรหัสผ่าน</span>
                        </button>
                      </div>

                      <div className="px-2 pt-1.5">
                        <button
                          onClick={handleLogout}
                          className="w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center space-x-2 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>ออกจากระบบ (Sign Out)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-ssru-crimson to-ssru-600 hover:from-ssru-600 hover:to-ssru-dark text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-ssru-crimson/20 flex items-center space-x-1.5 active:scale-95 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthModalOpen && !isAuthenticated} onClose={() => setIsAuthModalOpen(false)} />

      {/* Mandatory first-login profile completion (cannot be dismissed) */}
      {isAuthenticated && needsProfileSetup && <ProfileFormModal mode="setup" isOpen onClose={() => undefined} />}

      {isAuthenticated && canEditProfile && !needsProfileSetup && (
        <ProfileFormModal mode="edit" isOpen={isProfileEditOpen} onClose={() => setIsProfileEditOpen(false)} />
      )}

      {isAuthenticated && <ChangePasswordModal isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)} />}
    </>
  );
}
