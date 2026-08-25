"use client";

import React, { useState } from "react";
import { AdvisorMeetingLog, Student, Teacher, UserRole } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import { formatThaiDate } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Sparkles,
  UserCheck,
  FileText,
  Calendar,
  Send,
  X
} from "lucide-react";
import { motion } from "framer-motion";

interface AdvisorLogsManagerProps {
  student: Student;
  currentTeacher?: Teacher;
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export default function AdvisorLogsManager({
  student,
  currentTeacher,
  role,
  isOpen,
  onClose,
}: AdvisorLogsManagerProps) {
  const [logs, setLogs] = useState<AdvisorMeetingLog[]>(
    dbStore.getAdvisorLogs(student.id)
  );

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [meetingType, setMeetingType] = useState<"onsite" | "online">("onsite");
  const [topic, setTopic] = useState<string>("");
  const [discussionSummary, setDiscussionSummary] = useState<string>("");
  const [progressPercentage, setProgressPercentage] = useState<number>(50);
  const [nextGoals, setNextGoals] = useState<string>("");

  if (!isOpen) return null;

  const refreshLogs = () => {
    setLogs(dbStore.getAdvisorLogs(student.id));
  };

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !discussionSummary) return;

    const teachers = dbStore.getTeachers();
    const advisor = teachers.find((t) => t.id === student.advisorId) || teachers[0];

    dbStore.addAdvisorLog({
      studentId: student.id,
      studentUid: student.uid,
      studentCode: student.studentCode,
      studentNameTh: `${student.prefixTh} ${student.firstNameTh} ${student.lastNameTh}`,
      projectTitle: student.projectTitleTh || "โครงงานวิศวกรรมคอมพิวเตอร์",
      meetingDate,
      meetingType,
      topic,
      discussionSummary,
      progressPercentage,
      nextGoals,
      advisorId: advisor.id,
      advisorNameTh: `${advisor.prefixTh} ${advisor.firstNameTh} ${advisor.lastNameTh}`,
      status: "pending",
    });

