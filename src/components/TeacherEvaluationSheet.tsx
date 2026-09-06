"use client";

import React, { useState, useEffect } from "react";
import { QEBooking, QEResult, ExaminerScoreItem, Teacher } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import { evaluateQEResult, QE_PASSING_SCORE_DEFAULT } from "@/lib/rules/engine";
import {
  X,
  Award,
  CheckCircle2,
  XCircle,
  Calculator,
  UserCheck,
  FileSpreadsheet,
  AlertCircle,
  Save,
  Sparkles,
  Info
} from "lucide-react";
import { motion } from "framer-motion";

interface TeacherEvaluationSheetProps {
  booking: QEBooking;
  currentTeacher: Teacher;
  existingResult?: QEResult;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (result: QEResult) => void;
}

export default function TeacherEvaluationSheet({
  booking,
  currentTeacher,
  existingResult,
  isOpen,
  onClose,
  onSaved,
}: TeacherEvaluationSheetProps) {
  const teachers = dbStore.getTeachers();

  // Blank sheet: every examiner starts at 0 / FAIL so nobody can "publish" a pass by accident.
  const buildBlankScores = (): ExaminerScoreItem[] =>
    [0, 1, 2].map((i) => {
      const id = booking.examinerIds[i] || teachers[i]?.id || "";
      const t = teachers.find((x) => x.id === id);
      const roleLabel = i === 0 ? "ประธานกรรมการ" : "กรรมการ";
      return {
        examinerId: id,
        examinerName: booking.examinerNames[i] || (t ? `${t.prefixTh}${t.firstNameTh} ${t.lastNameTh} (${roleLabel})` : `กรรมการท่านที่ ${i + 1}`),
        score: 0,
        isPass: false,
        comments: "",
        evaluatedAt: new Date().toISOString(),
        signatureStatus: false,
      };
    });

  const [scores, setScores] = useState<ExaminerScoreItem[]>(
    existingResult && existingResult.examinerScores?.length === 3 ? existingResult.examinerScores : buildBlankScores()
  );
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>("");

  useEffect(() => {
    if (existingResult && existingResult.examinerScores?.length === 3) {
      setScores(existingResult.examinerScores);
    }
  }, [existingResult]);

  if (!isOpen) return null;

  // Live calculation based on 2/3 Committee Voting Rule
  const liveEvaluation = evaluateQEResult(scores);

  const handleScoreChange = (index: number, newScore: number) => {
    const clampedScore = Math.max(0, Math.min(100, isNaN(newScore) ? 0 : newScore));
    setScores((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        score: clampedScore,
        isPass: clampedScore >= QE_PASSING_SCORE_DEFAULT,
      };
      return updated;
    });
  };

  const handlePassToggle = (index: number, isPass: boolean) => {
    setScores((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isPass,
      };
      return updated;
    });
  };

  const handleCommentChange = (index: number, comments: string) => {
    setScores((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        comments,
      };
      return updated;
    });
  };

  const handleSaveEvaluation = () => {
    setSaveError("");
    if (!confirmed) {
      setSaveError("กรุณาติ๊กยืนยันว่าคะแนนและมติของกรรมการทั้ง 3 ท่านถูกต้องก่อนประกาศผล");
      return;
    }
    const stamped = scores.map((s) => ({ ...s, evaluatedAt: new Date().toISOString(), signatureStatus: true }));
    const savedResult = dbStore.updateExaminerEvaluation(booking.id, stamped);
    onSaved(savedResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-ssru-50 text-ssru-crimson border border-ssru-crimson/20">
                Evaluation Matrix
              </span>
              <h3 className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">
                แบบประเมินผลการสอบวัดคุณสมบัติ (QE Evaluation Sheet)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              คณะกรรมการ 3 ท่าน • กฎมติเสียงข้างมาก 2 ใน 3 เสียง (2/3 Pass Rule)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 space-y-6">
          {/* Student & Booking Info Card */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-neutral-400 block">นักศึกษา:</span>
              <span className="font-bold text-neutral-charcoal">{booking.studentNameTh}</span>
            </div>
            <div>
              <span className="text-neutral-400 block">รหัสนักศึกษา:</span>
              <span className="font-bold text-neutral-charcoal">{booking.studentCode}</span>
            </div>
            <div>
              <span className="text-neutral-400 block">แทร็กการสอบ:</span>
              <span className="font-bold text-ssru-crimson">{booking.trackId}</span>
            </div>
            <div>
              <span className="text-neutral-400 block">วัน-เวลา / สถานที่:</span>
              <span className="font-bold text-neutral-charcoal">
                {booking.examDate} ({booking.timeSlot})
              </span>
            </div>
          </div>

          {/* Live Committee Rule Summary Box */}
          <motion.div
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            className={`p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
              liveEvaluation.finalResult === "passed"
                ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                : "bg-red-50/80 border-red-300 text-red-950"
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  liveEvaluation.finalResult === "passed"
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                    : "bg-red-500 text-white shadow-md shadow-red-500/20"
                }`}
              >
                {liveEvaluation.finalResult === "passed" ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <XCircle className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider">ผลการประเมินแบบเรียลไทม์:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      liveEvaluation.finalResult === "passed"
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-red-200 text-red-900"
                    }`}
                  >
                    {liveEvaluation.finalResult === "passed" ? "ผ่านการสอบ QE" : "ไม่ผ่านเกณฑ์"}
                  </span>
                </div>
                <p className="text-xs font-semibold mt-1">{liveEvaluation.summaryTh}</p>
              </div>
            </div>

            <div className="flex items-center space-x-6 text-center">
              <div>
                <span className="text-[11px] text-neutral-500 block">มติเสียงผ่าน</span>
                <span className="text-lg font-bold font-display text-neutral-charcoal">
                  {liveEvaluation.passVotesCount} / 3 เสียง
                </span>
              </div>
              <div className="w-px h-8 bg-neutral-300" />
              <div>
                <span className="text-[11px] text-neutral-500 block">คะแนนเฉลี่ย</span>
                <span className="text-lg font-bold font-display text-neutral-charcoal">
                  {liveEvaluation.averageScore}%
                </span>
              </div>
            </div>
          </motion.div>

          {/* 3 Examiners Scoring Matrix */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold font-display text-neutral-charcoal flex items-center gap-2">
              <Calculator className="w-4 h-4 text-ssru-crimson" />
              <span>ตารางการให้คะแนนและมติของคณะกรรมการ 3 ท่าน</span>
            </h4>

            <div className="grid grid-cols-1 gap-4">
              {scores.map((item, idx) => {
                const isCurrentEvaluatingTeacher = currentTeacher.id === item.examinerId;

                return (
                  <div
                    key={item.examinerId || idx}
                    className={`p-4 md:p-5 rounded-2xl border transition-all ${
                      isCurrentEvaluatingTeacher
                        ? "bg-white border-ssru-crimson/50 shadow-md ring-2 ring-ssru-crimson/10"
                        : "bg-neutral-50/60 border-neutral-200"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 pb-3 border-b border-neutral-100">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-ssru-crimson/10 text-ssru-crimson font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h5 className="text-xs md:text-sm font-bold text-neutral-charcoal">
                              {item.examinerName}
                            </h5>
                            {isCurrentEvaluatingTeacher && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-ssru-crimson rounded">
                                บัญชีปัจจุบันของคุณ
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-neutral-400">
                            กรรมการผู้ประเมินคนที่ {idx + 1}
                          </span>
                        </div>
                      </div>

                      {/* Pass / Fail Vote Buttons */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-neutral-500 font-medium mr-1">มติผลการตัดสิน:</span>
                        <button
                          type="button"
                          onClick={() => handlePassToggle(idx, true)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                            item.isPass
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ผ่าน (PASS)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePassToggle(idx, false)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                            !item.isPass
                              ? "bg-red-600 text-white shadow-sm"
                              : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>ไม่ผ่าน (FAIL)</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Score Input */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1">
                          คะแนนประเมิน (เต็ม 100)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.score}
                            onChange={(e) => handleScoreChange(idx, parseInt(e.target.value))}
                            className="w-full text-base font-bold text-neutral-charcoal bg-white border border-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-medium">
                            / 100
                          </span>
                        </div>
                      </div>

                      {/* Comments Input */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-neutral-700 mb-1">
                          ข้อเสนอแนะและจุดที่ต้องปรับปรุง
                        </label>
                        <input
                          type="text"
                          value={item.comments}
                          onChange={(e) => handleCommentChange(idx, e.target.value)}
                          placeholder="กรอกข้อเสนอแนะสำหรับการปรับปรุงโครงงาน..."
                          className="w-full text-xs bg-white border border-neutral-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20 focus:border-ssru-crimson"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          {saveError && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          <label className="flex items-start gap-2 text-xs text-neutral-700 p-3 rounded-2xl bg-neutral-50 border border-neutral-200 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-ssru-crimson" />
            <span>
              ข้าพเจ้า ({currentTeacher.prefixTh}{currentTeacher.firstNameTh} {currentTeacher.lastNameTh}) ยืนยันว่าคะแนนและมติของคณะกรรมการทั้ง 3 ท่านข้างต้นถูกต้องครบถ้วน
              และประสงค์จะประกาศผลการสอบให้นักศึกษาทราบ
            </span>
          </label>
          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-400 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <span>การบันทึกจะอัปเดตผลสอบและคำนวณสถานะ 3-Condition Gate อัตโนมัติ</span>
            </p>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={handleSaveEvaluation}
                className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-ssru-crimson hover:bg-ssru-600 active:scale-95 shadow-md shadow-ssru-crimson/20 flex items-center space-x-2 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกและประกาศผลสอบ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
