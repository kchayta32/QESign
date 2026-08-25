"use client";

import React, { useState } from "react";
import { Student, Track, ExamRound, QEBooking, TrackType } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import { checkQEBookingPrerequisite } from "@/lib/rules/engine";
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
}

export default function QEBookingModal({
  student,
  tracks,
  rounds,
  isOpen,
  onClose,
  onSuccess,
}: QEBookingModalProps) {
  const [selectedTrack, setSelectedTrack] = useState<TrackType>(student.trackId || "SW");
  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState<string>("2026-09-10");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("09:00 - 10:30");
  const [selectedRoom, setSelectedRoom] = useState<string>("ห้องปฏิบัติการ 4731 (CE LAB)");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentRound = rounds.find((r) => r.id === selectedRoundId) || rounds[0];
  const currentTrack = tracks.find((t) => t.id === selectedTrack) || tracks[0];

  // Run Rule 1: Prerequisite Check
  const prerequisite = checkQEBookingPrerequisite(student, selectedTrack);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prerequisite.canBook) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const teachers = dbStore.getTeachers();
      const defaultIds = currentTrack.examinersDefault || ["T-101", "T-104", "T-105"];
      const t1 = teachers.find((t) => t.id === defaultIds[0]) || teachers[0];
      const t2 = teachers.find((t) => t.id === defaultIds[1]) || teachers[1];
      const t3 = teachers.find((t) => t.id === defaultIds[2]) || teachers[2];

      const examiner1 = `${t1.prefixTh}${t1.firstNameTh} ${t1.lastNameTh}`;
      const examiner2 = `${t2.prefixTh}${t2.firstNameTh} ${t2.lastNameTh}`;
      const examiner3 = `${t3.prefixTh}${t3.firstNameTh} ${t3.lastNameTh}`;

      const examinerIds: [string, string, string] = [t1.id, t2.id, t3.id];
      const examinerNames: [string, string, string] = [examiner1, examiner2, examiner3];

      const newBooking = dbStore.createQEBooking({
        studentId: student.id,
        studentUid: student.uid,
        studentCode: student.studentCode,
        studentNameTh: `${student.prefixTh} ${student.firstNameTh} ${student.lastNameTh}`,
        trackId: selectedTrack,
        roundId: currentRound.id,
        roundName: currentRound.titleTh,
        examDate: selectedDate,
        timeSlot: selectedTimeSlot,
        room: selectedRoom,
        status: "pending",
        examinerIds,
        examinerNames,
        prerequisitePassed: true,
        submissionDate: new Date().toISOString().split("T")[0],
        notes,
      });

      setIsSubmitting(false);
      onSuccess(newBooking);
      onClose();
    }, 400);
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
              สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏสวนสุนันทา
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
              prerequisite.canBook
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-amber-50/90 border-amber-200 text-amber-900"
            }`}
          >
            {prerequisite.canBook ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <p className="font-bold">
                {prerequisite.canBook
                  ? "คุณสมบัติผ่านเกณฑ์ (Prerequisite Passed)"
                  : "ไม่สามารถจองสอบได้ในขณะนี้ (Prerequisite Required)"}
              </p>
              <p className="mt-0.5 opacity-90 leading-relaxed">{prerequisite.reasonTh}</p>
            </div>
          </div>

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
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              >
                {rounds.map((r) => (
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
                min="2026-09-01"
                max="2026-09-30"
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              />
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
                {currentRound.slotsPerDay.map((slot) => (
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
                {currentRound.availableRooms.map((room) => (
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
              disabled={!prerequisite.canBook || isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white shadow-md flex items-center space-x-2 transition-all ${
                prerequisite.canBook
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
