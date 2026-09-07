"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { dbStore, getSlotBookedStudents } from "@/lib/firebase/db";
import { formatThaiDate } from "@/lib/utils";
import TeacherEvaluationSheet from "./TeacherEvaluationSheet";
import AdvisorLogsManager from "./AdvisorLogsManager";
import ConferenceEvidenceManager from "./ConferenceEvidenceManager";
import ProjectDocumentsManager from "./ProjectDocumentsManager";
import TeacherExamSlotModal from "./TeacherExamSlotModal";
import {
  Users,
  BookOpen,
  FileCheck2,
  Calendar,
  Clock,
  CheckCircle2,
  Calculator,
  Sparkles,
  Search,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  MapPin,
  Cpu,
  Code2,
  Database,
  FileCheck
} from "lucide-react";
import { QEBooking, Student, ProjectDocumentType, ExamSlot } from "@/types";
import Avatar from "./Avatar";
import { PROJECT_DOCUMENT_STAGES, getDocumentStage, getLatestDocument, hasPassed3ChapterExam, isProjectAdvisor } from "@/lib/rules/engine";

export default function TeacherDashboard() {
  const { currentTeacher, allStudents } = useAuth();

  const [selectedBookingForEval, setSelectedBookingForEval] = useState<QEBooking | null>(null);
  const [selectedStudentForLogs, setSelectedStudentForLogs] = useState<Student | null>(null);
  const [selectedStudentForConf, setSelectedStudentForConf] = useState<Student | null>(null);
  const [selectedStudentForDocs, setSelectedStudentForDocs] = useState<{ student: Student; focus?: ProjectDocumentType } | null>(null);
  const [isExamSlotModalOpen, setIsExamSlotModalOpen] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllBookings, setShowAllBookings] = useState(false);

  if (!currentTeacher) {
    return (
      <div className="p-8 text-center text-neutral-500">
        <p>ไม่พบข้อมูลอาจารย์ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>
      </div>
    );
  }

  const qeBookings = dbStore.getQEBookings().filter((b) => b.status !== "cancelled");
  const myBookings = qeBookings.filter((b) => b.examinerIds.includes(currentTeacher.id));
  const visibleBookings = (showAllBookings && currentTeacher.isCommittee ? qeBookings : myBookings)
    .slice()
    .sort((a, b) => {
      // Awaiting evaluation first, then by exam date
      const aDone = a.status === "evaluated" ? 1 : 0;
      const bDone = b.status === "evaluated" ? 1 : 0;
      return aDone - bDone || a.examDate.localeCompare(b.examDate);
    });
  const awaitingCount = myBookings.filter((b) => b.status !== "evaluated").length;

  const allExamSlots = dbStore.getExamSlots().filter((s) => s.status !== "cancelled");
  const myExamSlots = allExamSlots.filter((s) => s.teacherId === currentTeacher.id);
  const visibleExamSlots = showAllSlots ? allExamSlots : myExamSlots;
  const myOpenSlotsCount = myExamSlots.filter((s) => s.status === "open").length;

  const handleCancelSlot = async (slotId: string) => {
    if (!window.confirm("ต้องการยกเลิกรอบสอบนี้ใช่หรือไม่?")) return;
    try {
      await dbStore.cancelExamSlot(slotId, currentTeacher.id);
    } catch (e: any) {
      alert(e?.message || "ไม่สามารถยกเลิกได้");
    }
  };

  const advisees = allStudents.filter((s) => isProjectAdvisor(s, currentTeacher.id));

  const q = searchQuery.trim().toLowerCase();
  const filteredAdvisees = advisees.filter(
    (s) =>
      !q ||
      s.firstNameTh.toLowerCase().includes(q) ||
      s.lastNameTh.toLowerCase().includes(q) ||
      s.studentCode.includes(q)
  );

  // Documents submitted by my advisees that still need a result.
  const pendingDocs = dbStore.getPendingProjectDocuments(currentTeacher.id);

  const openDocsFor = (student: Student, focus?: ProjectDocumentType) => setSelectedStudentForDocs({ student, focus });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Teacher Top Info Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-soft border border-neutral-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <Avatar
              src={currentTeacher.avatarUrl}
              name={`${currentTeacher.firstNameTh} ${currentTeacher.lastNameTh}`}
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover border-2 border-ssru-crimson/20 shadow-md flex-shrink-0 bg-white"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-ssru-crimson border border-ssru-crimson/20">
                  {currentTeacher.teacherCode}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700">
                  {currentTeacher.isCommittee ? "กรรมการสอบวัดคุณสมบัติ & อาจารย์ที่ปรึกษา" : "อาจารย์ที่ปรึกษา"}
                </span>
              </div>
              <h2 className="text-lg md:text-2xl font-bold font-display text-neutral-charcoal leading-tight">
                {currentTeacher.prefixTh}{currentTeacher.firstNameTh} {currentTeacher.lastNameTh}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {currentTeacher.department ? `สาขาวิชา${currentTeacher.department} • ` : ""}
                อีเมล: <span className="font-semibold text-neutral-700">{currentTeacher.email}</span> • เชี่ยวชาญแทร็ก: {currentTeacher.specializations.join(", ")}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-center min-w-[90px]">
              <span className="text-neutral-400 text-xs block">นักศึกษาที่ปรึกษา</span>
              <span className="text-lg font-bold text-neutral-charcoal font-display">
                {advisees.length} คน
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-ssru-50/50 border border-ssru-crimson/20 text-center min-w-[90px]">
              <span className="text-ssru-crimson text-xs block font-semibold">รอประเมิน QE</span>
              <span className="text-lg font-bold text-ssru-crimson font-display">
                {awaitingCount} รายการ
              </span>
            </div>
            <div className={`p-3.5 rounded-2xl border text-center min-w-[90px] ${pendingDocs.length > 0 ? "bg-amber-50 border-amber-200" : "bg-neutral-50 border-neutral-200"}`}>
              <span className={`text-xs block font-semibold ${pendingDocs.length > 0 ? "text-amber-800" : "text-neutral-400"}`}>เอกสารรอตรวจ</span>
              <span className={`text-lg font-bold font-display ${pendingDocs.length > 0 ? "text-amber-900" : "text-neutral-charcoal"}`}>
                {pendingDocs.length} ฉบับ
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-center min-w-[90px]">
              <span className="text-neutral-400 text-xs block">รอบสอบเปิดรับ</span>
              <span className="text-lg font-bold text-neutral-charcoal font-display">
                {myOpenSlotsCount} รอบ
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsExamSlotModalOpen(true)}
              className="px-4 py-3.5 bg-gradient-to-r from-ssru-crimson to-ssru-600 hover:from-ssru-600 hover:to-ssru-dark text-white rounded-2xl font-bold text-xs md:text-sm shadow-md shadow-ssru-crimson/20 flex items-center space-x-2 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>เปิดรอบจองสอบ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 0: Project documents awaiting review (Proposal / สอบ 3 บท / สอบ 5 บท) */}
      {pendingDocs.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-amber-200">
          <div className="flex items-center space-x-2.5 pb-4 mb-4 border-b border-neutral-100">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-neutral-charcoal">เอกสารโครงงานที่รอบันทึกผล ({pendingDocs.length} ฉบับ)</h3>
              <p className="text-xs text-neutral-500">Proposal • สอบ 3 บท (เงื่อนไขก่อนจอง QE) • สอบ 5 บท — คลิกเพื่อเปิดไฟล์ PDF และบันทึกผล ผ่าน/ไม่ผ่าน</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingDocs.map((doc) => {
              const student = dbStore.getStudentById(doc.studentId);
              const stage = getDocumentStage(doc.docType);
              return (
                <button
                  key={doc.id}
                  onClick={() => student && openDocsFor(student, doc.docType)}
                  className="p-4 rounded-2xl border border-neutral-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 transition-all text-left space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">{stage.shortTh} • ฉบับที่ {doc.version}</span>
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatThaiDate(doc.submittedAt)}</span>
                  </div>
                  <p className="text-sm font-bold text-neutral-charcoal">{doc.studentNameTh}</p>
                  <p className="text-xs text-neutral-500 font-mono">{doc.studentCode}</p>
                  <p className="text-[11px] text-neutral-600 flex items-center gap-1 truncate"><FileText className="w-3.5 h-3.5 text-ssru-crimson flex-shrink-0" /> {doc.fileName}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section: Teacher Exam Slot Management (เปิดระบบจองสอบ QE & โครงงาน) */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-neutral-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-red-50 text-ssru-crimson">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-display text-neutral-charcoal">
                  ระบบเปิดรอบจองสอบ (QE &amp; โครงงาน)
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-ssru-50 text-ssru-crimson">
                  {visibleExamSlots.length} รอบ
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                อาจารย์สามารถเปิดช่วงเวลาสอบ QE (ฮาร์ตแวร์/ซอฟต์แวร์/ฐานข้อมูล) และการสอบโครงงาน พร้อมระบุสถานที่สอบเพื่อให้นักศึกษาเลือกจอง
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllSlots}
                onChange={(e) => setShowAllSlots(e.target.checked)}
                className="accent-ssru-crimson"
              />
              <span>แสดงรอบสอบของคณาจารย์ทุกคน</span>
            </label>

            <button
              type="button"
              onClick={() => setIsExamSlotModalOpen(true)}
              className="px-4 py-2 bg-ssru-crimson hover:bg-ssru-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>เปิดรอบจองสอบใหม่</span>
            </button>
          </div>
        </div>

        {visibleExamSlots.length === 0 ? (
          <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-500 space-y-2">
            <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
            <p className="font-semibold">ยังไม่มีรอบสอบที่ท่านเปิดไว้</p>
            <p className="text-neutral-400">กดปุ่ม &quot;เปิดรอบจองสอบใหม่&quot; เพื่อกำหนดวัน เวลา สถานที่สอบ QE หรือสอบโครงงาน</p>
            <button
              type="button"
              onClick={() => setIsExamSlotModalOpen(true)}
              className="mt-1 px-4 py-2 rounded-xl bg-white border border-neutral-300 font-bold text-neutral-700 hover:bg-neutral-100 shadow-sm"
            >
              + เปิดรอบจองสอบตอนนี้
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleExamSlots.map((slot) => {
              const isMine = slot.teacherId === currentTeacher.id;
              const bookedStudents = getSlotBookedStudents(slot);
              const capacity = Math.max(1, slot.capacity || 1);
              const bookedCount = bookedStudents.length;
              const isFull = bookedCount >= capacity;
              const hasBookings = bookedCount > 0;

              return (
                <div
                  key={slot.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    isFull
                      ? "bg-neutral-50/80 border-neutral-300"
                      : hasBookings
                      ? "bg-blue-50/40 border-blue-200"
                      : "bg-white border-neutral-200 hover:border-neutral-300 shadow-sm"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {slot.category === "QE" ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-ssru-crimson flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>QE {slot.qeType}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            <span>โครงงาน {slot.projectStage}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {slot.id.split("-")[1]}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isFull
                            ? "bg-neutral-200 text-neutral-700"
                            : hasBookings
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isFull
                          ? `ที่นั่งเต็ม (${bookedCount}/${capacity})`
                          : hasBookings
                          ? `จองแล้ว ${bookedCount}/${capacity} ที่`
                          : `เปิดรับจอง (${capacity} ที่นั่ง)`}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-neutral-charcoal line-clamp-2">
                      {slot.title}
                    </h4>

                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 text-[11px] space-y-1">
                      <div className="flex items-center text-neutral-600 gap-1">
                        <Calendar className="w-3 h-3 text-ssru-crimson flex-shrink-0" />
                        <span>{formatThaiDate(slot.examDate)}</span>
                      </div>
                      <div className="flex items-center text-neutral-600 gap-1">
                        <Clock className="w-3 h-3 text-ssru-crimson flex-shrink-0" />
                        <span className="font-semibold text-ssru-crimson">{slot.timeSlot} น.</span>
                      </div>
                      <div className="flex items-start text-neutral-600 gap-1">
                        <MapPin className="w-3 h-3 text-ssru-crimson flex-shrink-0 mt-0.5" />
                        <span className="font-medium break-words">{slot.location}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-600 pt-1 border-t border-neutral-200/60">
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500">
                          <Users className="w-3 h-3 text-neutral-400" />
                          <span>ความจุที่นั่งสอบ:</span>
                        </span>
                        <span className="text-[11px] font-bold text-neutral-700">
                          {bookedCount} / {capacity} ที่นั่ง
                          {capacity - bookedCount > 0 ? (
                            <span className="text-emerald-600 font-normal ml-1">
                              (ว่าง {capacity - bookedCount})
                            </span>
                          ) : (
                            <span className="text-red-500 font-normal ml-1">(เต็ม)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {hasBookings && (
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-blue-700" />
                            <span>รายชื่อผู้จองสอบ ({bookedCount} คน):</span>
                          </span>
                        </div>
                        <div className="divide-y divide-blue-200/50 max-h-32 overflow-y-auto space-y-1">
                          {bookedStudents.map((st, i) => (
                            <div key={st.studentId || i} className="pt-1 first:pt-0 flex items-center justify-between text-[10.5px]">
                              <div>
                                <span className="font-semibold block text-neutral-800">{st.studentName}</span>
                                <span className="font-mono text-[10px] text-neutral-500">{st.studentCode}</span>
                              </div>
                              {st.notes && (
                                <span className="text-[10px] text-neutral-500 italic max-w-[120px] truncate" title={st.notes}>
                                  {st.notes}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 truncate max-w-[150px]" title={slot.teacherName}>
                      โดย {slot.teacherName}
                    </span>

                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleCancelSlot(slot.id)}
                        className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                        title="ยกเลิกรอบสอบนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ยกเลิก</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 1: Pending QE Examinations & 3-Examiner Evaluation Sheet */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-ssru-50 text-ssru-crimson">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-neutral-charcoal">
                รายการสอบวัดคุณสมบัติที่ต้องประเมิน (QE Evaluation Queue)
              </h3>
              <p className="text-xs text-neutral-500">
                ประเมินผลคะแนนรายบุคคล 3 กรรมการด้วยเกณฑ์มติ 2 ใน 3 เสียง
              </p>
            </div>
          </div>
          {currentTeacher.isCommittee && (
            <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
              <input type="checkbox" checked={showAllBookings} onChange={(e) => setShowAllBookings(e.target.checked)} className="accent-ssru-crimson" />
              <span>แสดงทุกรอบสอบของสาขา</span>
            </label>
          )}
        </div>

        {visibleBookings.length === 0 && (
          <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-500">
            ยังไม่มีรอบสอบที่ท่านได้รับมอบหมายให้ประเมิน
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleBookings.map((booking) => {
            const result = dbStore.getQEResultByBooking(booking.id);
            const isEvaluated = booking.status === "evaluated" && !!result;

            return (
              <div
                key={booking.id}
                className="p-5 rounded-2xl border border-neutral-200 bg-white hover:border-ssru-crimson/40 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-ssru-50 text-ssru-crimson">
                        Track: {booking.trackId}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        {booking.studentCode}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-charcoal">
                      {booking.studentNameTh}
                    </h4>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    isEvaluated ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {isEvaluated ? "ประเมินผลแล้ว" : "รอประเมิน"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-neutral-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      {formatThaiDate(booking.examDate)} ({booking.timeSlot} น.)
                    </span>
                    <span className="font-semibold text-neutral-700">{booking.room}</span>
                  </div>
                </div>

                {isEvaluated && result && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-xs flex items-center justify-between">
                    <span className="font-bold text-emerald-900">
                      มติ {result.passVotesCount}/3 เสียง ({result.finalResult === "passed" ? "ผ่าน" : "ไม่ผ่าน"})
                    </span>
                    <span className="text-emerald-700 font-medium">
                      เฉลี่ย {result.averageScore}%
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setSelectedBookingForEval(booking)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center space-x-2 transition-colors shadow-sm"
                >
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <span>{isEvaluated ? "ดู/แก้ไขแบบประเมิน 3 กรรมการ" : "เปิดแบบประเมินผลสอบ (3 กรรมการ)"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Advisees Progress & 3-Condition Gate Tracking Table */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-neutral-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-ssru-50 text-ssru-crimson">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-neutral-charcoal">
                นักศึกษาในความดูแล (Advisees 3-Condition Pipeline)
              </h3>
              <p className="text-xs text-neutral-500">
                ติดตามสถานะ บันทึกพบที่ปรึกษา, ผลสอบ QE และเอกสารตีพิมพ์
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือรหัสนักศึกษา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20"
            />
          </div>
        </div>

        {/* Advisees Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 uppercase text-[10px] tracking-wider border-b border-neutral-200">
                <th className="py-3 px-4 font-bold">นักศึกษา</th>
                <th className="py-3 px-3 font-bold">Track</th>
                <th className="py-3 px-3 font-bold">เอกสาร / สอบ 3 บท</th>
                <th className="py-3 px-3 font-bold">1. บันทึกที่ปรึกษา</th>
                <th className="py-3 px-3 font-bold">2. ผลสอบ QE</th>
                <th className="py-3 px-3 font-bold">3. เอกสาร Conference</th>
                <th className="py-3 px-3 font-bold">Final Gate</th>
                <th className="py-3 px-4 font-bold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredAdvisees.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    {advisees.length === 0
                      ? "ยังไม่มีนักศึกษาเลือกท่านเป็นอาจารย์ที่ปรึกษา (นักศึกษาจะเลือกที่ปรึกษาเมื่อกรอกโปรไฟล์ครั้งแรก)"
                      : "ไม่พบนักศึกษาที่ตรงกับคำค้นหา"}
                  </td>
                </tr>
              )}
              {filteredAdvisees.map((student) => {
                const eligibility = dbStore.getStudentEligibility(student.id);
                const confList = dbStore.getConferenceEvidence(student.id);
                const hasPendingConf = confList.some((c) => c.status === "pending");
                const docs = dbStore.getProjectDocuments(student.id);
                const passed3 = hasPassed3ChapterExam(student, docs);
                const ch3 = getLatestDocument(docs, "chapter3");
                const docsPending = docs.filter((d) => d.status === "submitted").length;

                return (
                  <tr key={student.id} className="hover:bg-neutral-50/80 transition-colors">
                    {/* Student Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <Avatar
                          src={student.avatarUrl}
                          name={`${student.firstNameTh} ${student.lastNameTh}`}
                          className="w-8 h-8 rounded-full object-cover bg-neutral-100"
                        />
                        <div>
                          <p className="font-bold text-neutral-charcoal">
                            {student.prefixTh} {student.firstNameTh} {student.lastNameTh}
                          </p>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            {student.studentCode}
                            {!student.profileCompleted && <span className="ml-1 text-amber-600">• ยังไม่กรอกโปรไฟล์</span>}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Track */}
                    <td className="py-3.5 px-3 font-semibold text-ssru-crimson">
                      {student.trackId}
                    </td>

                    {/* Project documents; the 3-chapter result (QE prerequisite) is recorded on the chapter3 PDF */}
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => openDocsFor(student, passed3 ? undefined : "chapter3")}
                        title="เปิดเอกสารโครงงาน (Proposal / สอบ 3 บท / สอบ 5 บท) เพื่อดูไฟล์และบันทึกผล"
                        className="text-left space-y-1"
                      >
                        <span
                          className={`block w-fit px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                            passed3
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200"
                              : ch3?.status === "submitted"
                              ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 animate-pulse"
                              : ch3?.status === "rejected"
                              ? "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                          }`}
                        >
                          {passed3 ? "✓ ผ่าน 3 บท" : ch3?.status === "submitted" ? "3 บท: รอบันทึกผล" : ch3?.status === "rejected" ? "3 บท: ไม่ผ่าน" : "3 บท: ยังไม่ส่ง"}
                        </span>
                        <span className="block text-[10px] text-neutral-400 whitespace-nowrap">
                          {PROJECT_DOCUMENT_STAGES.map((s) => {
                            const d = getLatestDocument(docs, s.type);
                            const mark = d?.status === "approved" ? "✓" : d?.status === "submitted" ? "⏳" : d?.status === "rejected" ? "✗" : "–";
                            return `${s.shortTh} ${mark}`;
                          }).join(" • ")}
                          {docsPending > 0 ? ` • รอตรวจ ${docsPending}` : ""}
                        </span>
                      </button>
                    </td>

                    {/* Condition 1: Advisor Logs */}
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => setSelectedStudentForLogs(student)}
                        className="hover:underline flex items-center space-x-1 font-semibold"
                      >
                        <span className={eligibility.condition1_LogsApproved ? "text-emerald-700" : "text-amber-700"}>
                          {eligibility.advisorLogsCount}/6 ครั้ง
                        </span>
                        {eligibility.condition1_LogsApproved && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-1" />
                        )}
                      </button>
                    </td>

                    {/* Condition 2: QE Result */}
                    <td className="py-3.5 px-3">
                      {eligibility.condition2_QEPassed ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center w-fit gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ผ่าน ({eligibility.qePassVotes}/3)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-neutral-100 text-neutral-600">
                          {eligibility.qeStatus === "pending" ? "รอประเมิน" : "ยังไม่ผ่าน"}
                        </span>
                      )}
                    </td>

                    {/* Condition 3: Conference Proof */}
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => setSelectedStudentForConf(student)}
                        className="hover:underline"
                      >
                        {eligibility.condition3_ConferenceApproved ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center w-fit gap-1">
                            <CheckCircle2 className="w-3 h-3" /> รับรองแล้ว
                          </span>
                        ) : hasPendingConf ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center w-fit gap-1 animate-pulse">
                            <Clock className="w-3 h-3" /> รอตรวจเอกสาร
                          </span>
                        ) : (
                          <span className="text-neutral-400">ยังไม่ส่ง</span>
                        )}
                      </button>
                    </td>

                    {/* Final Gate Status */}
                    <td className="py-3.5 px-3">
                      {eligibility.isFinalEligible ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow-sm flex items-center w-fit gap-1">
                          <Sparkles className="w-3 h-3" /> ปลดล็อกแล้ว
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-500">
                          ขาดเงื่อนไข
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openDocsFor(student)}
                          title="เอกสารโครงงาน (Proposal / สอบ 3 บท / สอบ 5 บท)"
                          className="p-1.5 text-neutral-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedStudentForLogs(student)}
                          title="ตรวจบันทึกการเข้าพบ"
                          className="p-1.5 text-neutral-600 hover:text-ssru-crimson hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedStudentForConf(student)}
                          title="ตรวจเอกสาร Conference"
                          className="p-1.5 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FileCheck2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedBookingForEval && (
        <TeacherEvaluationSheet
          booking={selectedBookingForEval}
          currentTeacher={currentTeacher}
          existingResult={dbStore.getQEResultByBooking(selectedBookingForEval.id)}
          isOpen={!!selectedBookingForEval}
          onClose={() => setSelectedBookingForEval(null)}
          onSaved={() => setSelectedBookingForEval(null)}
        />
      )}

      {selectedStudentForLogs && (
        <AdvisorLogsManager
          student={selectedStudentForLogs}
          currentTeacher={currentTeacher}
          role="teacher"
          isOpen={!!selectedStudentForLogs}
          onClose={() => setSelectedStudentForLogs(null)}
        />
      )}

      {selectedStudentForConf && (
        <ConferenceEvidenceManager
          student={selectedStudentForConf}
          currentTeacher={currentTeacher}
          role="teacher"
          isOpen={!!selectedStudentForConf}
          onClose={() => setSelectedStudentForConf(null)}
        />
      )}

      {selectedStudentForDocs && (
        <ProjectDocumentsManager
          student={selectedStudentForDocs.student}
          currentTeacher={currentTeacher}
          role="teacher"
          focusType={selectedStudentForDocs.focus}
          isOpen={!!selectedStudentForDocs}
          onClose={() => setSelectedStudentForDocs(null)}
        />
      )}

      {isExamSlotModalOpen && (
        <TeacherExamSlotModal
          teacher={currentTeacher}
          isOpen={isExamSlotModalOpen}
          onClose={() => setIsExamSlotModalOpen(false)}
        />
      )}
    </div>
  );
}
