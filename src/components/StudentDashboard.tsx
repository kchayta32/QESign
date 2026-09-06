"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { dbStore } from "@/lib/firebase/db";
import { formatThaiDate } from "@/lib/utils";
import EligibilityGateCard from "./EligibilityGateCard";
import TrackSelector from "./TrackSelector";
import QEBookingModal from "./QEBookingModal";
import AdvisorLogsManager from "./AdvisorLogsManager";
import ConferenceEvidenceManager from "./ConferenceEvidenceManager";
import FinalCertificateModal from "./FinalCertificateModal";
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Award,
  Sparkles,
  BookOpen,
  Send,
  Building2,
  ChevronRight,
  Radio
} from "lucide-react";
import { QEBooking } from "@/types";
import Avatar from "./Avatar";
import { DEPARTMENT_CE_TH } from "@/lib/institution";

export default function StudentDashboard() {
  const { currentStudent } = useAuth();

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);

  if (!currentStudent) {
    return (
      <div className="p-8 text-center text-neutral-500">
        <p>ไม่พบข้อมูลนักศึกษา กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>
      </div>
    );
  }

  const tracks = dbStore.getTracks();
  const examRounds = dbStore.getExamRounds();
  const eligibility = dbStore.getStudentEligibility(currentStudent.id);
  const studentBookings = dbStore
    .getQEBookingsByStudent(currentStudent.id)
    .filter((b) => b.status !== "cancelled");
  const latestBooking = studentBookings[0];
  const qeResult = latestBooking ? dbStore.getQEResultByBooking(latestBooking.id) : undefined;
  const advisorDisplayName = dbStore.getTeacherDisplayName(currentStudent.advisorId);

  const handleBookingSuccess = (_booking: QEBooking) => {
    // State is synced via the data store subscription & Realtime Database.
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Student Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-soft border border-neutral-200/80 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <Avatar
              src={currentStudent.avatarUrl}
              name={`${currentStudent.firstNameTh} ${currentStudent.lastNameTh}`}
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover border-2 border-ssru-crimson/20 shadow-md flex-shrink-0 bg-white"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-ssru-50 text-ssru-crimson border border-ssru-crimson/20">
                  นักศึกษาชั้นปีที่ {currentStudent.yearLevel}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700">
                  Track: {currentStudent.trackId}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Realtime Sync</span>
                </span>
              </div>
              <h2 className="text-lg md:text-2xl font-bold font-display text-neutral-charcoal leading-tight">
                {currentStudent.prefixTh} {currentStudent.firstNameTh} {currentStudent.lastNameTh}
              </h2>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                รหัสนักศึกษา: <span className="font-bold text-neutral-charcoal">{currentStudent.studentCode}</span> • {DEPARTMENT_CE_TH}
              </p>
            </div>
          </div>

          {/* Quick Stats / Advisor Info */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
              <span className="text-neutral-400 block">อาจารย์ที่ปรึกษา:</span>
              <span className="font-bold text-neutral-charcoal">
                {advisorDisplayName}
              </span>
            </div>

            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="px-5 py-3.5 bg-gradient-to-r from-ssru-crimson to-ssru-600 hover:from-ssru-600 hover:to-ssru-dark text-white rounded-2xl font-bold text-xs md:text-sm shadow-md shadow-ssru-crimson/20 flex items-center space-x-2 active:scale-95 transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>จองรอบสอบ QE</span>
            </button>
          </div>
        </div>

        {/* Project Title Banner */}
        <div className="mt-5 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-neutral-600">
            <BookOpen className="w-4 h-4 text-ssru-crimson flex-shrink-0" />
            <span className="font-semibold text-neutral-400">หัวข้อโครงงาน:</span>
            <span className="font-bold text-neutral-charcoal truncate max-w-xl">
              {currentStudent.projectTitleTh || "ระบบโครงงานวิศวกรรมคอมพิวเตอร์"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-neutral-400">สถานะสอบ 3 บท:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              currentStudent.passed3Chapter ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}>
              {currentStudent.passed3Chapter ? "ผ่านแล้ว (พร้อมสอบ QE)" : "รออาจารย์ที่ปรึกษายืนยันผลสอบ 3 บท"}
            </span>
          </div>
        </div>
      </div>

      {/* Flagship: 3-Condition Eligibility Gate Card */}
      <EligibilityGateCard
        student={currentStudent}
        eligibility={eligibility}
        onOpenLogs={() => setIsLogsModalOpen(true)}
        onOpenQE={() => {
          if (!latestBooking) {
            setIsBookingModalOpen(true);
          }
        }}
        onOpenConference={() => setIsConferenceModalOpen(true)}
        onViewCertificate={() => setIsCertificateModalOpen(true)}
      />

      {/* Grid of Sections: QE Booking Status & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Latest QE Exam Booking & Result Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-ssru-50 text-ssru-crimson">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-neutral-charcoal">
                    สถานะการจองสอบวัดคุณสมบัติ (Qualifying Exam Status)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    ข้อมูลรอบสอบ ห้องสอบ และคณะกรรมการผู้ประเมิน
                  </p>
                </div>
              </div>

              {latestBooking && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  latestBooking.status === "evaluated"
                    ? "bg-emerald-100 text-emerald-800"
                    : latestBooking.status === "confirmed"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {latestBooking.status === "evaluated"
                    ? "ประเมินผลแล้ว"
                    : latestBooking.status === "confirmed"
                    ? "ยืนยันรอบสอบแล้ว"
                    : "รอยืนยัน"}
                </span>
              )}
            </div>

            {latestBooking ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs">
                  <div>
                    <span className="text-neutral-400 block">วันที่สอบ:</span>
                    <span className="font-bold text-neutral-charcoal">
                      {formatThaiDate(latestBooking.examDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">ช่วงเวลา:</span>
                    <span className="font-bold text-ssru-crimson">{latestBooking.timeSlot} น.</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">ห้องสอบ:</span>
                    <span className="font-bold text-neutral-charcoal">{latestBooking.room}</span>
                  </div>
                </div>

                {/* Examiners Matrix */}
                <div className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-2.5">
                  <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-ssru-crimson" />
                    <span>คณะกรรมการผู้ประเมิน 3 ท่าน:</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {latestBooking.examinerNames.map((name, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                        <span className="text-[10px] text-neutral-400 block">กรรมการท่านที่ {i + 1}</span>
                        <span className="font-semibold text-neutral-charcoal">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evaluation Result if available */}
                {qeResult && (
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ผลคะแนนสอบ QE อย่างเป็นทางการ:</span>
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                        มติ {qeResult.passVotesCount}/3 เสียง • เฉลี่ย {qeResult.averageScore}%
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      {qeResult.examinerScores.map((score, idx) => (
                        <div key={idx} className="p-2 bg-white rounded-xl border border-emerald-100 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-neutral-700">{score.examinerName}</span>
                            <p className="text-[11px] text-neutral-500 mt-0.5">{score.comments}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <span className="font-bold text-neutral-charcoal">{score.score} คะแนน</span>
                            <span className={`block text-[10px] font-bold ${
                              score.isPass ? "text-emerald-600" : "text-red-600"
                            }`}>
                              {score.isPass ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 space-y-3">
                <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-neutral-700">คุณยังไม่ได้ลงทะเบียนจองรอบสอบ QE</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    เลือกรอบสอบและช่วงเวลาที่ต้องการเพื่อส่งคำร้องต่อสาขาวิชา
                  </p>
                </div>
                <button
                  onClick={() => setIsBookingModalOpen(true)}
                  className="px-4 py-2 bg-ssru-crimson text-white hover:bg-ssru-600 rounded-xl text-xs font-bold shadow-sm inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>จองรอบสอบตอนนี้</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Action Drawers */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-4">
            <h3 className="text-sm font-bold font-display text-neutral-charcoal">
              เมนูลัดการจัดการโครงงาน
            </h3>

            {/* Button 1: Advisor Logs */}
            <button
              onClick={() => setIsLogsModalOpen(true)}
              className="w-full p-4 rounded-2xl bg-neutral-50 hover:bg-red-50/50 border border-neutral-200/80 hover:border-ssru-crimson/30 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-ssru-50 text-ssru-crimson flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-charcoal">บันทึกการพบที่ปรึกษา</h4>
                  <span className="text-[11px] text-neutral-500">
                    อนุมัติแล้ว {eligibility.advisorLogsCount}/6 ครั้ง
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-ssru-crimson group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Button 2: Conference Evidence */}
            <button
              onClick={() => setIsConferenceModalOpen(true)}
              className="w-full p-4 rounded-2xl bg-neutral-50 hover:bg-red-50/50 border border-neutral-200/80 hover:border-ssru-crimson/30 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-charcoal">หลักฐานงานประชุมวิชาการ</h4>
                  <span className="text-[11px] text-neutral-500">
                    {eligibility.condition3_ConferenceApproved ? "✓ ตรวจสอบผ่านแล้ว" : "ยื่นเอกสาร/ตรวจสถานะ"}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-ssru-crimson group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Button 3: Certificate */}
            {eligibility.isFinalEligible && (
              <button
                onClick={() => setIsCertificateModalOpen(true)}
                className="w-full p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-300 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">หนังสือรับรองสิทธิ์สอบ Final</h4>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      พร้อมพิมพ์เอกสารทางการ
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <QEBookingModal
        student={currentStudent}
        tracks={tracks}
        rounds={examRounds}
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={handleBookingSuccess}
      />

      <AdvisorLogsManager
        student={currentStudent}
        role="student"
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
      />

      <ConferenceEvidenceManager
        student={currentStudent}
        role="student"
        isOpen={isConferenceModalOpen}
        onClose={() => setIsConferenceModalOpen(false)}
      />

      <FinalCertificateModal
        student={currentStudent}
        eligibility={eligibility}
        isOpen={isCertificateModalOpen}
        onClose={() => setIsCertificateModalOpen(false)}
      />
    </div>
  );
}
