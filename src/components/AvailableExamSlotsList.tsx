"use client";

import React, { useState } from "react";
import { Student, ExamSlot, ExamCategory, TrackType } from "@/types";
import { dbStore, getSlotBookedStudents } from "@/lib/firebase/db";
import { formatThaiDate } from "@/lib/utils";
import { checkQEBookingPrerequisite } from "@/lib/rules/engine";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  Check,
  Cpu,
  Code2,
  Database,
  FileCheck
} from "lucide-react";

interface AvailableExamSlotsListProps {
  student: Student;
  onOpenDocuments?: () => void;
  onSuccess?: () => void;
}

export default function AvailableExamSlotsList({
  student,
  onOpenDocuments,
  onSuccess,
}: AvailableExamSlotsListProps) {
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | ExamCategory>("ALL");
  const [confirmingSlot, setConfirmingSlot] = useState<ExamSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState<string>("");
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const allSlots = dbStore.getExamSlots().filter((s) => s.status !== "cancelled");
  const filteredSlots = allSlots.filter((slot) => {
    if (selectedCategory === "ALL") return true;
    return slot.category === selectedCategory;
  });

  const documents = dbStore.getProjectDocuments(student.id);

  const handleOpenBookingConfirm = (slot: ExamSlot) => {
    setErrorMsg("");
    setSuccessMsg("");
    setBookingNotes("");
    setConfirmingSlot(slot);
  };

  const handleConfirmBook = async () => {
    if (!confirmingSlot) return;
    setErrorMsg("");
    setIsBooking(true);

    try {
      await dbStore.bookExamSlot(confirmingSlot.id, student, bookingNotes.trim() || undefined);
      setSuccessMsg(`จองรอบสอบสำเร็จ: ${confirmingSlot.title} (${formatThaiDate(confirmingSlot.examDate)} เวลา ${confirmingSlot.timeSlot} น.)`);
      setConfirmingSlot(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || "จองรอบสอบไม่สำเร็จ");
    } finally {
      setIsBooking(false);
    }
  };

  // Eligibility evaluation for selected confirming slot
  let qePrerequisite = { canBook: true, reasonTh: "" };
  let isAlreadyPassedQE = false;
  let hasOpenQEBooking = false;
  let isSlotFull = false;
  let isAlreadyBookedByMe = false;

  if (confirmingSlot) {
    const booked = getSlotBookedStudents(confirmingSlot);
    const cap = Math.max(1, confirmingSlot.capacity || 1);
    isSlotFull = booked.length >= cap;
    isAlreadyBookedByMe = booked.some(
      (s) => s.studentId === student.id || s.studentCode === student.studentCode
    );

    if (confirmingSlot.category === "QE") {
      const trackId = (confirmingSlot.qeType as TrackType) || student.trackId || "SW";
      qePrerequisite = checkQEBookingPrerequisite(student, trackId, documents);
      isAlreadyPassedQE = student.passedQE || dbStore.getQEResultByStudent(student.id)?.finalResult === "passed";
      hasOpenQEBooking = !!dbStore.getOpenQEBookingByStudent(student.id);
    }
  }

  const canConfirm =
    !confirmingSlot ||
    (!isSlotFull &&
      !isAlreadyBookedByMe &&
      (confirmingSlot.category === "QE"
        ? qePrerequisite.canBook && !isAlreadyPassedQE && !hasOpenQEBooking
        : student.status === "active"));

  return (
    <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-red-50 text-ssru-crimson">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-neutral-charcoal">
              รายการรอบสอบที่อาจารย์เปิดรับจอง (Available Exam Sessions)
            </h3>
            <p className="text-xs text-neutral-500">
              เลือกรอบสอบ QE (ฮาร์ตแวร์/ซอฟต์แวร์/ฐานข้อมูล) หรือรอบสอบโครงงานที่อาจารย์เปิดรับในระบบ
            </p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center bg-neutral-100 p-1 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              selectedCategory === "ALL"
                ? "bg-white text-neutral-charcoal shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            ทั้งหมด ({allSlots.length})
          </button>
          <button
            onClick={() => setSelectedCategory("QE")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 ${
              selectedCategory === "QE"
                ? "bg-white text-ssru-crimson shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <span>สอบ QE</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-50 text-ssru-crimson">
              {allSlots.filter((s) => s.category === "QE").length}
            </span>
          </button>
          <button
            onClick={() => setSelectedCategory("PROJECT")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 ${
              selectedCategory === "PROJECT"
                ? "bg-white text-amber-700 shadow-sm font-bold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <span>สอบโครงงาน</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800">
              {allSlots.filter((s) => s.category === "PROJECT").length}
            </span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Slots Grid */}
      {filteredSlots.length === 0 ? (
        <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-500 space-y-1">
          <p className="font-semibold">ยังไม่มีรอบสอบเปิดรับจองในหมวดหมู่นี้</p>
          <p className="text-neutral-400">เมื่อคณาจารย์เปิดช่วงเวลาสอบเพิ่มเติม ระบบจะแสดงในรายการนี้ทันที</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSlots.map((slot) => {
            const bookedStudents = getSlotBookedStudents(slot);
            const capacity = Math.max(1, slot.capacity || 1);
            const bookedCount = bookedStudents.length;
            const isBookedByMe = bookedStudents.some(
              (s) => s.studentId === student.id || s.studentCode === student.studentCode
            );
            const isFull = bookedCount >= capacity;
            const remainingSeats = Math.max(0, capacity - bookedCount);
            const isAvailable = !isFull && !isBookedByMe;

            return (
              <div
                key={slot.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 ${
                  isBookedByMe
                    ? "bg-blue-50/60 border-blue-300 shadow-sm"
                    : isAvailable
                    ? "bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-md"
                    : "bg-neutral-50/80 border-neutral-200 opacity-80"
                }`}
              >
                <div>
                  {/* Category & Type Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {slot.category === "QE" ? (
                        <>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-ssru-crimson border border-ssru-crimson/20 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>สอบ QE</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 flex items-center gap-1">
                            {slot.qeType === "HW" && <Cpu className="w-3 h-3 text-emerald-600" />}
                            {slot.qeType === "SW" && <Code2 className="w-3 h-3 text-blue-600" />}
                            {slot.qeType === "DB" && <Database className="w-3 h-3 text-amber-600" />}
                            <span>
                              {slot.qeType === "HW" ? "ฮาร์ตแวร์ (HW)" : slot.qeType === "SW" ? "ซอฟต์แวร์ (SW)" : "ระบบฐานข้อมูล (DB)"}
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            <span>สอบโครงงาน</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 flex items-center gap-1">
                            <FileCheck className="w-3 h-3 text-ssru-crimson" />
                            <span>
                              {slot.projectStage === "proposal"
                                ? "หัวข้อ Proposal"
                                : slot.projectStage === "chapter3"
                                ? "ความก้าวหน้า 3 บท"
                                : "ป้องกัน 5 บท"}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Status Badge */}
                    {isBookedByMe ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        ท่านจองรอบนี้แล้ว ✓
                      </span>
                    ) : isAvailable ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        เปิดรับจอง (ว่าง {remainingSeats}/{capacity})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-200 text-neutral-600">
                        ที่นั่งเต็มแล้ว ({capacity}/{capacity})
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-bold text-neutral-charcoal leading-snug">
                    {slot.title}
                  </h4>

                  {/* Details Card */}
                  <div className="mt-3 p-3 rounded-xl bg-neutral-50/80 border border-neutral-100 text-xs space-y-1.5">
                    <div className="flex items-center text-neutral-600 gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-ssru-crimson flex-shrink-0" />
                      <span className="font-semibold text-neutral-700">วันที่สอบ:</span>
                      <span>{formatThaiDate(slot.examDate)}</span>
                    </div>

                    <div className="flex items-center text-neutral-600 gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-ssru-crimson flex-shrink-0" />
                      <span className="font-semibold text-neutral-700">ช่วงเวลา:</span>
                      <span className="font-bold text-ssru-crimson">{slot.timeSlot} น.</span>
                    </div>

                    <div className="flex items-start text-neutral-600 gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-ssru-crimson flex-shrink-0 mt-0.5" />
                      <span className="font-semibold text-neutral-700 flex-shrink-0">สถานที่สอบ:</span>
                      <span className="font-medium text-neutral-800 break-words">{slot.location}</span>
                    </div>

                    <div className="flex items-center text-neutral-600 gap-1.5 pt-0.5">
                      <User className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                      <span className="font-semibold text-neutral-700">อาจารย์ผู้เปิดรอบ:</span>
                      <span>{slot.teacherName}</span>
                    </div>

                    <div className="pt-1.5 border-t border-neutral-200/60 space-y-1">
                      <div className="flex items-center justify-between text-neutral-600">
                        <span className="flex items-center gap-1.5 font-semibold text-neutral-700">
                          <Users className="w-3.5 h-3.5 text-ssru-crimson flex-shrink-0" />
                          <span>ที่นั่งสอบที่เปิดรับ:</span>
                        </span>
                        <span className="font-bold">
                          {remainingSeats > 0 ? (
                            <span className="text-emerald-700">ว่าง {remainingSeats} จาก {capacity} ที่นั่ง</span>
                          ) : (
                            <span className="text-neutral-500">เต็ม {capacity} ที่นั่ง</span>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            isFull ? "bg-neutral-400" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.round((bookedCount / capacity) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {slot.notes && (
                    <p className="mt-2 text-[11px] text-neutral-500 italic">
                      หมายเหตุ: {slot.notes}
                    </p>
                  )}
                </div>

                {/* Booking Button */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">
                    {isBookedByMe
                      ? "คุณได้จองรอบสอบนี้แล้ว"
                      : isAvailable
                      ? `เหลือ ${remainingSeats} ที่นั่งสุดท้าย`
                      : "รอบสอบนี้ที่นั่งเต็มแล้ว"}
                  </span>

                  {isBookedByMe ? (
                    <div className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center space-x-1 shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                      <span>จองแล้ว</span>
                    </div>
                  ) : isAvailable ? (
                    <button
                      type="button"
                      onClick={() => handleOpenBookingConfirm(slot)}
                      className="px-4 py-2 rounded-xl bg-ssru-crimson hover:bg-ssru-600 text-white text-xs font-bold shadow-md shadow-ssru-crimson/20 flex items-center space-x-1.5 active:scale-95 transition-all"
                    >
                      <span>จองรอบนี้</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 rounded-xl bg-neutral-200 text-neutral-400 text-xs font-semibold cursor-not-allowed"
                    >
                      ที่นั่งเต็มแล้ว
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-neutral-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-ssru-crimson">
                  ยืนยันการจองสอบ
                </span>
                <h3 className="text-base md:text-lg font-bold font-display text-neutral-charcoal mt-1">
                  {confirmingSlot.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingSlot(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            {/* Prerequisite Check for QE */}
            {confirmingSlot.category === "QE" && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-2.5 ${
                  canConfirm
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                {canConfirm ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-bold">
                    {canConfirm ? "คุณสมบัติผ่านเกณฑ์ พร้อมยืนยันการจอง" : "ไม่สามารถจองรอบสอบ QE นี้ได้"}
                  </p>
                  <p className="opacity-90">
                    {isAlreadyPassedQE
                      ? "ท่านผ่านการสอบ QE แล้ว ไม่จำเป็นต้องจองใหม่"
                      : hasOpenQEBooking
                      ? "ท่านมีคำร้องจองสอบ QE ที่ยังไม่ได้รับการประเมินอยู่แล้ว"
                      : !qePrerequisite.canBook
                      ? qePrerequisite.reasonTh
                      : "ผ่านเกณฑ์การสอบ 3 บทเรียบร้อยแล้ว"}
                  </p>
                  {!qePrerequisite.canBook && onOpenDocuments && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingSlot(null);
                        onOpenDocuments();
                      }}
                      className="mt-1.5 px-3 py-1 bg-white border border-amber-300 rounded-lg text-[11px] font-bold text-amber-900 hover:bg-amber-100"
                    >
                      ไปที่เมนูเอกสารโครงงาน (ส่งเอกสารสอบ 3 บท) →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Slot Summary */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-neutral-400 block">วันที่สอบ:</span>
                  <span className="font-bold text-neutral-charcoal">{formatThaiDate(confirmingSlot.examDate)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">ช่วงเวลาสอบ:</span>
                  <span className="font-bold text-ssru-crimson">{confirmingSlot.timeSlot} น.</span>
                </div>
              </div>

              <div>
                <span className="text-neutral-400 block">สถานที่สอบ (Textbox):</span>
                <span className="font-bold text-neutral-charcoal">{confirmingSlot.location}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-neutral-400 block">อาจารย์ผู้เปิดรอบ:</span>
                  <span className="font-bold text-neutral-charcoal">{confirmingSlot.teacherName}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block">ที่นั่งสอบ:</span>
                  <span className="font-bold text-emerald-700">
                    ว่าง {Math.max(0, (confirmingSlot.capacity || 1) - getSlotBookedStudents(confirmingSlot).length)} / {confirmingSlot.capacity || 1} ที่นั่ง
                  </span>
                </div>
              </div>

              <div>
                <span className="text-neutral-400 block">ผู้ยื่นคำร้อง:</span>
                <span className="font-bold text-neutral-charcoal">
                  {student.prefixTh} {student.firstNameTh} {student.lastNameTh} ({student.studentCode})
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                ข้อความเพิ่มเติมถึงอาจารย์ผู้คุมสอบ (ถ้ามี)
              </label>
              <textarea
                rows={2}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="เช่น ข้อมูลอุปกรณ์เพิ่มเติม หรือหมายเหตุประกอบ"
                className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setConfirmingSlot(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!canConfirm || isBooking}
                onClick={handleConfirmBook}
                className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white shadow-md flex items-center space-x-2 transition-all ${
                  canConfirm && !isBooking
                    ? "bg-ssru-crimson hover:bg-ssru-600 active:scale-95 shadow-ssru-crimson/20"
                    : "bg-neutral-300 cursor-not-allowed text-neutral-500 shadow-none"
                }`}
              >
                {isBooking ? (
                  <span>กำลังบันทึก...</span>
                ) : (
                  <>
                    <span>ยืนยันการจองรอบสอบนี้</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
