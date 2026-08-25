"use client";

import React, { useState } from "react";
import { ConferenceEvidence, Student, Teacher, UserRole } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import { formatThaiDate } from "@/lib/utils";
import {
  FileCheck2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Award,
  Globe2,
  FileText,
  AlertCircle,
  X,
  Send
} from "lucide-react";
import { motion } from "framer-motion";

interface ConferenceEvidenceManagerProps {
  student: Student;
  currentTeacher?: Teacher;
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export default function ConferenceEvidenceManager({
  student,
  currentTeacher,
  role,
  isOpen,
  onClose,
}: ConferenceEvidenceManagerProps) {
  const [evidenceList, setEvidenceList] = useState<ConferenceEvidence[]>(
    dbStore.getConferenceEvidence(student.id)
  );

  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [paperTitle, setPaperTitle] = useState<string>(student.projectTitleTh || "");
  const [conferenceName, setConferenceName] = useState<string>("");
  const [presentationDate, setPresentationDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [conferenceLevel, setConferenceLevel] = useState<"national" | "international">("national");
  const [indexedBy, setIndexedBy] = useState<"TCI-1" | "TCI-2" | "Scopus" | "IEEE Xplore" | "Other">("TCI-1");
  const [proofType, setProofType] = useState<"certificate" | "proceeding" | "acceptance_letter">("acceptance_letter");
  const [fileName, setFileName] = useState<string>("Acceptance_Letter.pdf");

  if (!isOpen) return null;

  const refreshEvidence = () => {
    setEvidenceList(dbStore.getConferenceEvidence(student.id));
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperTitle || !conferenceName) return;

    dbStore.addConferenceEvidence({
      studentId: student.id,
      studentUid: student.uid,
      studentCode: student.studentCode,
      studentNameTh: `${student.prefixTh} ${student.firstNameTh} ${student.lastNameTh}`,
      projectTitle: student.projectTitleTh || "โครงงานวิศวกรรมคอมพิวเตอร์",
      paperTitle,
      conferenceName,
      presentationDate,
      conferenceLevel,
      indexedBy,
      proofType,
      proofFileUrl: "https://example.com/files/uploaded_evidence_document.pdf",
      fileName: fileName || "Proof_Document.pdf",
      fileSize: "2.1 MB",
      status: "pending",
      submissionDate: new Date().toISOString().split("T")[0],
    });

    refreshEvidence();
    setShowUploadForm(false);
  };

  const handleVerify = (evidenceId: string) => {
    dbStore.updateConferenceStatus(evidenceId, "verified");
    refreshEvidence();
  };

  const handleReject = (evidenceId: string) => {
    dbStore.updateConferenceStatus(evidenceId, "rejected", "เอกสารไม่สมบูรณ์ ขาดตราประทับหรือลายเซ็น");
    refreshEvidence();
  };

  const verifiedEvidence = evidenceList.find((e) => e.status === "verified");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-ssru-50 text-ssru-crimson">
                Condition 3
              </span>
              <h3 className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">
                หลักฐานการเผยแพร่ / ประชุมวิชาการ (Conference Evidence)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              นักศึกษา: {student.prefixTh} {student.firstNameTh} {student.lastNameTh} ({student.studentCode})
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {role === "student" && !showUploadForm && !verifiedEvidence && (
              <button
                onClick={() => setShowUploadForm(true)}
                className="px-3.5 py-2 bg-ssru-crimson text-white hover:bg-ssru-600 active:scale-95 transition-all rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <UploadCloud className="w-4 h-4" />
                <span>ส่งหลักฐาน</span>
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
          {/* Status Summary Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            verifiedEvidence
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
              : "bg-amber-50/80 border-amber-200 text-amber-950"
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                verifiedEvidence ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              }`}>
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-bold">
                  สถานะเงื่อนไขที่ 3: เอกสารการเผยแพร่ผลงานวิชาการ
                </h4>
                <p className="text-xs opacity-85">
                  {verifiedEvidence
                    ? "✓ ได้รับการตรวจสอบและรับรองความถูกต้องแล้ว (พร้อมปลดล็อก Gate)"
                    : "ต้องได้รับการตรวจสอบและอนุมัติจากอาจารย์ที่ปรึกษา"}
                </p>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
              verifiedEvidence ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"
            }`}>
              {verifiedEvidence ? "อนุมัติแล้ว" : "รอดำเนินการ"}
            </span>
          </div>

          {/* Upload Form */}
          {showUploadForm && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleUploadSubmit}
              className="p-5 rounded-2xl bg-ssru-50/50 border border-ssru-crimson/30 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-ssru-crimson/20">
                <h4 className="text-xs md:text-sm font-bold text-ssru-crimson flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" />
                  <span>ยื่นหลักฐานการตีพิมพ์ / นำเสนอผลงาน</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 font-semibold"
                >
                  ปิดฟอร์ม
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ชื่อบทความวิชาการ (Paper Title)
                </label>
                <input
                  type="text"
                  value={paperTitle}
                  onChange={(e) => setPaperTitle(e.target.value)}
                  placeholder="เช่น Automated Cloud Resource Allocation using Machine Learning"
                  className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ชื่องานประชุมวิชาการ / วารสาร
                  </label>
                  <input
                    type="text"
                    value={conferenceName}
                    onChange={(e) => setConferenceName(e.target.value)}
                    placeholder="เช่น ECTI-CON 2026 หรือ NCIT 2026"
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    วันที่นำเสนอ / ตีพิมพ์
                  </label>
                  <input
                    type="date"
                    value={presentationDate}
                    onChange={(e) => setPresentationDate(e.target.value)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">ระดับงาน</label>
                  <select
                    value={conferenceLevel}
                    onChange={(e) => setConferenceLevel(e.target.value as any)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    <option value="national">ระดับชาติ (National)</option>
                    <option value="international">ระดับนานาชาติ (International)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ฐานข้อมูลดัชนี (Indexing)
                  </label>
                  <select
                    value={indexedBy}
                    onChange={(e) => setIndexedBy(e.target.value as any)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    <option value="TCI-1">TCI กลุ่ม 1</option>
                    <option value="TCI-2">TCI กลุ่ม 2</option>
                    <option value="IEEE Xplore">IEEE Xplore</option>
                    <option value="Scopus">Scopus</option>
                    <option value="Other">อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ประเภทเอกสารหลักฐาน
                  </label>
                  <select
                    value={proofType}
                    onChange={(e) => setProofType(e.target.value as any)}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
                  >
                    <option value="acceptance_letter">หนังสือตอบรับ (Acceptance Letter)</option>
                    <option value="proceeding">Proceeding ฉบับเต็ม</option>
                    <option value="certificate">เกียรติบัตรการนำเสนอ</option>
                  </select>
                </div>
              </div>

              {/* Mock File Upload box */}
              <div className="p-4 rounded-xl border border-dashed border-neutral-300 bg-white text-center">
                <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-neutral-700">
                  ไฟล์แนบ: {fileName} (ขนาด 2.1 MB)
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  รองรับไฟล์ PDF, JPG, PNG ขนาดไม่เกิน 10MB
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-ssru-crimson hover:bg-ssru-600 flex items-center space-x-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>บันทึกและส่งให้อาจารย์ตรวจ</span>
                </button>
              </div>
            </motion.form>
          )}

          {/* Evidence List */}
          <div className="space-y-4">
            <h4 className="text-xs md:text-sm font-bold font-display text-neutral-charcoal">
              รายการหลักฐานที่ส่ง ({evidenceList.length} ฉบับ)
            </h4>

            {evidenceList.length === 0 ? (
              <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
                <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs text-neutral-500 font-medium">ยังไม่มีการส่งหลักฐานการเผยแพร่</p>
              </div>
            ) : (
              evidenceList.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 uppercase">
                          {item.conferenceLevel}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                          {item.indexedBy}
                        </span>
                        <span className="text-xs text-neutral-400">
                          ยื่นเมื่อ: {formatThaiDate(item.submissionDate)}
                        </span>
                      </div>
                      <h5 className="text-sm font-bold text-neutral-charcoal leading-snug">
                        {item.paperTitle}
                      </h5>
                      <p className="text-xs text-neutral-500 mt-1">
                        งานประชุม: <span className="font-semibold text-neutral-700">{item.conferenceName}</span>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {item.status === "verified" && (
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-4 h-4" /> ตรวจสอบผ่านแล้ว
                        </span>
                      )}
                      {item.status === "rejected" && (
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" /> เอกสารไม่ผ่าน
                        </span>
                      )}
                      {item.status === "pending" && (
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> รออาจารย์ตรวจ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* File Attachment Card */}
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-5 h-5 text-ssru-crimson" />
                      <div>
                        <p className="text-xs font-bold text-neutral-charcoal truncate max-w-xs sm:max-w-md">
                          {item.fileName}
                        </p>
                        <span className="text-[10px] text-neutral-400">
                          {item.proofType === "acceptance_letter"
                            ? "หนังสือตอบรับ (Acceptance Letter)"
                            : item.proofType === "proceeding"
                            ? "Proceeding"
                            : "เกียรติบัตร"} • {item.fileSize || "1.4 MB"}
                        </span>
                      </div>
                    </div>

                    <a
                      href={item.proofFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 flex items-center space-x-1 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">เปิดดูเอกสาร</span>
                    </a>
                  </div>

                  {/* Teacher Verification Actions */}
                  {role === "teacher" && item.status === "pending" && (
                    <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-100">
                      <span className="text-xs text-neutral-400 mr-2">การตรวจสอบของอาจารย์:</span>
                      <button
                        onClick={() => handleReject(item.id)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        ปฏิเสธเอกสาร
                      </button>
                      <button
                        onClick={() => handleVerify(item.id)}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                      >
                        อนุมัติและรับรองเอกสาร
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
