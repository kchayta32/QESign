"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ProjectDocument, ProjectDocumentType, Student, Teacher, UserRole } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import {
  PROJECT_DOCUMENT_STAGES,
  checkDocumentSubmissionPrerequisite,
  getLatestDocument,
  hasPassed3ChapterExam,
  isDocumentStageApproved
} from "@/lib/rules/engine";
import { PDF_MAX_FILE_MB, deletePdfDocument, formatFileSize, openPdfDocument, readPdfFile } from "@/lib/media/pdf";
import { formatThaiDateTime } from "@/lib/utils";
import {
  X,
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ExternalLink,
  AlertCircle,
  Trash2,
  Send,
  ShieldCheck,
  History,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";

interface ProjectDocumentsManagerProps {
  student: Student;
  currentTeacher?: Teacher;
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
  /** Stage to scroll attention to when opening (e.g. from the QE prerequisite hint). */
  focusType?: ProjectDocumentType;
}

const statusMeta: Record<ProjectDocument["status"], { label: string; cls: string; Icon: React.ElementType }> = {
  submitted: { label: "รออาจารย์ตรวจ", cls: "bg-amber-100 text-amber-800", Icon: Clock },
  approved: { label: "ผ่าน", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  rejected: { label: "ไม่ผ่าน / แก้ไข", cls: "bg-red-100 text-red-800", Icon: XCircle },
};

export default function ProjectDocumentsManager({ student, currentTeacher, role, isOpen, onClose, focusType }: ProjectDocumentsManagerProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>(() => dbStore.getProjectDocuments(student.id));
  const [liveStudent, setLiveStudent] = useState<Student>(student);

  useEffect(() => {
    const refresh = () => {
      setDocuments(dbStore.getProjectDocuments(student.id));
      setLiveStudent(dbStore.getStudentById(student.id) || student);
    };
    refresh();
    return dbStore.subscribe(refresh);
  }, [student]);

  if (!isOpen) return null;

  const passed3 = hasPassed3ChapterExam(liveStudent, documents);
  const pendingCount = documents.filter((d) => d.status === "submitted").length;
  const isAdvisor = role === "teacher" && !!currentTeacher && (liveStudent.advisorId === currentTeacher.id || liveStudent.coAdvisorId === currentTeacher.id);
  const canReview = role === "teacher" && !!currentTeacher;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-ssru-50 text-ssru-crimson">Project Documents</span>
              <h3 className="text-lg md:text-xl font-bold font-display text-neutral-charcoal">เอกสารโครงงาน: Proposal • สอบ 3 บท • สอบ 5 บท</h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              นักศึกษา: {liveStudent.prefixTh} {liveStudent.firstNameTh} {liveStudent.lastNameTh} ({liveStudent.studentCode}) • ไฟล์ PDF ไม่เกิน {PDF_MAX_FILE_MB} MB ต่อฉบับ
            </p>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          {/* QE prerequisite banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${passed3 ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" : "bg-amber-50/80 border-amber-200 text-amber-950"}`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${passed3 ? "bg-emerald-500" : "bg-amber-500"}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-bold">เงื่อนไขก่อนจองสอบ QE: ต้องสอบ 3 บทผ่านแล้วเท่านั้น</h4>
                <p className="text-xs opacity-85">
                  {passed3
                    ? "✓ ผ่านการสอบ 3 บทแล้ว — นักศึกษาสามารถจองรอบสอบ QE ได้"
                    : "นักศึกษาต้องส่งเอกสารสอบ 3 บท (.pdf) และได้รับผล \"ผ่าน\" จากอาจารย์ที่ปรึกษาก่อนจึงจะจองสอบ QE ได้"}
                </p>
              </div>
            </div>
            {role === "teacher" && pendingCount > 0 && (
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-200 text-amber-900 whitespace-nowrap">{pendingCount} ฉบับรอตรวจ</span>
            )}
          </div>

          {role === "teacher" && !isAdvisor && (
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
              <span>ท่านไม่ได้เป็นอาจารย์ที่ปรึกษาของนักศึกษาคนนี้ — สามารถดูเอกสารได้ และบันทึกผลได้ในฐานะกรรมการ (ระบบจะบันทึกชื่อผู้ตรวจ)</span>
            </div>
          )}

          {/* Stages */}
          {PROJECT_DOCUMENT_STAGES.map((stage) => (
            <StageCard
              key={stage.type}
              stage={stage}
              student={liveStudent}
              documents={documents}
              role={role}
              canReview={canReview}
              reviewer={currentTeacher}
              highlight={focusType === stage.type}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One stage (Proposal / chapter3 / chapter5)
// ---------------------------------------------------------------------------
function StageCard({
  stage,
  student,
  documents,
  role,
  canReview,
  reviewer,
  highlight,
}: {
  stage: (typeof PROJECT_DOCUMENT_STAGES)[number];
  student: Student;
  documents: ProjectDocument[];
  role: UserRole;
  canReview: boolean;
  reviewer?: Teacher;
  highlight: boolean;
}) {
  const stageDocs = useMemo(
    () => documents.filter((d) => d.docType === stage.type).sort((a, b) => (b.version || 0) - (a.version || 0)),
    [documents, stage.type]
  );
  const latest = getLatestDocument(documents, stage.type);
  const approved = isDocumentStageApproved(documents, stage.type);
  const prerequisite = checkDocumentSubmissionPrerequisite(student, documents, stage.type);
  const locked = !prerequisite.canSubmit && !latest;

  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>("");

  const openFile = async (doc: ProjectDocument) => {
    setError("");
    setBusy(`open-${doc.id}`);
    try {
      const ok = await openPdfDocument(doc.fileRef, doc.fileName);
      if (!ok) setError("ไม่พบไฟล์เอกสารในระบบ (อาจถูกลบหรืออัปโหลดไม่สมบูรณ์) กรุณาส่งเอกสารใหม่");
    } catch (e: any) {
      setError(e?.message || "เปิดเอกสารไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const withdraw = async (doc: ProjectDocument) => {
    if (!window.confirm(`ยกเลิกการส่งเอกสาร ${stage.shortTh} ฉบับที่ ${doc.version} (${doc.fileName})?`)) return;
    setBusy(`withdraw-${doc.id}`);
    try {
      const removed = await dbStore.withdrawProjectDocument(doc.id);
      if (removed) await deletePdfDocument(removed.fileRef);
    } catch (error: any) {
      setError(error?.message || "ยกเลิกเอกสารไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const status = latest ? statusMeta[latest.status] : null;
  const StatusIcon = status?.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-white shadow-sm ${
        highlight ? "border-ssru-crimson/60 ring-2 ring-ssru-crimson/10" : approved ? "border-emerald-200" : "border-neutral-200"
      }`}
    >
      <div className="p-4 md:p-5 space-y-3">
        {/* Stage header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${approved ? "bg-emerald-500 text-white" : locked ? "bg-neutral-200 text-neutral-500" : "bg-ssru-50 text-ssru-crimson"}`}>
              {approved ? <CheckCircle2 className="w-5 h-5" /> : locked ? <Lock className="w-4 h-4" /> : stage.order}
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-charcoal">{stage.titleTh}</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">{stage.descriptionTh}</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            {status && StatusIcon ? (
              <span className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${status.cls}`}>
                <StatusIcon className="w-4 h-4" /> {status.label}
                {latest && <span className="opacity-70 font-medium">• ฉบับที่ {latest.version}</span>}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-neutral-100 text-neutral-500 flex items-center gap-1.5">
                {locked ? <Lock className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                {locked ? "ยังไม่เปิดให้ส่ง" : "ยังไม่ส่งเอกสาร"}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Latest submission */}
        {latest && (
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-ssru-crimson flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-charcoal truncate">{latest.fileName}</p>
                  <span className="text-[10px] text-neutral-400">
                    {formatFileSize(latest.fileSize)} • ส่งเมื่อ {formatThaiDateTime(latest.submittedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openFile(latest)}
                  disabled={busy === `open-${latest.id}`}
                  className="px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 flex items-center gap-1 transition-colors disabled:opacity-60"
                >
                  {busy === `open-${latest.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  <span>เปิดไฟล์ PDF</span>
                </button>
                {role === "student" && latest.status === "submitted" && (
                  <button
                    type="button"
                    onClick={() => withdraw(latest)}
                    title="ยกเลิกการส่ง (ยังไม่ถูกตรวจ)"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {latest.studentNote && (
              <p className="text-[11px] text-neutral-600"><span className="font-semibold">หมายเหตุจากนักศึกษา:</span> {latest.studentNote}</p>
            )}
            {latest.status !== "submitted" && (
              <div className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 ${latest.status === "approved" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-red-50 border-red-100 text-red-900"}`}>
                {latest.status === "approved" ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-600" />}
                <div>
                  <span className="font-bold">{latest.status === "approved" ? "ผลสอบ: ผ่าน" : "ผลสอบ: ไม่ผ่าน"}</span>
                  {latest.reviewerName && <span> • บันทึกโดย {latest.reviewerName}</span>}
                  {latest.reviewedAt && <span> • {formatThaiDateTime(latest.reviewedAt)}</span>}
                  {latest.reviewFeedback && <p className="mt-0.5">{latest.reviewFeedback}</p>}
                </div>
              </div>
            )}

            {/* Teacher review actions */}
            {canReview && reviewer && latest.status === "submitted" && (
              <ReviewActions doc={latest} reviewer={reviewer} stageLabel={stage.shortTh} onError={setError} />
            )}
            {canReview && reviewer && latest.status === "approved" && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={async () => {
                    const reason = window.prompt(`ยกเลิกผล "ผ่าน" ของ ${stage.shortTh} ฉบับที่ ${latest.version}? ระบุเหตุผล`, "");
                    if (reason === null) return;
                    setBusy("review");
                    try {
                      await dbStore.reviewProjectDocument(latest.id, "rejected", reviewer, reason || "ยกเลิกผลการสอบโดยอาจารย์ที่ปรึกษา");
                    } catch (error: any) {
                      setError(error?.message || "บันทึกผลไม่สำเร็จ");
                    } finally {
                      setBusy("");
                    }
                  }}
                  className="text-[11px] text-red-600 hover:underline"
                >
                  ยกเลิกผลผ่าน (Revoke)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Student: submit / resubmit */}
        {role === "student" && !approved && (
          <>
            {!showForm ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className={`text-[11px] ${prerequisite.canSubmit ? "text-neutral-500" : "text-amber-700 font-medium"}`}>{prerequisite.reasonTh}</p>
                {prerequisite.canSubmit && (
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setShowForm(true);
                    }}
                    className="px-3.5 py-2 bg-ssru-crimson text-white hover:bg-ssru-600 active:scale-95 transition-all rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm w-fit"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{latest ? "ส่งเอกสารฉบับแก้ไข (.pdf)" : "ส่งเอกสาร (.pdf)"}</span>
                  </button>
                )}
              </div>
            ) : (
              <UploadForm stage={stage} student={student} onDone={() => setShowForm(false)} onError={setError} />
            )}
          </>
        )}

        {/* History */}
        {stageDocs.length > 1 && (
          <div>
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-[11px] text-neutral-500 hover:text-neutral-800 flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> {showHistory ? "ซ่อน" : "ดู"}ประวัติการส่ง ({stageDocs.length} ฉบับ)
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1.5">
                {stageDocs.slice(1).map((d) => {
                  const m = statusMeta[d.status];
                  return (
                    <li key={d.id} className="text-[11px] p-2 rounded-lg bg-neutral-50 border border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-neutral-600">
                        ฉบับที่ {d.version} • {d.fileName} • {formatThaiDateTime(d.submittedAt)}
                        {d.reviewFeedback ? ` • ${d.reviewFeedback}` : ""}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-bold ${m.cls}`}>{m.label}</span>
                        <button type="button" onClick={() => openFile(d)} className="text-ssru-crimson hover:underline">เปิด</button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Upload form (student)
// ---------------------------------------------------------------------------
function UploadForm({
  stage,
  student,
  onDone,
  onError,
}: {
  stage: (typeof PROJECT_DOCUMENT_STAGES)[number];
  student: Student;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [docId] = useState(() => dbStore.newProjectDocumentId(stage.type));
  const [unconfirmed, setUnconfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!file) return setLocalError("กรุณาเลือกไฟล์ PDF");
    // Re-check on submit: the store may have changed while the form was open.
    const pre = checkDocumentSubmissionPrerequisite(student, dbStore.getProjectDocuments(student.id).filter((d) => d.id !== docId), stage.type);
    if (!pre.canSubmit) return setLocalError(pre.reasonTh);

    setUploading(true);
    try {
      const prepared = await readPdfFile(file);
      const fileRef = `pdf://${docId}`;
      await dbStore.submitProjectDocument({
        id: docId,
        studentId: student.id,
        studentUid: student.uid,
        studentCode: student.studentCode,
        studentNameTh: `${student.prefixTh} ${student.firstNameTh} ${student.lastNameTh}`.trim(),
        projectTitle: student.projectTitleTh || "โครงงานวิศวกรรมคอมพิวเตอร์",
        docType: stage.type,
        fileName: prepared.fileName,
        fileSize: prepared.fileSize,
        fileRef,
        studentNote: note.trim() || undefined,
        advisorId: student.advisorId || "",
        advisorNameTh: student.advisorId ? dbStore.getTeacherDisplayName(student.advisorId) : "ยังไม่ระบุ",
      }, prepared.dataUrl);
      onError("");
      onDone();
    } catch (err: any) {
      const pending = err?.code === "WRITE_UNCONFIRMED";
      setUnconfirmed(pending);
      setLocalError(pending
        ? `ยังไม่ยืนยันรายการ ${docId} — ไฟล์และข้อมูลจะบันทึกพร้อมกันเมื่อเชื่อมต่อได้ กรุณาส่งซ้ำรายการเดิมหรือโหลดหน้าใหม่เมื่อออนไลน์ (อย่าสร้างรายการใหม่)`
        : err?.message || "อัปโหลดเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.form initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="p-4 rounded-2xl bg-ssru-50/50 border border-ssru-crimson/30 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-ssru-crimson/20">
        <h5 className="text-xs font-bold text-ssru-crimson flex items-center gap-2">
          <UploadCloud className="w-4 h-4" /> ส่งเอกสาร {stage.shortTh} (PDF เท่านั้น, ไม่เกิน {PDF_MAX_FILE_MB} MB)
        </h5>
        <button type="button" onClick={onDone} disabled={uploading} className="text-xs text-neutral-500 hover:text-neutral-800 font-semibold">ปิดฟอร์ม</button>
      </div>

      {localError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{localError}</span>
        </div>
      )}

      <label className="block p-4 rounded-xl border-2 border-dashed border-neutral-300 bg-white hover:border-ssru-crimson/50 cursor-pointer text-center">
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          disabled={uploading || unconfirmed}
          onChange={(e) => {
            setLocalError("");
            setFile(e.target.files?.[0] || null);
          }}
        />
        <FileText className="w-8 h-8 mx-auto text-ssru-crimson mb-1.5" />
        {file ? (
          <p className="text-xs font-bold text-neutral-charcoal break-all">{file.name} <span className="text-neutral-400 font-medium">({formatFileSize(file.size)})</span></p>
        ) : (
          <p className="text-xs font-semibold text-neutral-600">คลิกเพื่อเลือกไฟล์ PDF</p>
        )}
        <p className="text-[10px] text-neutral-400 mt-1">ตั้งชื่อไฟล์ให้สื่อความหมาย เช่น {student.studentCode}_{stage.shortTh.replace(/\s/g, "")}.pdf</p>
      </label>

      <div>
        <label className="block text-xs font-bold text-neutral-700 mb-1">หมายเหตุถึงอาจารย์ที่ปรึกษา (ถ้ามี)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={uploading}
          placeholder="เช่น แก้ไขบทที่ 2 ตามข้อเสนอแนะครั้งก่อนแล้ว"
          className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} disabled={uploading} className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100">ยกเลิก</button>
        <button
          type="submit"
          disabled={uploading || !file}
          className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-ssru-crimson hover:bg-ssru-600 disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>{uploading ? "กำลังอัปโหลด..." : "ส่งให้อาจารย์ที่ปรึกษาตรวจ"}</span>
        </button>
      </div>
    </motion.form>
  );
}

// ---------------------------------------------------------------------------
// Review actions (teacher)
// ---------------------------------------------------------------------------
function ReviewActions({ doc, reviewer, stageLabel, onError }: { doc: ProjectDocument; reviewer: Teacher; stageLabel: string; onError: (message: string) => void }) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const decide = async (decision: "approved" | "rejected") => {
    if (saving) return;
    setError("");
    onError("");
    if (decision === "rejected" && !feedback.trim()) {
      setError("กรุณาระบุข้อเสนอแนะ / เหตุผลที่ไม่ผ่าน เพื่อให้นักศึกษาแก้ไข");
      return;
    }
    const msg =
      decision === "approved"
        ? `บันทึกผล "ผ่าน" สำหรับ ${stageLabel} ฉบับที่ ${doc.version} ของ ${doc.studentNameTh}?${doc.docType === "chapter3" ? "\nนักศึกษาจะสามารถจองสอบ QE ได้ทันที" : ""}`
        : `บันทึกผล "ไม่ผ่าน" สำหรับ ${stageLabel} ฉบับที่ ${doc.version} ของ ${doc.studentNameTh}?\nนักศึกษาจะต้องส่งเอกสารฉบับแก้ไข`;
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      await dbStore.reviewProjectDocument(doc.id, decision, reviewer, feedback);
    } catch (error: any) {
      // StageCard outlives this form when a later confirmed snapshot changes status.
      onError(error?.code === "WRITE_UNCONFIRMED"
        ? "ยังไม่ยืนยันผลจากฐานข้อมูล สถานะเดิมจะคงอยู่จนกว่าจะได้รับคำยืนยัน กรุณาตรวจสอบการเชื่อมต่อ"
        : error?.message || "บันทึกผลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <fieldset disabled={saving} aria-busy={saving} className="pt-2 border-t border-neutral-200 space-y-2">
      {saving && <p role="status" className="text-xs">กำลังบันทึกผล...</p>}
      {error && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">{error}</div>}
      <textarea
        rows={2}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="ข้อเสนอแนะของอาจารย์ / เหตุผล (จำเป็นเมื่อบันทึกผลไม่ผ่าน)"
        className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-neutral-400 mr-1">บันทึกผลสอบ {stageLabel}:</span>
        <button type="button" onClick={() => decide("rejected")} className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> ไม่ผ่าน
        </button>
        <button type="button" onClick={() => decide("approved")} className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน
        </button>
      </div>
    </fieldset>
  );
}
