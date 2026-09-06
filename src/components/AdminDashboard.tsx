"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { dbStore, AccountKind } from "@/lib/firebase/db";
import { formatThaiDateTime } from "@/lib/utils";
import { DEPARTMENT_CE_TH } from "@/lib/institution";
import type { Student, Teacher } from "@/types";
import {
  ShieldCheck,
  Calendar,
  Layers,
  Download,
  Plus,
  Search,
  KeyRound,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

type Filter = "all" | "students" | "teachers";

function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(","));
  // BOM so Excel opens Thai text correctly
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const { allStudents, allTeachers } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [newCode, setNewCode] = useState("");
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const tracks = dbStore.getTracks();
  const rounds = dbStore.getExamRounds();
  const qeBookings = dbStore.getQEBookings().filter((b) => b.status !== "cancelled");

  const students = allStudents;
  const teachers = allTeachers;

  const stats = useMemo(() => {
    const eligible = students.filter((s) => dbStore.getStudentEligibility(s.id).isFinalEligible).length;
    const profiled = students.filter((s) => s.profileCompleted).length;
    const loggedIn = students.filter((s) => s.lastLoginAt).length;
    return { eligible, profiled, loggedIn };
  }, [students]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Array<{ kind: AccountKind; id: string; code: string; name: string; email: string; extra: string; profileCompleted: boolean; passwordChanged: boolean; lastLoginAt?: string }> = [];
    if (filter !== "teachers") {
      for (const s of students) {
        list.push({
          kind: "student",
          id: s.id,
          code: s.studentCode,
          name: `${s.prefixTh} ${s.firstNameTh} ${s.lastNameTh}`.trim(),
          email: s.email,
          extra: `แทร็ก ${s.trackId} • ปี ${s.yearLevel} • ที่ปรึกษา: ${dbStore.getTeacherDisplayName(s.advisorId)}`,
          profileCompleted: !!s.profileCompleted,
          passwordChanged: !!s.passwordChanged,
          lastLoginAt: s.lastLoginAt,
        });
      }
    }
    if (filter !== "students") {
      for (const t of teachers) {
        list.push({
          kind: "teacher",
          id: t.id,
          code: t.teacherCode,
          name: `${t.prefixTh}${t.firstNameTh} ${t.lastNameTh}`,
          email: t.email,
          extra: `${t.department || DEPARTMENT_CE_TH} • แทร็ก ${t.specializations.join(", ")}`,
          profileCompleted: !!t.profileCompleted,
          passwordChanged: !!t.passwordChanged,
          lastLoginAt: t.lastLoginAt,
        });
      }
    }
    return list.filter((r) => !q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [students, teachers, filter, query]);

  const handleExport = () => {
    const header = ["รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "อีเมล", "โทรศัพท์", "แทร็ก", "ชั้นปี", "อาจารย์ที่ปรึกษา", "หัวข้อโครงงาน", "ผ่าน 3 บท", "บันทึกที่ปรึกษา (อนุมัติ)", "ผล QE", "มติ QE", "เอกสาร Conference", "สิทธิ์สอบ Final", "กรอกโปรไฟล์แล้ว", "เข้าใช้งานล่าสุด"];
    const body = students.map((s: Student) => {
      const e = dbStore.getStudentEligibility(s.id);
      return [
        s.studentCode, s.prefixTh, s.firstNameTh, s.lastNameTh, s.email, s.phone, s.trackId, s.yearLevel,
        dbStore.getTeacherDisplayName(s.advisorId), s.projectTitleTh || "",
        s.passed3Chapter ? "ผ่าน" : "ยังไม่ผ่าน",
        `${e.advisorLogsCount}/${e.advisorLogsRequired}`,
        e.qeStatus, `${e.qePassVotes}/3`, e.conferenceStatus,
        e.isFinalEligible ? "ปลดล็อกแล้ว" : "ยังไม่ครบเงื่อนไข",
        s.profileCompleted ? "ใช่" : "ไม่",
        s.lastLoginAt || "",
      ];
    });
    downloadCsv(`ssru-ce-students-${new Date().toISOString().slice(0, 10)}.csv`, header, body);
  };

  const handleExportTeachers = () => {
    const header = ["รหัสอาจารย์", "ชื่อ-สกุล", "ตำแหน่งทางวิชาการ", "สาขาวิชา", "อีเมล", "โทรศัพท์", "เว็บไซต์", "แทร็ก", "กรรมการ QE", "จำนวนที่ปรึกษา", "เข้าใช้งานล่าสุด"];
    const body = teachers.map((t: Teacher) => [
      t.teacherCode, `${t.prefixTh}${t.firstNameTh} ${t.lastNameTh}`, t.academicRankTh, t.department || "", t.email, t.phone, t.website || "",
      t.specializations.join("/"), t.isCommittee ? "ใช่" : "ไม่",
      students.filter((s) => s.advisorId === t.id).length, t.lastLoginAt || "",
    ]);
    downloadCsv(`ssru-ce-teachers-${new Date().toISOString().slice(0, 10)}.csv`, header, body);
  };

  const handleResetPassword = (kind: AccountKind, id: string, code: string) => {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ ${code} กลับเป็นค่าเริ่มต้น (= ${code}) ?`)) return;
    dbStore.resetPasswordToDefault(kind, id);
    setNotice({ type: "ok", text: `รีเซ็ตรหัสผ่านของ ${code} เรียบร้อย — รหัสผ่านใหม่คือ ${code}` });
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const res = dbStore.addStudentToRoster(newCode);
    if (!res.ok) {
      setNotice({ type: "err", text: res.error || "เพิ่มไม่สำเร็จ" });
      return;
    }
    setNotice({ type: "ok", text: `เพิ่มรหัสนักศึกษา ${res.student!.studentCode} แล้ว (รหัสผ่านเริ่มต้น = รหัสนักศึกษา)` });
    setNewCode("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Admin Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-soft border border-neutral-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center text-amber-400 shadow-md">
              <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-900 text-white">ผู้ดูแลระบบ</span>
                <span className="text-xs text-neutral-400">ระบบบริหารจัดการภาพรวม</span>
              </div>
              <h2 className="text-lg md:text-2xl font-bold font-display text-neutral-charcoal">แดชบอร์ดผู้ดูแลระบบ{DEPARTMENT_CE_TH}</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Computer Engineering Administrative &amp; Examination Command Center</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleExport} className="px-4 py-2.5 bg-ssru-crimson hover:bg-ssru-600 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors">
              <Download className="w-4 h-4" />
              <span>ส่งออกรายงานนักศึกษา (CSV)</span>
            </button>
            <button onClick={handleExportTeachers} className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors">
              <Download className="w-4 h-4" />
              <span>ส่งออกรายชื่ออาจารย์ (CSV)</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6 pt-6 border-t border-neutral-100">
          <Stat label="นักศึกษาในระบบ" value={`${students.length} คน`} />
          <Stat label="กรอกโปรไฟล์แล้ว / เข้าใช้งานแล้ว" value={`${stats.profiled} / ${stats.loggedIn}`} />
          <Stat label="จองสอบ QE รวม" value={`${qeBookings.length} คำร้อง`} accent="crimson" />
          <Stat label="ปลดล็อก Final แล้ว (3/3)" value={`${stats.eligible} คน`} accent="emerald" />
          <Stat label="อาจารย์ / กรรมการ" value={`${teachers.length} ท่าน`} />
        </div>
      </div>

      {/* Tracks & Rounds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-neutral-100">
            <Layers className="w-5 h-5 text-ssru-crimson" />
            <h3 className="text-sm md:text-base font-bold font-display text-neutral-charcoal">โควตาและจำนวนที่นั่งสอบประจำแต่ละแทร็ก</h3>
          </div>
          <div className="space-y-3">
            {tracks.map((track) => (
              <div key={track.id} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-neutral-charcoal">{track.code}: {track.nameTh}</span>
                  <span className="font-bold text-ssru-crimson">{track.activeBookingsCount} / {track.quotaTotal} ที่นั่ง</span>
                </div>
                <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((track.activeBookingsCount / track.quotaTotal) * 100))}%`, backgroundColor: track.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-neutral-100">
            <Calendar className="w-5 h-5 text-ssru-crimson" />
            <h3 className="text-sm md:text-base font-bold font-display text-neutral-charcoal">รอบการสอบและห้องสอบที่เปิดใช้งาน</h3>
          </div>
          <div className="space-y-3">
            {rounds.map((round) => {
              const today = new Date().toISOString().slice(0, 10);
              const open = round.isActive && today <= round.bookingDeadline;
              return (
                <div key={round.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-neutral-charcoal">{round.titleTh}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${open ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"}`}>
                      {open ? "เปิดรับจอง" : "ปิดรับจอง"}
                    </span>
                  </div>
                  <div className="text-neutral-500 space-y-1 text-[11px]">
                    <p>ช่วงเวลาสอบ: {round.startDate} ถึง {round.endDate} • หมดเขตจอง {round.bookingDeadline}</p>
                    <p>ห้องสอบ: {round.availableRooms.join(", ")}</p>
                    <p>ช่วงเวลาในแต่ละวัน: {round.slotsPerDay.join(", ")} น.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Account management */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-ssru-crimson" />
            <div>
              <h3 className="text-sm md:text-base font-bold font-display text-neutral-charcoal">บัญชีผู้ใช้งาน (นักศึกษา {students.length} • อาจารย์ {teachers.length})</h3>
              <p className="text-xs text-neutral-500">รหัสผ่านเริ่มต้น = รหัสประจำตัว • ผู้ใช้ต้องกรอกโปรไฟล์เมื่อเข้าใช้งานครั้งแรก</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-neutral-200 overflow-hidden text-xs">
              {(["all", "students", "teachers"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 font-bold ${filter === f ? "bg-ssru-crimson text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                  {f === "all" ? "ทั้งหมด" : f === "students" ? "นักศึกษา" : "อาจารย์"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหารหัส / ชื่อ / อีเมล" className="text-xs pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 w-56" />
            </div>
            <form onSubmit={handleAddStudent} className="flex items-center gap-1.5">
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="เพิ่มรหัส นศ. 11 หลัก" className="text-xs font-mono px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl w-44 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20" />
              <button type="submit" className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold flex items-center gap-1 hover:bg-neutral-800">
                <Plus className="w-3.5 h-3.5" /> เพิ่ม
              </button>
            </form>
          </div>
        </div>

        {notice && (
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${notice.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {notice.type === "ok" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{notice.text}</span>
          </div>
        )}

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-2xl border border-neutral-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-50 z-10">
              <tr className="text-neutral-500 uppercase text-[10px] tracking-wider border-b border-neutral-200">
                <th className="py-3 px-4 font-bold">รหัส</th>
                <th className="py-3 px-3 font-bold">ชื่อ</th>
                <th className="py-3 px-3 font-bold">อีเมล</th>
                <th className="py-3 px-3 font-bold">รายละเอียด</th>
                <th className="py-3 px-3 font-bold">โปรไฟล์</th>
                <th className="py-3 px-3 font-bold">รหัสผ่าน</th>
                <th className="py-3 px-3 font-bold">เข้าใช้งานล่าสุด</th>
                <th className="py-3 px-4 font-bold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-neutral-400">ไม่พบบัญชีที่ตรงกับคำค้นหา</td></tr>
              )}
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="hover:bg-neutral-50/80">
                  <td className="py-2.5 px-4 font-mono font-bold text-neutral-charcoal whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {r.kind === "student" ? <GraduationCap className="w-3.5 h-3.5 text-ssru-crimson" /> : <Users className="w-3.5 h-3.5 text-blue-600" />}
                      {r.code}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{r.name}</td>
                  <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">{r.email}</td>
                  <td className="py-2.5 px-3 text-neutral-500 max-w-xs truncate" title={r.extra}>{r.extra}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${r.profileCompleted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {r.profileCompleted ? "ครบถ้วน" : "ยังไม่กรอก"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${r.passwordChanged ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>
                      {r.passwordChanged ? "เปลี่ยนแล้ว" : "ค่าเริ่มต้น"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">{r.lastLoginAt ? formatThaiDateTime(r.lastLoginAt) : "-"}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button onClick={() => handleResetPassword(r.kind, r.id, r.code)} title="รีเซ็ตรหัสผ่านเป็นค่าเริ่มต้น" className="p-1.5 text-neutral-600 hover:text-ssru-crimson hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-1">
                      <KeyRound className="w-4 h-4" />
                      <span className="hidden xl:inline text-[11px] font-semibold">รีเซ็ตรหัสผ่าน</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "crimson" | "emerald" }) {
  const cls =
    accent === "crimson"
      ? "bg-ssru-50/50 border-ssru-crimson/20 text-ssru-crimson"
      : accent === "emerald"
      ? "bg-emerald-50/70 border-emerald-200 text-emerald-700"
      : "bg-neutral-50 border-neutral-200 text-neutral-charcoal";
  return (
    <div className={`p-4 rounded-2xl border ${cls}`}>
      <span className="text-xs block font-medium opacity-70">{label}</span>
      <span className="text-xl md:text-2xl font-bold font-display">{value}</span>
    </div>
  );
}
