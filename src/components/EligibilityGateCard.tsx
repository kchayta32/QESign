"use client";

import React, { useState } from "react";
import { FinalExamEligibility, Student, QEResult, AdvisorMeetingLog, ConferenceEvidence } from "@/types";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck2,
  Award,
  Sparkles,
  BookCheck,
  FileText,
  ChevronRight,
  Printer,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatThaiDate } from "@/lib/utils";

interface EligibilityGateCardProps {
  student: Student;
  eligibility: FinalExamEligibility;
  onOpenLogs?: () => void;
  onOpenQE?: () => void;
  onOpenConference?: () => void;
  onViewCertificate?: () => void;
}

export default function EligibilityGateCard({
  student,
  eligibility,
  onOpenLogs,
  onOpenQE,
  onOpenConference,
  onViewCertificate,
}: EligibilityGateCardProps) {
  const {
    condition1_LogsApproved,
    advisorLogsCount,
    advisorLogsRequired,
    condition2_QEPassed,
    qeStatus,
    qePassVotes,
    condition3_ConferenceApproved,
    conferenceStatus,
    isFinalEligible,
    certificateCode,
  } = eligibility;

  const passedConditionsCount =
    (condition1_LogsApproved ? 1 : 0) +
    (condition2_QEPassed ? 1 : 0) +
    (condition3_ConferenceApproved ? 1 : 0);

  const progressPercent = Math.round((passedConditionsCount / 3) * 100);

  return (
    <div className="w-full bg-white rounded-3xl p-5 md:p-7 shadow-soft border border-neutral-200/80 relative overflow-hidden transition-all">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-red-100/40 via-red-50/20 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />
      {isFinalEligible && (
        <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-3xl pointer-events-none shadow-[inset_0_0_20px_rgba(16,185,129,0.08)]" />
      )}

      {/* Header of Gate Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-neutral-100 relative z-10">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className={`p-2 rounded-xl flex items-center justify-center ${
              isFinalEligible ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-ssru-50 text-ssru-crimson"
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider text-ssru-crimson uppercase">
                3-Condition Validation Gate
              </span>
              <h2 className="text-base md:text-xl font-bold font-display text-neutral-charcoal">
                เกณฑ์เงื่อนไขสิทธิ์สอบป้องกันโครงงานฉบับสมบูรณ์ (Final Defense)
              </h2>
            </div>
          </div>
          <p className="text-xs text-neutral-500 max-w-2xl">
            นักศึกษาต้องผ่านเกณฑ์ทั้ง 3 ข้อเพื่อปลดล็อกสิทธิ์ยื่นสอบป้องกันโครงงานต่อคณะกรรมการสาขาวิชาวิศวกรรมคอมพิวเตอร์
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-medium text-neutral-400 block">
              สถานะความพร้อม ({passedConditionsCount}/3)
            </span>
            <span className="text-xs font-bold text-neutral-charcoal">
              สำเร็จแล้ว {progressPercent}%
            </span>
          </div>

          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm ${
              isFinalEligible
                ? "bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg animate-pulse"
                : "bg-amber-100 text-amber-900 border border-amber-200"
            }`}
          >
            {isFinalEligible ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>ปลดล็อกสิทธิ์สอบแล้ว (Eligible)</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-amber-700" />
                <span>รอดำเนินการให้ครบ 3 ข้อ</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-100 h-2.5 rounded-full my-6 overflow-hidden relative z-10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full transition-all duration-500 ${
            isFinalEligible
              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
              : "bg-gradient-to-r from-ssru-crimson to-amber-500"
          }`}
        />
      </div>

      {/* 3 Interactive Condition Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {/* Condition 1: Advisor Meeting Logs */}
        <div
          onClick={onOpenLogs}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
            condition1_LogsApproved
              ? "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50"
              : "bg-neutral-50/80 border-neutral-200 hover:bg-white hover:border-ssru-crimson/40 hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  condition1_LogsApproved
                    ? "bg-emerald-200 text-emerald-800"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                1
              </div>
              <span className="text-xs font-bold text-neutral-charcoal">บันทึกการพบที่ปรึกษา</span>
            </div>
            {condition1_LogsApproved ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                {advisorLogsCount} / {advisorLogsRequired} ครั้ง
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-600 mb-3 min-h-[36px] leading-relaxed">
            ต้องได้รับการอนุมัติการเข้าพบอาจารย์ที่ปรึกษาอย่างน้อย {advisorLogsRequired} ครั้ง
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 text-[11px]">
            <span className={condition1_LogsApproved ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium"}>
              {condition1_LogsApproved ? "✓ อนุมัติครบถ้วนแล้ว" : `ขาดอีก ${Math.max(0, advisorLogsRequired - advisorLogsCount)} ครั้ง`}
            </span>
            <span className="text-ssru-crimson font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              ดูบันทึก <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Condition 2: QE Result (2/3 Pass Rule) */}
        <div
          onClick={onOpenQE}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
            condition2_QEPassed
              ? "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50"
              : "bg-neutral-50/80 border-neutral-200 hover:bg-white hover:border-ssru-crimson/40 hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  condition2_QEPassed
                    ? "bg-emerald-200 text-emerald-800"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                2
              </div>
              <span className="text-xs font-bold text-neutral-charcoal">สอบ QE ผ่านเกณฑ์</span>
            </div>
            {condition2_QEPassed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-700">
                {qeStatus === "pending" ? "รอกรรมการประเมิน" : "ยังไม่ผ่าน"}
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-600 mb-3 min-h-[36px] leading-relaxed">
            ผ่านการสอบวัดคุณสมบัติด้วยมติกรรมการอย่างน้อย 2 ใน 3 ท่าน
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 text-[11px]">
            <span className={condition2_QEPassed ? "text-emerald-700 font-semibold" : "text-neutral-600 font-medium"}>
              {condition2_QEPassed ? `✓ ผ่าน (${qePassVotes}/3 เสียง)` : "รอผลการสอบ / ลงทะเบียน"}
            </span>
            <span className="text-ssru-crimson font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              ดูผลสอบ <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Condition 3: Conference Evidence */}
        <div
          onClick={onOpenConference}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
            condition3_ConferenceApproved
              ? "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50"
              : "bg-neutral-50/80 border-neutral-200 hover:bg-white hover:border-ssru-crimson/40 hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  condition3_ConferenceApproved
                    ? "bg-emerald-200 text-emerald-800"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                3
              </div>
              <span className="text-xs font-bold text-neutral-charcoal">หลักฐานการเผยแพร่</span>
            </div>
            {condition3_ConferenceApproved ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                {conferenceStatus === "pending" ? "รอตรวจ" : "ยังไม่ส่ง"}
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-600 mb-3 min-h-[36px] leading-relaxed">
            หนังสือตอบรับ (Acceptance Letter) หรือใบประกาศนำเสนองานประชุมวิชาการ
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 text-[11px]">
            <span className={condition3_ConferenceApproved ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium"}>
              {condition3_ConferenceApproved ? "✓ ตรวจสอบผ่านแล้ว" : conferenceStatus === "pending" ? "รออาจารย์ตรวจสอบ" : "ต้องส่งเอกสาร"}
            </span>
            <span className="text-ssru-crimson font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              ส่งหลักฐาน <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Unlocked Certificate Action Bar when 3/3 conditions met */}
      {isFinalEligible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-700/20 relative z-10"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white flex-shrink-0 border border-white/30">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm md:text-base font-bold font-display leading-tight">
                  ยินดีด้วย! คุณมีคุณสมบัติครบถ้วนสำหรับสอบป้องกัน Final Project
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-emerald-800 rounded-full">
                  PASS 3/3
                </span>
              </div>
              <p className="text-xs text-white/90">
                รหัสรับรอง: <span className="font-mono font-bold tracking-wider">{certificateCode}</span> • ออกโดยสาขาวิชาวิศวกรรมคอมพิวเตอร์
              </p>
            </div>
          </div>

          <button
            onClick={onViewCertificate}
            className="w-full sm:w-auto px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 transition-all rounded-xl font-bold text-xs md:text-sm shadow-md flex items-center justify-center space-x-2 flex-shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์หนังสือรับรองสิทธิ์</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
