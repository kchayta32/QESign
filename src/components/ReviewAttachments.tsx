"use client";

import React, { useState } from "react";
import type { ProjectDocument, ReviewAttachment } from "@/types";
import { downloadReviewAttachment, loadReviewAttachment } from "@/lib/media/reviewAttachment";
import { formatFileSize } from "@/lib/media/pdf";

export default function ReviewAttachments({ document }: { document: ProjectDocument }) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const open = async (attachment: ReviewAttachment) => {
    setBusy(attachment.id);
    setError("");
    try {
      const dataUrl = await loadReviewAttachment(document.id, attachment);
      if (attachment.mimeType.startsWith("image/")) setImages((previous) => ({ ...previous, [attachment.id]: dataUrl }));
      else downloadReviewAttachment(dataUrl, attachment);
    } catch (error: any) { setError(error?.message || "เปิดไฟล์แนบไม่สำเร็จ"); }
    finally { setBusy(""); }
  };
  if (!document.reviewAttachments?.length) return null;
  return (
    <div className="w-full min-w-0 space-y-2 mt-2">
      <p className="font-semibold text-xs">ไฟล์แนบจากอาจารย์</p>
      {error && <p role="alert" className="text-red-700 text-xs">{error}</p>}
      {document.reviewAttachments.map((attachment) => (
        <div key={attachment.id} className="min-w-0">
          <button type="button" disabled={!!busy} onClick={() => open(attachment)} className="min-h-11 px-3 py-2 rounded-lg border bg-white text-ssru-crimson text-xs break-all disabled:opacity-60">
            {busy === attachment.id ? "กำลังโหลด..." : attachment.mimeType === "application/pdf" ? "ดาวน์โหลด PDF: " : "ดูรูปภาพ: "}
            {attachment.fileName} ({formatFileSize(attachment.fileSize)})
          </button>
          {images[attachment.id] && <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[attachment.id]} alt={`ข้อเสนอแนะ: ${attachment.fileName}`} className="max-w-full h-auto rounded-lg" />
            <button type="button" className="min-h-11 text-xs text-ssru-crimson underline" onClick={() => downloadReviewAttachment(images[attachment.id], attachment)}>ดาวน์โหลดรูปภาพ</button>
          </div>}
        </div>
      ))}
    </div>
  );
}
