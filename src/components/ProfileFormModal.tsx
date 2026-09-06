"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Student, Teacher, TrackType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { dbStore } from "@/lib/firebase/db";
import { resizeImageFile, uploadAvatar } from "@/lib/media/avatar";
import Avatar from "./Avatar";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password";
import { FACULTY_NAME_TH, yearLevelFromCode } from "@/lib/institution";
import {
  X,
  User,
  Upload,
  Save,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles
} from "lucide-react";

type Mode = "setup" | "edit";

interface ProfileFormModalProps {
  mode: Mode;
  isOpen: boolean;
  onClose: () => void;
}

const STUDENT_PREFIXES = ["นาย", "นางสาว", "นาง"];
const TEACHER_PREFIXES = ["อ.", "อ.ดร.", "ดร.", "ผศ.", "ผศ.ดร.", "รศ.", "รศ.ดร.", "ศ.", "ศ.ดร."];
const DEPARTMENTS = ["วิศวกรรมคอมพิวเตอร์", "วิศวกรรมหุ่นยนต์", "การจัดการวิศวกรรม", "อื่น ๆ"];

const inputCls = "w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20";
const labelCls = "block text-[11px] font-bold text-neutral-700 mb-1";

export default function ProfileFormModal({ mode, isOpen, onClose }: ProfileFormModalProps) {
  const { role, currentStudent, currentTeacher, completeStudentProfile, completeTeacherProfile } = useAuth();

  if (!isOpen) return null;
  if (role === "student" && currentStudent) {
    return <StudentProfileForm key={currentStudent.id} mode={mode} student={currentStudent} onClose={onClose} onSubmit={completeStudentProfile} />;
  }
  if (role === "teacher" && currentTeacher) {
    return <TeacherProfileForm key={currentTeacher.id} mode={mode} teacher={currentTeacher} onClose={onClose} onSubmit={completeTeacherProfile} />;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
function ModalShell({
  title,
  subtitle,
  mode,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  mode: Mode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ssru-crimson to-ssru-dark flex items-center justify-center text-white shadow-md">
              {mode === "setup" ? <Sparkles className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-neutral-charcoal leading-tight">{title}</h3>
              <p className="text-xs text-neutral-500">{subtitle}</p>
            </div>
          </div>
          {mode === "edit" && (
            <button onClick={onClose} aria-label="ปิด" className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function AvatarPicker({
  value,
  displayName,
  onChange,
  onError,
}: {
  value: string;
  displayName: string;
  onChange: (dataUrl: string) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onChange(await resizeImageFile(file));
    } catch (err: any) {
      onError(err?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center space-x-4 p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
      <Avatar src={value} name={displayName} alt="รูปโปรไฟล์" className="w-20 h-20 rounded-2xl object-cover border-2 border-ssru-crimson shadow-sm bg-white" />
      <div className="space-y-1.5">
        <label className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
          <Upload className="w-3.5 h-3.5" />
          <span>{busy ? "กำลังประมวลผลรูป..." : "อัปโหลดรูปโปรไฟล์"}</span>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={busy} />
        </label>
        <p className="text-[10px] text-neutral-400">รองรับ JPG, PNG, WEBP (ระบบจะย่อรูปเป็น 256×256 อัตโนมัติ)</p>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-[10px] text-red-600 hover:underline">
            ใช้รูปตัวอักษรย่อแทน
          </button>
        )}
      </div>
    </div>
  );
}

function NewPasswordFields({
  mode,
  password,
  confirm,
  onPassword,
  onConfirm,
}: {
  mode: Mode;
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  if (mode !== "setup") return null;
  return (
    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
        <KeyRound className="w-4 h-4" />
        <span>ตั้งรหัสผ่านใหม่ (แนะนำ) — ปัจจุบันรหัสผ่านของคุณคือรหัสประจำตัว</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>รหัสผ่านใหม่ (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร)</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => onPassword(e.target.value)}
              placeholder="เว้นว่างหากยังไม่ต้องการเปลี่ยน"
              className={`${inputCls} pr-9`}
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700" aria-label="แสดง/ซ่อนรหัสผ่าน">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>ยืนยันรหัสผ่านใหม่</label>
          <input type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => onConfirm(e.target.value)} className={inputCls} />
        </div>
      </div>
    </div>
  );
}

function FormFooter({ mode, saving, onClose }: { mode: Mode; saving: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-100">
      {mode === "edit" && (
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100">
          ยกเลิก
        </button>
      )}
      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-ssru-crimson hover:bg-ssru-600 disabled:opacity-60 flex items-center space-x-1.5 shadow-sm"
      >
        <Save className="w-4 h-4" />
        <span>{saving ? "กำลังบันทึก..." : mode === "setup" ? "บันทึกและเริ่มใช้งานระบบ" : "บันทึกข้อมูล"}</span>
      </button>
    </div>
  );
}

function validatePasswordPair(password: string, confirm: string): string | null {
  if (!password && !confirm) return null;
  if (password.length < MIN_PASSWORD_LENGTH) return `รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  if (password !== confirm) return "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน";
  return null;
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------
function StudentProfileForm({
  mode,
  student,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  student: Student;
  onClose: () => void;
  onSubmit: (updates: Partial<Student>, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const teachers = dbStore.getTeachers();
  const tracks = dbStore.getTracks();
  const isPlaceholderName = !student.profileCompleted && student.firstNameTh === "นักศึกษา";

  const [prefixTh, setPrefixTh] = useState(student.prefixTh || "นาย");
  const [firstNameTh, setFirstNameTh] = useState(isPlaceholderName ? "" : student.firstNameTh);
  const [lastNameTh, setLastNameTh] = useState(isPlaceholderName ? "" : student.lastNameTh);
  const [firstNameEn, setFirstNameEn] = useState(student.firstNameEn || "");
  const [lastNameEn, setLastNameEn] = useState(student.lastNameEn || "");
  const [phone, setPhone] = useState(student.phone || "");
  const [trackId, setTrackId] = useState<TrackType>(student.trackId || "SW");
  const [yearLevel, setYearLevel] = useState<number>(student.yearLevel || yearLevelFromCode(student.studentCode));
  const initialCustom = student.advisorId?.startsWith("CUSTOM-");
  const [advisorId, setAdvisorId] = useState<string>(initialCustom ? "OTHER" : student.advisorId || "");
  const [customAdvisor, setCustomAdvisor] = useState(initialCustom ? student.advisorId.replace("CUSTOM-", "") : "");
  const [projectTitleTh, setProjectTitleTh] = useState(student.projectTitleTh || "");
  const [projectTitleEn, setProjectTitleEn] = useState(student.projectTitleEn || "");
  const [avatar, setAvatar] = useState(student.avatarUrl || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const displayName = useMemo(() => `${firstNameTh} ${lastNameTh}`.trim() || student.studentCode, [firstNameTh, lastNameTh, student.studentCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstNameTh.trim() || !lastNameTh.trim()) return setError("กรุณากรอกชื่อและนามสกุล (ภาษาไทย)");
    if (!phone.trim()) return setError("กรุณากรอกเบอร์โทรศัพท์ติดต่อ");
    if (!advisorId) return setError("กรุณาเลือกอาจารย์ที่ปรึกษาโครงงาน");
    if (advisorId === "OTHER" && !customAdvisor.trim()) return setError("กรุณาระบุชื่ออาจารย์ที่ปรึกษา");
    const pwError = validatePasswordPair(newPassword, confirmPassword);
    if (pwError) return setError(pwError);

    setSaving(true);
    try {
      let avatarUrl = avatar;
      if (avatar && avatar.startsWith("data:")) {
        avatarUrl = await uploadAvatar("students", student.id, avatar);
      }
      const res = await onSubmit(
        {
          prefixTh,
          firstNameTh: firstNameTh.trim(),
          lastNameTh: lastNameTh.trim(),
          prefixEn: prefixTh === "นาย" ? "Mr." : prefixTh === "นาง" ? "Mrs." : "Ms.",
          firstNameEn: firstNameEn.trim(),
          lastNameEn: lastNameEn.trim(),
          phone: phone.trim(),
          trackId,
          yearLevel,
          advisorId: advisorId === "OTHER" ? `CUSTOM-${customAdvisor.trim()}` : advisorId,
          projectTitleTh: projectTitleTh.trim(),
          projectTitleEn: projectTitleEn.trim(),
          avatarUrl: avatarUrl || "",
        },
        newPassword || undefined
      );
      if (!res.success) {
        setError(res.error || "บันทึกข้อมูลไม่สำเร็จ");
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      mode={mode}
      onClose={onClose}
      title={mode === "setup" ? "ยินดีต้อนรับ! กรุณากรอกข้อมูลโปรไฟล์นักศึกษา" : "แก้ไขข้อมูลโปรไฟล์นักศึกษา"}
      subtitle={`รหัสนักศึกษา ${student.studentCode} • ${student.email}`}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
        {mode === "setup" && (
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
            <span>นี่คือการเข้าใช้งานครั้งแรกของคุณ กรุณากรอกข้อมูลให้ครบถ้วนก่อนใช้งานระบบ ข้อมูลจะถูกบันทึกลง Firebase และสามารถแก้ไขได้ภายหลังจากเมนูโปรไฟล์</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AvatarPicker value={avatar} displayName={displayName} onChange={setAvatar} onError={setError} />

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>คำนำหน้า *</label>
            <select value={prefixTh} onChange={(e) => setPrefixTh(e.target.value)} className={inputCls}>
              {STUDENT_PREFIXES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>ชื่อ (ภาษาไทย) *</label>
            <input value={firstNameTh} onChange={(e) => setFirstNameTh(e.target.value)} className={inputCls} required />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>นามสกุล (ภาษาไทย) *</label>
            <input value={lastNameTh} onChange={(e) => setLastNameTh(e.target.value)} className={inputCls} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>First name (English)</label>
            <input value={firstNameEn} onChange={(e) => setFirstNameEn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Last name (English)</label>
            <input value={lastNameEn} onChange={(e) => setLastNameEn(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>เบอร์โทรศัพท์ *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>แทร็กความเชี่ยวชาญ *</label>
            <select value={trackId} onChange={(e) => setTrackId(e.target.value as TrackType)} className={`${inputCls} font-bold text-ssru-crimson`}>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.code}: {t.nameTh}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>ชั้นปี</label>
            <select value={yearLevel} onChange={(e) => setYearLevel(parseInt(e.target.value))} className={inputCls}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
                <option key={y} value={y}>ชั้นปีที่ {y}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>อาจารย์ที่ปรึกษาโครงงาน *</label>
          <select value={advisorId} onChange={(e) => setAdvisorId(e.target.value)} className={inputCls} required>
            <option value="">— เลือกอาจารย์ที่ปรึกษา —</option>
            {teachers.map((t, i) => (
              <option key={t.id} value={t.id}>
                {i + 1}. {t.prefixTh}{t.firstNameTh} {t.lastNameTh} ({t.department || "วิศวกรรมคอมพิวเตอร์"})
              </option>
            ))}
            <option value="OTHER">อื่น ๆ (ระบุ)</option>
          </select>
          {advisorId === "OTHER" && (
            <input value={customAdvisor} onChange={(e) => setCustomAdvisor(e.target.value)} placeholder="ระบุชื่อ-สกุล และตำแหน่งทางวิชาการของอาจารย์ที่ปรึกษา" className={`${inputCls} mt-2`} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={labelCls}>ชื่อหัวข้อโครงงาน (ภาษาไทย)</label>
            <input value={projectTitleTh} onChange={(e) => setProjectTitleTh(e.target.value)} placeholder="ระบุได้ภายหลังเมื่อได้หัวข้อแล้ว" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Project title (English)</label>
            <input value={projectTitleEn} onChange={(e) => setProjectTitleEn(e.target.value)} className={inputCls} />
          </div>
        </div>

        <NewPasswordFields mode={mode} password={newPassword} confirm={confirmPassword} onPassword={setNewPassword} onConfirm={setConfirmPassword} />

        <FormFooter mode={mode} saving={saving} onClose={onClose} />
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------
function TeacherProfileForm({
  mode,
  teacher,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  teacher: Teacher;
  onClose: () => void;
  onSubmit: (updates: Partial<Teacher>, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const tracks = dbStore.getTracks();
  const [prefixTh, setPrefixTh] = useState(teacher.prefixTh || "อ.");
  const [academicRankTh, setAcademicRankTh] = useState(teacher.academicRankTh || "อาจารย์");
  const [firstNameTh, setFirstNameTh] = useState(teacher.firstNameTh);
  const [lastNameTh, setLastNameTh] = useState(teacher.lastNameTh);
  const [phone, setPhone] = useState(teacher.phone || "");
  const [department, setDepartment] = useState(teacher.department || "วิศวกรรมคอมพิวเตอร์");
  const [website, setWebsite] = useState(teacher.website || "");
  const [specializations, setSpecializations] = useState<TrackType[]>(teacher.specializations || []);
  const [isCommittee, setIsCommittee] = useState(teacher.isCommittee ?? true);
  const [avatar, setAvatar] = useState(teacher.avatarUrl || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Keep the long-form rank roughly in step with the short prefix when the user changes it.
    const map: Record<string, string> = {
      "อ.": "อาจารย์",
      "อ.ดร.": "อาจารย์ ดร.",
      "ดร.": "ดร.",
      "ผศ.": "ผู้ช่วยศาสตราจารย์",
      "ผศ.ดร.": "ผู้ช่วยศาสตราจารย์ ดร.",
      "รศ.": "รองศาสตราจารย์",
      "รศ.ดร.": "รองศาสตราจารย์ ดร.",
      "ศ.": "ศาสตราจารย์",
      "ศ.ดร.": "ศาสตราจารย์ ดร.",
    };
    if (map[prefixTh] && prefixTh !== teacher.prefixTh) setAcademicRankTh(map[prefixTh]);
  }, [prefixTh, teacher.prefixTh]);

  const toggleTrack = (id: TrackType) =>
    setSpecializations((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const displayName = `${firstNameTh} ${lastNameTh}`.trim() || teacher.teacherCode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstNameTh.trim() || !lastNameTh.trim()) return setError("กรุณากรอกชื่อและนามสกุล");
    if (!phone.trim()) return setError("กรุณากรอกเบอร์โทรศัพท์ติดต่อ");
    if (specializations.length === 0) return setError("กรุณาเลือกแทร็กที่เชี่ยวชาญอย่างน้อย 1 แทร็ก");
    const pwError = validatePasswordPair(newPassword, confirmPassword);
    if (pwError) return setError(pwError);

    setSaving(true);
    try {
      let avatarUrl = avatar;
      if (avatar && avatar.startsWith("data:")) {
        avatarUrl = await uploadAvatar("teachers", teacher.id, avatar);
      }
      const res = await onSubmit(
        {
          prefixTh,
          academicRankTh: academicRankTh.trim(),
          firstNameTh: firstNameTh.trim(),
          lastNameTh: lastNameTh.trim(),
          phone: phone.trim(),
          department,
          faculty: FACULTY_NAME_TH,
          website: website.trim(),
          specializations,
          isCommittee,
          avatarUrl: avatarUrl || "",
        },
        newPassword || undefined
      );
      if (!res.success) {
        setError(res.error || "บันทึกข้อมูลไม่สำเร็จ");
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      mode={mode}
      onClose={onClose}
      title={mode === "setup" ? "ยินดีต้อนรับ! กรุณาตรวจสอบและยืนยันข้อมูลโปรไฟล์อาจารย์" : "แก้ไขข้อมูลโปรไฟล์อาจารย์"}
      subtitle={`รหัสอาจารย์ ${teacher.teacherCode} • ${teacher.email}`}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
        {mode === "setup" && (
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
            <span>นี่คือการเข้าใช้งานครั้งแรกของท่าน ระบบได้เตรียมข้อมูลจากประกาศของคณะไว้ให้แล้ว กรุณาตรวจสอบ/แก้ไขให้ถูกต้อง และแนะนำให้ตั้งรหัสผ่านใหม่</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AvatarPicker value={avatar} displayName={displayName} onChange={setAvatar} onError={setError} />

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>คำนำหน้า *</label>
            <select value={prefixTh} onChange={(e) => setPrefixTh(e.target.value)} className={inputCls}>
              {TEACHER_PREFIXES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>ชื่อ *</label>
            <input value={firstNameTh} onChange={(e) => setFirstNameTh(e.target.value)} className={inputCls} required />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>นามสกุล *</label>
            <input value={lastNameTh} onChange={(e) => setLastNameTh(e.target.value)} className={inputCls} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>ตำแหน่งทางวิชาการ (ชื่อเต็ม)</label>
            <input value={academicRankTh} onChange={(e) => setAcademicRankTh(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>เบอร์โทรศัพท์ *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>สาขาวิชา *</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-400 mt-1">{FACULTY_NAME_TH}</p>
          </div>
          <div>
            <label className={labelCls}>เว็บไซต์ / ELFIT Profile</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.elfit.ssru.ac.th/..." className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>แทร็กที่เชี่ยวชาญ (เลือกได้หลายแทร็ก) *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {tracks.map((t) => {
              const active = specializations.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTrack(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    active ? "bg-red-50 border-ssru-crimson text-ssru-crimson" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  <span className="font-bold block">{t.code}</span>
                  <span className="text-[10px] leading-tight block">{t.nameTh}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={isCommittee} onChange={(e) => setIsCommittee(e.target.checked)} className="accent-ssru-crimson" />
          <span>เป็นกรรมการสอบวัดคุณสมบัติ (QE Committee)</span>
        </label>

        <NewPasswordFields mode={mode} password={newPassword} confirm={confirmPassword} onPassword={setNewPassword} onConfirm={setConfirmPassword} />

        <FormFooter mode={mode} saving={saving} onClose={onClose} />
      </form>
    </ModalShell>
  );
}
