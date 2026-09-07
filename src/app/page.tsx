"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import StudentDashboard from "@/components/StudentDashboard";
import TeacherDashboard from "@/components/TeacherDashboard";
import AdminDashboard from "@/components/AdminDashboard";
import LoginForm from "@/components/LoginForm";
import { ADVISOR_MIN_REQUIRED_LOGS, COMMITTEE_REQUIRED_VOTES } from "@/lib/rules/engine";
import { DEPARTMENT_CE_TH, FACULTY_NAME_TH, UNIVERSITY_NAME_TH } from "@/lib/institution";
import { GraduationCap, ShieldCheck, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HomePage() {
  const { isAuthenticated, isLoading, role, needsProfileSetup } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-ssru-crimson border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-neutral-600">กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto py-6 md:py-10 space-y-8 animate-in fade-in duration-300">
        {/* Hero */}
        <div className="bg-gradient-to-br from-ssru-crimson via-ssru-600 to-ssru-dark text-white rounded-3xl p-6 md:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="max-w-3xl relative z-10 space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-semibold backdrop-blur-sm">
              <GraduationCap className="w-4 h-4" />
              <span>SSRU Computer Engineering Examination Portal</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold font-display tracking-tight leading-tight">
              ระบบจองสอบ QE &amp; การสอบป้องกันโครงงานฉบับสมบูรณ์
            </h1>
            <p className="text-sm md:text-base text-white/90 leading-relaxed font-light">
              {DEPARTMENT_CE_TH} {FACULTY_NAME_TH} {UNIVERSITY_NAME_TH} — ระบบบริหารจัดการเกณฑ์ปลดล็อกสิทธิ์สอบ 3 ประการ
              (Gate-1, Gate-2, Gate-3) สู่การสอบป้องกัน Final Defense
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: 3-Gate explainer */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-soft border border-neutral-200 space-y-5">
              <div className="flex items-center space-x-3 pb-4 border-b border-neutral-100">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-ssru-crimson flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-charcoal text-base md:text-lg font-display">เกณฑ์ปลดล็อกสิทธิ์สอบโครงงาน 3 ประการ</h3>
                  <p className="text-xs text-neutral-500">ตามระเบียบข้อบังคับหลักสูตรวิศวกรรมศาสตรบัณฑิต (วศ.บ.)</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-ssru-50/60 border border-ssru-crimson/20 flex items-start space-x-3.5">
                <div className="w-8 h-8 rounded-xl bg-ssru-crimson text-white flex items-center justify-center font-bold text-xs flex-shrink-0">0</div>
                <div className="space-y-1">
                  <h4 className="text-xs md:text-sm font-bold text-neutral-charcoal">ส่งเอกสารโครงงาน (PDF): Proposal → สอบ 3 บท → สอบ 5 บท</h4>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    นักศึกษาอัปโหลดไฟล์ .pdf ให้อาจารย์ที่ปรึกษาบันทึกผล ผ่าน/ไม่ผ่าน — <span className="font-bold text-ssru-crimson">ต้องสอบ 3 บทผ่านแล้วเท่านั้น</span> จึงจะจองสอบ QE ได้
                  </p>
                </div>
              </div>

              <GateCard
                n={1}
                color="bg-amber-100 text-amber-800"
                title={`บันทึกการเข้าพบที่ปรึกษาอย่างน้อย ${ADVISOR_MIN_REQUIRED_LOGS} ครั้ง (Advisor Logs)`}
                desc={`นักศึกษาต้องบันทึกหัวข้อ ผลการเข้าพบ และได้รับการอนุมัติรับรองจากอาจารย์ที่ปรึกษาครบอย่างน้อย ${ADVISOR_MIN_REQUIRED_LOGS} ครั้ง`}
              />
              <GateCard
                n={2}
                color="bg-blue-100 text-blue-800"
                title={`ผ่านการสอบวัดคุณสมบัติ QE ด้วยมติอย่างน้อย ${COMMITTEE_REQUIRED_VOTES} ใน 3 เสียง (2/3 Committee Rule)`}
                desc="จองรอบสอบตามแทร็กความเชี่ยวชาญ (HW, SW, NW, DB) และผ่านการประเมินจากคณะกรรมการ 3 ท่าน"
              />
              <GateCard
                n={3}
                color="bg-emerald-100 text-emerald-800"
                title="เอกสารรับรองการตีพิมพ์ผลงานวิชาการ (Conference Evidence)"
                desc="แนบหนังสือตอบรับ (Acceptance Letter) หรือ Proceeding การประชุมวิชาการระดับชาติ/นานาชาติ"
              />

              <div className="pt-2 text-center text-xs text-neutral-400">
                เมื่อผ่านครบ 3/3 เงื่อนไข ระบบจะออกใบรับรองดิจิทัลและเปิดสิทธิ์จองสอบ Final Defense อัตโนมัติ
              </div>
            </div>
          </div>

          {/* Right: Login */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center space-x-2 px-6 py-4 border-b border-neutral-200 bg-neutral-50/80 text-ssru-crimson">
                <LogIn className="w-4 h-4" />
                <span className="text-xs md:text-sm font-bold">เข้าสู่ระบบ (Sign In)</span>
              </div>
              <div className="p-6 md:p-8">
                <LoginForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: the mandatory profile-setup modal (rendered by Header) covers the dashboard until completed.
  return (
    <div className={`w-full ${needsProfileSetup ? "pointer-events-none select-none blur-[2px]" : ""}`} aria-hidden={needsProfileSetup}>
      <AnimatePresence mode="wait">
        {role === "student" && (
          <motion.div key="student" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <StudentDashboard />
          </motion.div>
        )}
        {role === "teacher" && (
          <motion.div key="teacher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <TeacherDashboard />
          </motion.div>
        )}
        {role === "admin" && (
          <motion.div key="admin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <AdminDashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GateCard({ n, color, title, desc }: { n: number; color: string; title: string; desc: string }) {
  return (
    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-start space-x-3.5">
      <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center font-bold text-xs flex-shrink-0`}>{n}</div>
      <div className="space-y-1">
        <h4 className="text-xs md:text-sm font-bold text-neutral-charcoal">{title}</h4>
        <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