    refreshLogs();
    setShowAddForm(false);
    setTopic("");
    setDiscussionSummary("");
    setNextGoals("");
  };

  const handleApproveLog = (logId: string) => {
    dbStore.updateAdvisorLogStatus(logId, "approved", "อนุมัติความก้าวหน้าโครงงาน");
    refreshLogs();
  };

  const handleRejectLog = (logId: string) => {
    dbStore.updateAdvisorLogStatus(logId, "rejected", "ขอให้ปรับปรุงและนำเสนอใหม่ในครั้งถัดไป");
    refreshLogs();
  };

  const approvedCount = logs.filter((l) => l.status === "approved").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-ssru-50 text-ssru-crimson">
                Condition 1
              </span>
              <h3 className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">
                บันทึกการเข้าพบอาจารย์ที่ปรึกษาโครงงาน (Advisor Meeting Logs)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              นักศึกษา: {student.prefixTh} {student.firstNameTh} {student.lastNameTh} ({student.studentCode})
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {role === "student" && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3.5 py-2 bg-ssru-crimson text-white hover:bg-ssru-600 active:scale-95 transition-all rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มบันทึกใหม่</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 space-y-6">
          {/* Progress Summary Card */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-ssru-crimson/10 text-ssru-crimson flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-bold text-neutral-charcoal">
                  ความคืบหน้าเงื่อนไขที่ 1: บันทึกการพบที่ปรึกษา
                </h4>
                <p className="text-xs text-neutral-500">
                  เกณฑ์ขั้นต่ำ: 6 ครั้งที่ได้รับการอนุมัติ
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-neutral-500 font-medium">อนุมัติแล้ว:</span>
              <span className={`text-base font-bold px-3 py-1 rounded-xl ${
                approvedCount >= 6 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {approvedCount} / 6 ครั้ง {approvedCount >= 6 && "✓ ครบถ้วน"}
              </span>
            </div>
          </div>

          {/* Add New Log Form */}
          {showAddForm && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleCreateLog}
              className="p-5 rounded-2xl bg-ssru-50/50 border border-ssru-crimson/30 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-ssru-crimson/20">
                <h4 className="text-xs md:text-sm font-bold text-ssru-crimson flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>กรอกแบบบันทึกการเข้าพบอาจารย์ที่ปรึกษา</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 font-semibold"
                >
                  ปิดฟอร์ม
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">วันที่เข้าพบ</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">รูปแบบการพบ</label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value as any)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    <option value="onsite">On-Site (ที่ห้องพักอาจารย์ / Lab)</option>
                    <option value="online">Online (Google Meet / Zoom)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ความก้าวหน้ารวม ({progressPercentage}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progressPercentage}
                    onChange={(e) => setProgressPercentage(parseInt(e.target.value))}
                    className="w-full mt-2 accent-ssru-crimson"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  หัวข้อ / ประเด็นหลักที่เข้าพบ
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="เช่น ตรวจสอบความถูกต้องของการออกแบบฐานข้อมูล หรือ ปรึกษาข้อผิดพลาด API"
                  className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  สรุปรายละเอียดการพูดคุยและคำแนะนำ
                </label>
                <textarea
                  rows={2}
                  value={discussionSummary}
                  onChange={(e) => setDiscussionSummary(e.target.value)}
                  placeholder="รายละเอียดข้อเสนอแนะที่อาจารย์ที่ปรึกษาให้คำแนะนำ..."
                  className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  เป้าหมายที่จะดำเนินการในสัปดาห์ถัดไป
                </label>
                <input
                  type="text"
                  value={nextGoals}
                  onChange={(e) => setNextGoals(e.target.value)}
                  placeholder="เช่น ทำ UI หน้ารายงาน และทดสอบระบบกับผู้ใช้งาน 10 คน"
                  className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-ssru-crimson hover:bg-ssru-600 flex items-center space-x-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งให้อาจารย์ที่ปรึกษาตรวจ</span>
                </button>
              </div>
            </motion.form>
          )}

          {/* Timeline of Logs */}
          <div className="space-y-3">
            <h4 className="text-xs md:text-sm font-bold font-display text-neutral-charcoal">
              รายการบันทึกการเข้าพบ ({logs.length} รายการ)
            </h4>

            {logs.length === 0 ? (
              <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
                <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs text-neutral-500 font-medium">ยังไม่มีบันทึกการเข้าพบ</p>
              </div>
            ) : (
              logs.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white border border-neutral-200 hover:border-neutral-300 transition-all shadow-sm space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h5 className="text-xs md:text-sm font-bold text-neutral-charcoal">
                        {item.topic}
                      </h5>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-neutral-400">
                        {formatThaiDate(item.meetingDate)} ({item.meetingType === "onsite" ? "On-Site" : "Online"})
                      </span>

                      {item.status === "approved" && (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                        </span>
                      )}
                      {item.status === "rejected" && (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-red-100 text-red-800 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> ไม่อนุมัติ
                        </span>
                      )}
                      {item.status === "pending" && (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> รออนุมัติ
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50/70 p-3 rounded-xl">
                    {item.discussionSummary}
                  </p>

                  {item.nextGoals && (
                    <div className="text-[11px] text-neutral-500">
                      <span className="font-semibold text-neutral-700">เป้าหมายถัดไป:</span> {item.nextGoals}
                    </div>
                  )}

                  {item.advisorFeedback && (
                    <div className="text-xs p-2.5 rounded-xl bg-blue-50/80 border border-blue-100 text-blue-900 flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-600" />
                      <div>
                        <span className="font-bold">ความคิดเห็นอาจารย์ ({item.advisorNameTh}):</span>{" "}
                        {item.advisorFeedback}
                      </div>
                    </div>
                  )}

                  {/* Teacher Quick Approve/Reject Actions */}
                  {role === "teacher" && item.status === "pending" && (
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100">
                      <span className="text-xs text-neutral-400 mr-2">การดำเนินการของอาจารย์:</span>
                      <button
                        onClick={() => handleRejectLog(item.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        ไม่อนุมัติ
                      </button>
                      <button
                        onClick={() => handleApproveLog(item.id)}
                        className="px-3.5 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                      >
                        อนุมัติการเข้าพบ
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
