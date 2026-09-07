import { get, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase/config";
import { isCloudDisabled, RTDB_ROOT } from "@/lib/firebase/rtdb";
import { hasPdfSignature, PDF_MAX_FILE_BYTES, readPdfFile } from "./pdf";
import type { ReviewAttachment } from "@/types";

export const REVIEW_MAX_FILES = 5;
export interface PreparedReviewAttachment extends ReviewAttachment { dataUrl: string }

function imageMime(bytes: Uint8Array): ReviewAttachment["mimeType"] | undefined {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return undefined;
}

export function validateReviewAttachment(file: PreparedReviewAttachment): void {
  if (!/^[\w-]+$/.test(file.id) || !file.fileName || file.fileSize <= 0 || file.fileSize > PDF_MAX_FILE_BYTES || file.dataUrl.length > 7_000_000) throw new Error("ไฟล์แนบต้องมีขนาดไม่เกิน 5 MB ต่อไฟล์");
  if (!file.dataUrl.startsWith(`data:${file.mimeType};base64,`)) throw new Error("ชนิดไฟล์แนบไม่ถูกต้อง");
  let binary: string;
  try { binary = atob(file.dataUrl.split(",")[1]); } catch { throw new Error("อ่านไฟล์แนบไม่สำเร็จ"); }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (bytes.length !== file.fileSize || (file.mimeType === "application/pdf" ? !hasPdfSignature(bytes) : imageMime(bytes) !== file.mimeType)) throw new Error("เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์แนบ");
}

/** Accept only PDFs and raster images (never HTML/SVG or a renamed executable). */
export async function readReviewAttachment(file: File, id: string): Promise<PreparedReviewAttachment> {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const pdf = await readPdfFile(file);
    return { ...pdf, id, mimeType: "application/pdf" };
  }
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !file.size || file.size > PDF_MAX_FILE_BYTES) throw new Error("รองรับรูป PNG, JPEG, WebP หรือ PDF ไม่เกิน 5 MB ต่อไฟล์");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = imageMime(bytes);
  if (!mimeType) throw new Error("ไฟล์นี้ไม่ใช่รูป PNG, JPEG หรือ WebP ที่ถูกต้อง");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return { id, mimeType, fileName: file.name, fileSize: file.size, dataUrl: `data:${mimeType};base64,${btoa(binary)}` };
}

/** Files are fetched only when the recipient requests them, not in live collection snapshots. */
export async function loadReviewAttachment(docId: string, attachment: ReviewAttachment): Promise<string> {
  if (isCloudDisabled() || !rtdb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลไฟล์แนบได้");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([
      get(ref(rtdb, `${RTDB_ROOT}/reviewFiles/${docId}/${attachment.id}`)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("อ่านไฟล์แนบหมดเวลา กรุณาลองใหม่")), 15000); }),
    ]);
    if (!snapshot.exists()) throw new Error("ไม่พบไฟล์แนบ");
    const dataUrl = String(snapshot.val());
    validateReviewAttachment({ ...attachment, dataUrl });
    return dataUrl;
  } finally { if (timer) clearTimeout(timer); }
}

export function downloadReviewAttachment(dataUrl: string, attachment: ReviewAttachment): void {
  validateReviewAttachment({ ...attachment, dataUrl });
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
