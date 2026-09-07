"use client";

import React, { useState } from "react";
import { Student, Track, ExamRound, QEBooking, TrackType } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import { checkQEBookingPrerequisite } from "@/lib/rules/engine";
import { DEPARTMENT_CE_TH, FACULTY_NAME_TH, UNIVERSITY_NAME_TH } from "@/lib/institution";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from "lucide-react";
import TrackSelector from "./TrackSelector";

interface QEBookingModalProps {
  student: Student;
  tracks: Track[];
  rounds: ExamRound[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (booking: QEBooking) => void;
  /** Shown when the 3-chapter prerequisite blocks booking, so the student can go submit the document. */
  onOpenDocuments?: () => void;
}

export default function QEBookingModal({
  student,
  tracks,
  rounds,
  isOpen,
  onClose,
  onSuccess,
  onOpenDocuments,
}: QEBookingModalProps) {
  const qeRounds = rounds.filter((r) => r.type === "QE");
  const initialRound = qeRounds.find((r) => r.isActive) || qeRounds[0];
  const today = new Date().toISOString().split("T")[0];

  const [selectedTrack, setSelectedTrack] = useState<TrackType>(student.trackId || "SW");
  const [selectedRoundId, setSelectedRoundId] = useState<string>(initialRound?.id || "");
  const [selectedDate, setSelectedDate] = useState<string>(
    initialRound ? (initialRound.startDate > today ? initialRound.startDate : today) : today
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(initialRound?.slotsPerDay[0] || "");
  const [selectedRoom, setSelectedRoom] = useState<string>(initialRound?.availableRooms[0] || "");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");

  if (!isOpen) return null;

  const currentRound = qeRounds.find((r) => r.id === selectedRoundId) || initialRound;
  const currentTrack = tracks.find((t) => t.id === selectedTrack) || tracks[0];

  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    const r = qeRounds.find((x) => x.id === roundId);
    if (r) {
      setSelectedDate(r.startDate > today ? r.startDate : today);
      setSelectedTimeSlot(r.slotsPerDay[0] || "");
      setSelectedRoom(r.availableRooms[0] || "");
    }
  };

  // Rule 1: academic prerequisite (status + 3-chapter exam passed via the document pipeline)
  const documents = dbStore.getProjectDocuments(student.id);
  const prerequisite = checkQEBookingPrerequisite(student, selectedTrack, documents);
  const blockedBy3Chapter = !prerequisite.canBook && student.status === "active";

  // Booking-window & capacity rules
  const alreadyPassed = student.passedQE || dbStore.getQEResultByStudent(student.id)?.finalResult === "passed";
  const openBooking = dbStore.getOpenQEBookingByStudent(student.id);
  const existingActive = dbStore
    .getQEBookingsByStudent(student.id)
    .find((b) => b.status !== "cancelled" && b.roundId === currentRound?.id);
  const deadlinePassed = !!currentRound && today > currentRound.bookingDeadline;
  const quotaFull = !!currentTrack && currentTrack.activeBookingsCount >= currentTrack.quotaTotal;
  const dateOutOfRange =
    !!currentRound && (selectedDate < currentRound.startDate || selectedDate > currentRound.endDate || selectedDate < today);

  let blockReason = "";
  if (!currentRound) blockReason = "ยังไม่มีรอบสอบ QE ที่เปิดรับจองในขณะนี้";
  else if (!prerequisite.canBook) blockReason = prerequisite.reasonTh;
  else if (alreadyPassed) blockReason = "คุณผ่านการสอบ QE แล้ว ไม่จำเป็นต้องจองสอบอีก";
  else if (existingActive) blockReason = `คุณมีคำร้องจองสอบในรอบนี้อยู่แล้ว (${existingActive.id}) ไม่สามารถจองซ้ำได้`;
  else if (openBooking) blockReason = `คุณมีคำร้องจองสอบที่ยังไม่ได้ประเมินผลอยู่แล้ว (${openBooking.id} • ${openBooking.examDate}) กรุณารอผลสอบก่อนจองใหม่`;
  else if (deadlinePassed) blockReason = `รอบสอบนี้ปิดรับจองแล้ว (หมดเขต ${currentRound.bookingDeadline})`;
  else if (quotaFull) blockReason = `โควตาที่นั่งของแทร็ก ${currentTrack.code} เต็มแล้ว (${currentTrack.activeBookingsCount}/${currentTrack.quotaTotal})`;
  const canBook = blockReason === "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (isSubmitting || !canBook || !currentRound) return;
    if (dateOutOfRange) {
      setSubmitError(`กรุณาเลือกวันสอบระหว่าง ${currentRound.startDate} ถึง ${currentRound.endDate} (และไม่ย้อนหลัง)`);
      return;
    }
    if (!selectedTimeSlot || !selectedRoom) {
      setSubmitError("กรุณาเลือกช่วงเวลาและห้องสอบ");
      return;
    }

    setIsSubmitting(true);
    try {
      const teachers = dbStore.getTeachers().filter((t) => t.isCommittee);
      const defaultIds = currentTrack.examinersDefault || [];
      const picked = defaultIds
        .map((id) => teachers.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t);
      for (const t of teachers) {
        if (picked.length >= 3) break;
        if (!picked.includes(t)) picked.push(t);
      }
      if (picked.length < 3) {
        setSubmitError("จำนวนกรรมการสอบในระบบไม่เพียงพอ (ต้องมีอย่างน้อย 3 ท่าน) กรุณาติดต่อผู้ดูแลระบบ");
        return;
      }
      const [t1, t2, t3] = picked;
      const name = (t: typeof t1) => `${t.prefixTh}${t.firstNameTh} ${t.lastNameTh}`;

      const newBooking = await dbStore.createQEBooking({
        studentId: student.id,
        studentUid: student.uid,
        studentCode: student.studentCode,
        studentNameTh: `${student.prefixTh} ${student.firstNameTh} ${student.lastNameTh}`.trim(),
        trackId: selectedTrack,
        roundId: currentRound.id,
        roundName: currentRound.titleTh,
        examDate: selectedDate,
        timeSlot: selectedTimeSlot,
        room: selectedRoom,
        status: "pending",
        examinerIds: [t1.id, t2.id, t3.id],
        examinerNames: [name(t1), name(t2), name(t3)],
        prerequisitePassed: true,
        submissionDate: today,
        notes,
      });

      onSuccess(newBooking);
      onClose();
    } catch (error: any) {
      setSubmitError(error?.message || "บันทึกการจองไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Modal Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-100 text-ssru-crimson">
                QE Registration
              </span>
              <h3 className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">
                ยื่นคำร้องจองรอบสอบวัดคุณสมบัติ (Qualifying Exam)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              {DEPARTMENT_CE_TH} {FACULTY_NAME_TH} {UNIVERSITY_NAME_TH}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
          {/* Prerequisite Alert Box */}
          <div
            className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
              canBook
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-amber-50/90 border-amber-200 text-amber-900"
            }`}
          >
            {canBook ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-xs flex-1">
              <p className="font-bold">
                {canBook ? "คุณสมบัติผ่านเกณฑ์ พร้อมจองสอบ (Eligible to Book)" : "ไม่สามารถจองสอบได้ในขณะนี้"}
              </p>
              <p className="mt-0.5 opacity-90 leading-relaxed">{canBook ? prerequisite.reasonTh : blockReason}</p>
              {blockedBy3Chapter && onOpenDocuments && (
                <button
                  type="button"
                  onClick={onOpenDocuments}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 transition-colors"
                >
                  ไปที่เมนูเอกสารโครงงาน (ส่งเอกสารสอบ 3 บท) →
                </button>
              )}
            </div>
          </div>

          {submitError && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Student Info Summary */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-neutral-400 block">ผู้ยื่นคำร้อง:</span>
              <span className="font-bold text-neutral-charcoal">
                {student.prefixTh} {student.firstNameTh} {student.lastNameTh}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block">รหัสนักศึกษา:</span>
              <span className="font-bold text-neutral-charcoal">{student.studentCode}</span>
            </div>
            <div>
              <span className="text-neutral-400 block">ชั้นปี:</span>
              <span className="font-bold text-neutral-charcoal">ชั้นปีที่ {student.yearLevel}</span>
            </div>
          </div>

          {/* Track Selector Component */}
          <div>
            <TrackSelector
              tracks={tracks}
              selectedTrack={selectedTrack}
              onSelectTrack={setSelectedTrack}
            />
          </div>

          {/* Exam Round & Date / Time Slot Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Round */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-ssru-crimson" />
                <span>เลือกรอบการสอบ</span>
              </label>
              <select
                value={selectedRoundId}
                onChange={(e) => handleRoundChange(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              >
                {qeRounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.titleTh} (หมดเขต: {r.bookingDeadline})
                  </option>
                ))}
              </select>
            </div>

            {/* Exam Date */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-ssru-crimson" />
                <span>วันที่ต้องการเข้าสอบ</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={currentRound && currentRound.startDate > today ? currentRound.startDate : today}
                max={currentRound?.endDate}
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              />
              {currentRound && (
                <p className="text-[10px] text-neutral-400 mt-1">
                  ช่วงสอบ {currentRound.startDate} – {currentRound.endDate}
                </p>
              )}
            </div>

            {/* Time Slot */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-ssru-crimson" />
                <span>ช่วงเวลาสอบ (Time Slot)</span>
              </label>
              <select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              >
                {(currentRound?.slotsPerDay || []).map((slot) => (
                  <option key={slot} value={slot}>
                    {slot} น.
                  </option>
                ))}
              </select>
            </div>

            {/* Room */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-ssru-crimson" />
                <span>สถานที่สอบ</span>
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              >
                {(currentRound?.availableRooms || []).map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              หมายเหตุ / รายละเอียดอุปกรณ์เพิ่มเติม (ถ้ามี)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น มีอุปกรณ์ฮาร์ดแวร์จริง หรือต้องการโปรเจกเตอร์ต่อ HDMI"
              className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
            />
          </div>

          {/* Committee Preview Box */}
          <div className="p-4 rounded-2xl bg-ssru-50/50 border border-ssru-crimson/20">
            <div className="flex items-center space-x-2 text-xs font-bold text-ssru-crimson mb-2">
              <Users className="w-4 h-4" />
              <span>คณะกรรมการสอบ QE ประจำแทร็ก ({currentTrack.nameTh})</span>
            </div>
            <p className="text-[11px] text-neutral-600">
              ระบบจัดกรรมการ 3 ท่านจากคณาจารย์ประจำสาขาวิชา สำหรับประเมินผลสอบตามเกณฑ์มติ 2 ใน 3 เสียง
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={!canBook || isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white shadow-md flex items-center space-x-2 transition-all ${
                canBook
                  ? "bg-ssru-crimson hover:bg-ssru-600 active:scale-95 shadow-ssru-crimson/20"
                  : "bg-neutral-300 cursor-not-allowed text-neutral-500 shadow-none"
              }`}
            >
              {isSubmitting ? (
                <span>กำลังบันทึก...</span>
              ) : (
                <>
                  <span>ยืนยันการจองสอบ QE</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
