"use client";

import React, { useState } from "react";
import { Teacher, ExamCategory, QEExamType, ProjectExamStage, ExamSlot } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  BookOpen,
  Cpu,
  Code2,
  Database,
  FileCheck,
  AlertCircle,
  Plus
} from "lucide-react";

interface TeacherExamSlotModalProps {
  teacher: Teacher;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (slot: ExamSlot) => void;
}

const PRESET_TIME_SLOTS = [
  "09:00 - 10:30",
  "10:45 - 12:15",
  "13:30 - 15:00",
  "15:15 - 16:45",
];

export default function TeacherExamSlotModal({
  teacher,
  isOpen,
  onClose,
  onSuccess,
}: TeacherExamSlotModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const [category, setCategory] = useState<ExamCategory>("QE");
  const [qeType, setQeType] = useState<QEExamType>("SW");
  const [projectStage, setProjectStage] = useState<ProjectExamStage>("chapter3");
  const [examDate, setExamDate] = useState<string>(today);
  const [timeSlot, setTimeSlot] = useState<string>(PRESET_TIME_SLOTS[0]);
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false);
  const [customTimeSlot, setCustomTimeSlot] = useState<string>("");
  const [location, setLocation] = useState<string>("ห้องปฏิบัติการ 4731 (CE LAB)");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const finalTimeSlot = isCustomTime ? customTimeSlot.trim() : timeSlot.trim();

    if (!examDate) {
      setErrorMsg("กรุณาระบุวันที่ต้องการเข้าสอบ");
      return;
    }
    if (!finalTimeSlot) {
      setErrorMsg("กรุณาระบุช่วงเวลาสอบ (Time Slot)");
      return;
    }
    if (!location.trim()) {
      setErrorMsg("กรุณาระบุสถานที่สอบในช่อง Textbox");
      return;
    }

    let title = "";
    if (category === "QE") {
      const qeLabels: Record<QEExamType, string> = {
        HW: "ฮาร์ตแวร์ (Hardware)",
        SW: "ซอฟต์แวร์ (Software)",
        DB: "ระบบฐานข้อมูล (Database)",
      };
      title = `สอบวัดคุณสมบัติ (QE): ${qeLabels[qeType]}`;
    } else {
      const stageLabels: Record<ProjectExamStage, string> = {
        proposal: "สอบข้อเสนอโครงงาน (Proposal Defense)",
        chapter3: "สอบความก้าวหน้าโครงงาน (สอบ 3 บท)",
        chapter5: "สอบป้องกันโครงงานฉบับสมบูรณ์ (สอบ 5 บท)",
      };
      title = `สอบโครงงาน: ${stageLabels[projectStage]}`;
    }

    setIsSubmitting(true);
    try {
      const newSlot = await dbStore.createExamSlot({
        category,
        qeType: category === "QE" ? qeType : undefined,
        projectStage: category === "PROJECT" ? projectStage : undefined,
        title,
        examDate,
        timeSlot: finalTimeSlot,
        location: location.trim(),
        teacherId: teacher.id,
        teacherName: `${teacher.prefixTh}${teacher.firstNameTh} ${teacher.lastNameTh}`,
        capacity: 1,
        notes: notes.trim() || undefined,
      });

      if (onSuccess) onSuccess(newSlot);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "เปิดรอบจองสอบไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-red-50 text-ssru-crimson border border-ssru-crimson/20">
                Teacher Exam Scheduler
              </span>
              <h3 className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">
                เปิดระบบจองรอบสอบ (เปิดรอบสอบใหม่)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              อาจารย์ผู้เปิดรอบ: {teacher.prefixTh}{teacher.firstNameTh} {teacher.lastNameTh} ({teacher.teacherCode})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Category Switcher: QE vs PROJECT */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-2">
              ประเภทการสอบที่ต้องการเปิดรับจอง
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCategory("QE")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start space-x-3 ${
                  category === "QE"
                    ? "bg-red-50/70 border-ssru-crimson text-ssru-crimson shadow-sm"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <div className={`p-2 rounded-xl ${category === "QE" ? "bg-ssru-crimson text-white" : "bg-neutral-100 text-neutral-500"}`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">การสอบ QE (Qualifying Exam)</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    วัดคุณสมบัติ 3 แทร็ก (ฮาร์ตแวร์ / ซอฟต์แวร์ / ระบบฐานข้อมูล)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCategory("PROJECT")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start space-x-3 ${
                  category === "PROJECT"
                    ? "bg-amber-50/70 border-amber-600 text-amber-900 shadow-sm"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <div className={`p-2 rounded-xl ${category === "PROJECT" ? "bg-amber-600 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">การสอบโครงงาน (Project Exam)</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    สอบหัวข้อ Proposal • สอบก้าวหน้า 3 บท • สอบป้องกัน 5 บท
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Sub-choice based on category */}
          {category === "QE" ? (
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
              <label className="block text-xs font-bold text-neutral-700">
                เลือกประเภทการสอบ QE (ช้อยเลือก: ฮาร์ตแวร์, ซอฟต์แวร์, ระบบฐานข้อมูล)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Hardware */}
                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
                    qeType === "HW"
                      ? "bg-white border-ssru-crimson ring-2 ring-ssru-crimson/20 text-ssru-crimson font-bold shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="qeType"
                    value="HW"
                    checked={qeType === "HW"}
                    onChange={() => setQeType("HW")}
                    className="sr-only"
                  />
                  <Cpu className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs">ฮาร์ตแวร์ (Hardware)</span>
                </label>

                {/* Software */}
                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
                    qeType === "SW"
                      ? "bg-white border-ssru-crimson ring-2 ring-ssru-crimson/20 text-ssru-crimson font-bold shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="qeType"
                    value="SW"
                    checked={qeType === "SW"}
                    onChange={() => setQeType("SW")}
                    className="sr-only"
                  />
                  <Code2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-xs">ซอฟต์แวร์ (Software)</span>
                </label>

                {/* Database */}
                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
                    qeType === "DB"
                      ? "bg-white border-ssru-crimson ring-2 ring-ssru-crimson/20 text-ssru-crimson font-bold shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="qeType"
                    value="DB"
                    checked={qeType === "DB"}
                    onChange={() => setQeType("DB")}
                    className="sr-only"
                  />
                  <Database className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-xs">ระบบฐานข้อมูล (Database)</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
              <label className="block text-xs font-bold text-neutral-700">
                เลือกระดับการสอบโครงงาน
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
                    projectStage === "proposal"
                      ? "bg-white border-amber-600 ring-2 ring-amber-600/20 text-amber-900 font-bold shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="projectStage"
                    value="proposal"
                    checked={projectStage === "proposal"}
                    onChange={() => setProjectStage("proposal")}
                    className="sr-only"
                  />
                  <FileCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-xs">สอบหัวข้อ (Proposal)</span>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
                    projectStage === "chapter3"
                      ? "bg-white border-amber-600 ring-2 ring-amber-600/20 text-amber-900 font-bold shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="projectStage"
                    value="chapter3"
                    checked={projectStage === "chapter3"}
                    onChange={() => setProjectStage("chapter3")}
                    className="sr-only"
                  />
                  <FileCheck className="w-4 h-4 text-ssru-crimson flex-shrink-0" />
                  <span className="text-xs">สอบก้าวหน้า 3 บท</span>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition-all ${
                    projectStage === "chapter5"
                      ? "bg-white border-amber-600 ring-2 ring-amber-600/20 text-amber-900 font-bold shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="projectStage"
                    value="chapter5"
                    checked={projectStage === "chapter5"}
                    onChange={() => setProjectStage("chapter5")}
                    className="sr-only"
                  />
                  <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs">สอบป้องกัน 5 บท</span>
                </label>
              </div>
            </div>
          )}

          {/* Date & Time Slot Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Exam Date */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-ssru-crimson" />
                <span>วันที่ต้องการเข้าสอบ</span>
              </label>
              <input
                type="date"
                value={examDate}
                min={today}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
              />
            </div>

            {/* Time Slot */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-ssru-crimson" />
                <span>ช่วงเวลาสอบ (Time Slot)</span>
              </label>
              {!isCustomTime ? (
                <div className="space-y-2">
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
                  >
                    {PRESET_TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} น.
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCustomTime(true)}
                    className="text-[11px] text-neutral-500 hover:text-ssru-crimson underline"
                  >
                    หรือพิมพ์ระบุช่วงเวลาเอง
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="เช่น 13:00 - 14:30"
                    value={customTimeSlot}
                    onChange={(e) => setCustomTimeSlot(e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomTime(false)}
                    className="text-[11px] text-neutral-500 hover:text-ssru-crimson underline"
                  >
                    กลับไปเลือกช่วงเวลามาตรฐาน
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Location Textbox (Explicit user requirement) */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-ssru-crimson" />
              <span>สถานที่สอบ (Textbox)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="เช่น ห้องปฏิบัติการ 4731 (CE LAB), ห้องประชุมสาขา 4735, หรือ Online Google Meet"
              className="w-full text-xs font-medium bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              อาจารย์สามารถพิมพ์ระบุสถานที่ ห้องปฏิบัติการ หรือช่องทางการสอบแบบออนไลน์ได้อิสระ
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              หมายเหตุ / สิ่งที่ต้องเตรียมเพิ่มเติม (ถ้ามี)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น นำเสนอด้วยสไลด์ 15 นาที และสาธิตการทำงานของระบบ 15 นาที"
              className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-ssru-crimson hover:bg-ssru-600 shadow-md shadow-ssru-crimson/20 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? "กำลังบันทึก..." : "เปิดระบบรับจองรอบสอบ"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
