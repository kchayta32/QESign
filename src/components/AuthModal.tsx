"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerStudentAccount, loginAccount } from "@/lib/firebase/authService";
import { dbStore } from "@/lib/firebase/db";
import { TrackType } from "@/types";
import {
  X,
  UserPlus,
  LogIn,
  Upload,
  Camera,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
];

export default function AuthModal({
  isOpen,
  onClose,
  defaultTab = "register",
}: AuthModalProps) {
  const { setCurrentStudent, setCurrentTeacher, setRole, selectStudentById, selectTeacherById } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const teachers = dbStore.getTeachers();
  const tracks = dbStore.getTracks();

  // Registration Form State
  const [prefixTh, setPrefixTh] = useState("นาย");
  const [firstNameTh, setFirstNameTh] = useState("");
  const [lastNameTh, setLastNameTh] = useState("");
  const [firstNameEn, setFirstNameEn] = useState("");
  const [lastNameEn, setLastNameEn] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [trackId, setTrackId] = useState<TrackType>("SW");
  const [yearLevel, setYearLevel] = useState<number>(4);
  const [advisorId, setAdvisorId] = useState<string>(teachers[0]?.id || "T-101");
  const [projectTitleTh, setProjectTitleTh] = useState("");
  const [projectTitleEn, setProjectTitleEn] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>(PRESET_AVATARS[0]);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  if (!isOpen) return null;

  // Handle student code change to auto-fill university email
  const handleStudentCodeChange = (code: string) => {
    setStudentCode(code);
    if (code.length >= 8) {
      setEmail(`s${code}@ssru.ac.th`);
    }
  };

  // Handle file upload for profile image
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!studentCode || !firstNameTh || !lastNameTh || !password) {
      setErrorMessage("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsLoading(true);
    const res = await registerStudentAccount({
      studentCode,
      prefixTh,
      firstNameTh,
      lastNameTh,
      firstNameEn: firstNameEn || firstNameTh,
      lastNameEn: lastNameEn || lastNameTh,
      email: email || `s${studentCode}@ssru.ac.th`,
      password,
      phone: phone || "089-000-0000",
      trackId,
      yearLevel,
      advisorId,
      projectTitleTh: projectTitleTh || "โครงงานวิศวกรรมคอมพิวเตอร์",
      projectTitleEn: projectTitleEn || "Computer Engineering Project",
      avatarUrl,
    });

    setIsLoading(false);
    if (res.success && res.student) {
      setSuccessMessage("ลงทะเบียนสมาชิกใหม่สำเร็จ! ยินดีต้อนรับเข้าสู่ระบบ");
      setCurrentStudent(res.student);
      setRole("student");
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.error || "เกิดข้อผิดพลาดในการลงทะเบียน");
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!loginIdentifier || !loginPassword) {
      setErrorMessage("กรุณากรอกรหัสนักศึกษา/อีเมล และรหัสผ่าน");
      return;
    }

    setIsLoading(true);
    const res = await loginAccount(loginIdentifier, loginPassword);
    setIsLoading(false);

    if (res.success) {
      if (res.role === "student" && res.entityId) {
        selectStudentById(res.entityId);
      } else if (res.role === "teacher" && res.entityId) {
        selectTeacherById(res.entityId);
      } else if (res.role === "admin") {
        setRole("admin");
      }
      setSuccessMessage("เข้าสู่ระบบสำเร็จ!");
      setTimeout(() => {
        onClose();
      }, 800);
    } else {
      setErrorMessage(res.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Modal Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ssru-crimson to-ssru-dark flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base md:text-lg font-bold font-display text-neutral-charcoal leading-tight">
                  ระบบสมาชิก สาขาวิชาวิศวกรรมคอมพิวเตอร์
                </h3>
              </div>
              <p className="text-xs text-neutral-500">
                SSRU Computer Engineering Identity &amp; Access Portal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 bg-neutral-50/70 border-b border-neutral-200/80">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setTab("register");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
                tab === "register"
                  ? "border-ssru-crimson text-ssru-crimson"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>ลงทะเบียนนักศึกษาใหม่ (Register)</span>
            </button>

            <button
              onClick={() => {
                setTab("login");
                setErrorMessage("");
                setSuccessMessage("");
              }}
              className={`pb-3 px-4 text-xs md:text-sm font-bold flex items-center space-x-2 border-b-2 transition-all ${
                tab === "login"
                  ? "border-ssru-crimson text-ssru-crimson"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ (Sign In)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 md:p-6 space-y-5">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          {/* TAB 1: REGISTRATION */}
          {tab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Profile Image Picker / Uploader */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                <label className="block text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-ssru-crimson" />
                  <span>รูปภาพโปรไฟล์ (Profile Avatar)</span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Current Avatar Preview */}
                  <div className="relative">
                    <img
                      src={avatarUrl}
                      alt="Avatar Preview"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-ssru-crimson shadow-md"
                    />
                    <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white border-2 border-white">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Upload or Choose from Preset */}
                  <div className="space-y-2 flex-1 w-full">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>อัปโหลดรูปจากเครื่อง</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-neutral-400">หรือเลือกรูปเริ่มต้น:</span>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {PRESET_AVATARS.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Preset ${i}`}
                          onClick={() => setAvatarUrl(url)}
                          className={`w-8 h-8 rounded-xl object-cover cursor-pointer transition-all border-2 ${
                            avatarUrl === url
                              ? "border-ssru-crimson scale-110 shadow-sm"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Prefix */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">คำนำหน้า</label>
                  <select
                    value={prefixTh}
                    onChange={(e) => setPrefixTh(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="นาง">นาง</option>
                  </select>
                </div>

                {/* First Name TH */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">ชื่อ (ภาษาไทย) *</label>
                  <input
                    type="text"
                    value={firstNameTh}
                    onChange={(e) => setFirstNameTh(e.target.value)}
                    placeholder="เช่น ธนากร"
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                    required
                  />
                </div>

                {/* Last Name TH */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 mb-1">นามสกุล (ภาษาไทย) *</label>
                  <input
                    type="text"
                    value={lastNameTh}
                    onChange={(e) => setLastNameTh(e.target.value)}
                    placeholder="เช่น สุขเจริญ"
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                    required
                  />
                </div>
              </div>

              {/* Student Code & Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    รหัสนักศึกษา (Student ID) *
                  </label>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={(e) => handleStudentCodeChange(e.target.value)}
                    placeholder="เช่น 65122010099"
                    className="w-full text-xs font-mono font-bold bg-white border border-neutral-300 rounded-xl p-2.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    อีเมลมหาวิทยาลัย
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="s65122010099@ssru.ac.th"
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  />
                </div>

                {/* Password with visibility toggle */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    รหัสผ่าน (Password) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กำหนดรหัสผ่าน $\ge 6$ ตัว"
                      className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5 pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Track, Year, Advisor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Track */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    แทร็กความเชี่ยวชาญ (Track) *
                  </label>
                  <select
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value as TrackType)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5 font-bold text-ssru-crimson"
                  >
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code}: {t.nameTh}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year Level */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">ชั้นปีการศึกษา</label>
                  <select
                    value={yearLevel}
                    onChange={(e) => setYearLevel(parseInt(e.target.value))}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    <option value={4}>ชั้นปีที่ 4</option>
                    <option value={3}>ชั้นปีที่ 3</option>
                    <option value={2}>ชั้นปีที่ 2</option>
                    <option value={1}>ชั้นปีที่ 1</option>
                  </select>
                </div>

                {/* Advisor */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    อาจารย์ที่ปรึกษาโครงงาน *
                  </label>
                  <select
                    value={advisorId}
                    onChange={(e) => setAdvisorId(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.prefixTh}{t.firstNameTh} {t.lastNameTh} ({t.teacherCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project Title */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ชื่อหัวข้อโครงงานวิศวกรรมคอมพิวเตอร์ (Project Title)
                </label>
                <input
                  type="text"
                  value={projectTitleTh}
                  onChange={(e) => setProjectTitleTh(e.target.value)}
                  placeholder="เช่น ระบบตรวจจับความผิดปกติของข้อมูลเครือข่ายด้วย AI"
                  className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-ssru-crimson to-ssru-dark hover:from-ssru-600 hover:to-ssru-900 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-ssru-crimson/20 flex items-center justify-center space-x-2 active:scale-98 transition-all"
              >
                {isLoading ? (
                  <span>กำลังบันทึกข้อมูลสมาชิก...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>ยืนยันการลงทะเบียนสมาชิกใหม่</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: LOGIN */}
          {tab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  รหัสนักศึกษา / รหัสอาจารย์ หรือ อีเมล
                </label>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="เช่น 64122010023 หรือ surachai.ek@ssru.ac.th"
                  className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านของคุณ"
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-ssru-crimson hover:bg-ssru-600 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-ssru-crimson/20 flex items-center justify-center space-x-2 transition-all active:scale-98"
              >
                {isLoading ? (
                  <span>กำลังตรวจสอบ...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>เข้าสู่ระบบ (Sign In)</span>
                  </>
                )}
              </button>

              {/* Quick Login Helpers for Testing */}
              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block text-center">
                  หรือเลือกล็อกอินด่วนสำหรับทดสอบระบบ:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      selectStudentById("STD-01");
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-left"
                  >
                    <span className="font-bold text-neutral-charcoal block">ธนากร (SW)</span>
                    <span className="text-[10px] text-emerald-700">✓ ปลดล็อก 3/3 สำเร็จ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      selectStudentById("STD-02");
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-left"
                  >
                    <span className="font-bold text-neutral-charcoal block">กานดา (HW)</span>
                    <span className="text-[10px] text-amber-700">กำลังดำเนินการ (2/3)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      selectTeacherById("T-101");
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-left"
                  >
                    <span className="font-bold text-neutral-charcoal block">ผศ.ดร.สุรชัย</span>
                    <span className="text-[10px] text-ssru-crimson">กรรมการสอบ / ที่ปรึกษา</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole("admin");
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-left"
                  >
                    <span className="font-bold text-neutral-charcoal block">ผู้ดูแลระบบ (Admin)</span>
                    <span className="text-[10px] text-neutral-500">จัดการภาพรวมสาขาวิชา</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
