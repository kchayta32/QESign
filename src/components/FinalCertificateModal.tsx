"use client";

import React from "react";
import { Student, FinalExamEligibility } from "@/types";
import { formatThaiDate } from "@/lib/utils";
import { dbStore } from "@/lib/firebase/db";
import { DEPARTMENT_CE_TH, FACULTY_NAME_TH, UNIVERSITY_NAME_TH } from "@/lib/institution";
import { X, Award, Printer, CheckCircle2, ShieldCheck } from "lucide-react";

interface FinalCertificateModalProps {
  student: Student;
  eligibility: FinalExamEligibility;
  isOpen: boolean;
  onClose: () => void;
}

export default function FinalCertificateModal({
  student,
  eligibility,
  isOpen,
  onClose,
}: FinalCertificateModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const advisorName = dbStore.getTeacherDisplayName(student.advisorId);
  const finalRound = dbStore.getActiveRound("FINAL_DEFENSE");
  const semesterLabel = finalRound ? `${finalRound.semester}/${finalRound.academicYear}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden print:shadow-none print:border-none print:w-full">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="p-4 bg-neutral-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold font-display">
              หนังสือรับรองสิทธิ์สอบป้องกันโครงงานฉบับสมบูรณ์ (Official Certificate)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-ssru-crimson hover:bg-ssru-600 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Body */}
        <div className="p-8 md:p-12 relative bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:16px_16px] print:p-6">
          {/* Certificate Frame & Border */}
          <div className="border-4 border-double border-ssru-crimson/80 p-8 rounded-2xl bg-white/90 relative">
            {/* Corner Decorative Ornaments */}
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-ssru-crimson" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-ssru-crimson" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-ssru-crimson" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-ssru-crimson" />

            {/* Emblem and University Header */}
            <div className="text-center space-y-2 mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-ssru-crimson to-ssru-dark flex items-center justify-center text-white shadow-md">
                <ShieldCheck className="w-9 h-9" />
              </div>
              <h3 className="text-base font-bold font-display text-ssru-crimson tracking-tight">
                {DEPARTMENT_CE_TH} {FACULTY_NAME_TH}
              </h3>
              <h4 className="text-xs font-medium text-neutral-600">
                {UNIVERSITY_NAME_TH}
              </h4>
              <div className="inline-block px-4 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mt-2">
                หนังสือรับรองคุณสมบัติการสอบป้องกันโครงงานวิศวกรรมคอมพิวเตอร์
              </div>
            </div>

            {/* Certificate Content */}
            <div className="space-y-4 text-center my-6 text-xs md:text-sm text-neutral-800 leading-relaxed">
              <p>หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า</p>

              <div className="my-3">
                <p className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">
                  {student.prefixTh} {student.firstNameTh} {student.lastNameTh}
                </p>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  รหัสนักศึกษา: {student.studentCode} • แทร็กความเชี่ยวชาญ: {student.trackId}
                </p>
              </div>

              <p className="max-w-lg mx-auto text-xs text-neutral-600">
                หัวข้อโครงงาน: <br />
                <span className="font-bold text-neutral-charcoal">
                  &ldquo;{student.projectTitleTh || "โครงงานวิศวกรรมคอมพิวเตอร์"}&rdquo;
                </span>
              </p>

              <p className="text-xs text-neutral-700 max-w-lg mx-auto pt-2">
                ได้ผ่านเกณฑ์เงื่อนไขครบถ้วนทั้ง 3 ประการ (3-Condition Eligibility Gate) ได้แก่
              </p>

              {/* 3 Conditions Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto text-left text-[11px] my-4">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold text-emerald-900">
                    1. บันทึกพบที่ปรึกษา ({eligibility.advisorLogsCount}/6)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold text-emerald-900">
                    2. สอบ QE ผ่าน ({eligibility.qePassVotes}/3 เสียง)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold text-emerald-900">
                    3. เอกสาร Conference ผ่าน
                  </span>
                </div>
              </div>

              <p className="text-xs font-bold text-emerald-800 pt-1">
                มีสิทธิ์ยื่นขอสอบป้องกันโครงงานฉบับสมบูรณ์ (Final Project Defense){semesterLabel ? ` ประจำภาคเรียนที่ ${semesterLabel}` : ""}
              </p>
            </div>

            {/* Signature blocks (to be signed by hand on the printed copy) */}
            <div className="grid grid-cols-2 gap-6 pt-8 mt-6 border-t border-neutral-200 text-center text-xs">
              <div className="space-y-1">
                <div className="h-10" />
                <div className="border-t border-neutral-400 max-w-[180px] mx-auto pt-1">
                  <p className="font-bold text-neutral-charcoal">(............................................)</p>
                  <p className="text-[10px] text-neutral-500">หัวหน้า{DEPARTMENT_CE_TH}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-10" />
                <div className="border-t border-neutral-400 max-w-[180px] mx-auto pt-1">
                  <p className="font-bold text-neutral-charcoal">{advisorName}</p>
                  <p className="text-[10px] text-neutral-500">อาจารย์ที่ปรึกษาโครงงาน</p>
                </div>
              </div>
            </div>

            {/* Verification Code Footer */}
            <div className="mt-8 pt-3 border-t border-dashed border-neutral-200 flex items-center justify-between text-[10px] text-neutral-400">
              <span>รหัสรับรอง: {eligibility.certificateCode || "-"}</span>
              <span>ออกให้ ณ วันที่ {formatThaiDate(new Date().toISOString())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
