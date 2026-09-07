import { ref as storageRef, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { ref as dbRef, set, get, remove } from "firebase/database";
import { storage, rtdb } from "@/lib/firebase/config";
import { RTDB_ROOT, isCloudDisabled, toSafeKey } from "@/lib/firebase/rtdb";
import { USE_FIREBASE_STORAGE } from "./avatar";

/**
 * Project documents (Proposal / สอบ 3 บท / สอบ 5 บท) are PDF files.
 *
 * The file bytes are kept OUT of the `projectDocuments` collection (which every client
 * subscribes to) and stored on demand under /ssru_ce/documentFiles/<docId> as a base64
 * data URL — the same approach used for profile pictures, because the project has no
 * Firebase Storage bucket. A Realtime Database string node may hold at most 10 MB, so
 * uploads are capped at PDF_MAX_FILE_MB (base64 adds ~33 %).
 *
 * When NEXT_PUBLIC_FIREBASE_USE_STORAGE=true the file goes to Firebase Storage instead
 * and the record stores the public download URL.
 */
export const PDF_MAX_FILE_MB = 5;
export const PDF_MAX_FILE_BYTES = PDF_MAX_FILE_MB * 1024 * 1024;
export const PDF_UPLOAD_TIMEOUT_MS = 90_000;

const RTDB_PDF_SCHEME = "pdf://";
const DOCUMENT_FILES_NODE = "documentFiles";

export interface PreparedPdf {
  dataUrl: string;
  fileName: string;
  fileSize: number;
}

export function isRtdbPdf(ref: string | undefined): boolean {
  return !!ref && ref.startsWith(RTDB_PDF_SCHEME);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validate a user-selected file as a PDF (extension/MIME + "%PDF-" signature inside the
 * first 1 KB) and return it as a data URL ready to be persisted.
 */
export function readPdfFile(file: File): Promise<PreparedPdf> {
  return new Promise((resolve, reject) => {
    const name = file.name || "";
    const looksLikePdf = /\.pdf$/i.test(name) || file.type === "application/pdf";
    if (!looksLikePdf) {
      reject(new Error("รองรับเฉพาะไฟล์ PDF (.pdf) เท่านั้น"));
      return;
    }
    if (file.size === 0) {
      reject(new Error("ไฟล์ว่างเปล่า กรุณาเลือกไฟล์ PDF ที่ถูกต้อง"));
      return;
    }
    if (file.size > PDF_MAX_FILE_BYTES) {
      reject(new Error(`ไฟล์ PDF ต้องมีขนาดไม่เกิน ${PDF_MAX_FILE_MB} MB (ไฟล์นี้ ${formatFileSize(file.size)})`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      if (!hasPdfSignature(new Uint8Array(buffer))) {
        reject(new Error("ไฟล์นี้ไม่ใช่ PDF ที่ถูกต้อง (ไม่พบส่วนหัว %PDF) กรุณาบันทึกเอกสารเป็น PDF แล้วอัปโหลดใหม่"));
        return;
      }
      resolve({
        dataUrl: `data:application/pdf;base64,${bytesToBase64(new Uint8Array(buffer))}`,
        fileName: /\.pdf$/i.test(name) ? name : `${name || "document"}.pdf`,
        fileSize: file.size,
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

/** PDF header "%PDF-" must appear within the first 1024 bytes (ISO 32000-1 §7.5.2). */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024);
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  outer: for (let i = 0; i + sig.length <= limit; i++) {
    for (let j = 0; j < sig.length; j++) {
      if (bytes[i + j] !== sig[j]) continue outer;
    }
    return true;
  }
  return false;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Persist a PDF and return the reference to store on the document record.
 * Unlike avatars this MUST be acknowledged before the record is created — the file is the
 * deliverable the advisor has to be able to open.
 */
export async function uploadPdfDocument(docId: string, dataUrl: string): Promise<string> {
  if (USE_FIREBASE_STORAGE && storage) {
    try {
      const fileRef = storageRef(storage, `documents/${toSafeKey(docId)}.pdf`);
      return await withTimeout<string>(
        uploadString(fileRef, dataUrl, "data_url", { contentType: "application/pdf" }).then(() => getDownloadURL(fileRef)),
        PDF_UPLOAD_TIMEOUT_MS,
        "Firebase Storage upload"
      );
    } catch (e: any) {
      console.debug("Firebase Storage unavailable, using database document store:", e?.code || e?.message);
    }
  }
  if (!rtdb || isCloudDisabled()) {
    throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลเพื่ออัปโหลดไฟล์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
  }
  const key = toSafeKey(docId);
  await withTimeout(set(dbRef(rtdb, `${RTDB_ROOT}/${DOCUMENT_FILES_NODE}/${key}`), dataUrl), PDF_UPLOAD_TIMEOUT_MS, "Database document write");
  pdfCache.set(key, dataUrl);
  return `${RTDB_PDF_SCHEME}${key}`;
}

const pdfCache = new Map<string, string>();

/** Resolve a document reference to something a browser can open (data URL or https URL). */
export async function resolvePdfDocument(fileRef: string): Promise<string | null> {
  if (!fileRef) return null;
  if (!isRtdbPdf(fileRef)) return fileRef;
  const key = fileRef.slice(RTDB_PDF_SCHEME.length);
  const cached = pdfCache.get(key);
  if (cached) return cached;
  if (!rtdb || isCloudDisabled()) return null;
  const snap = await get(dbRef(rtdb, `${RTDB_ROOT}/${DOCUMENT_FILES_NODE}/${key}`));
  const val = snap.exists() ? String(snap.val()) : null;
  if (val) pdfCache.set(key, val);
  return val;
}

/** Remove the stored file (used when a student withdraws an unreviewed submission). */
export async function deletePdfDocument(fileRef: string): Promise<void> {
  if (!fileRef) return;
  try {
    if (isRtdbPdf(fileRef)) {
      const key = fileRef.slice(RTDB_PDF_SCHEME.length);
      pdfCache.delete(key);
      if (rtdb && !isCloudDisabled()) await remove(dbRef(rtdb, `${RTDB_ROOT}/${DOCUMENT_FILES_NODE}/${key}`));
    } else if (storage && /firebasestorage\.googleapis\.com/.test(fileRef)) {
      await deleteObject(storageRef(storage, fileRef));
    }
  } catch (e: any) {
    console.debug("Document file removal skipped:", e?.code || e?.message);
  }
}

/**
 * Open a PDF in a new tab. Browsers refuse top-level navigation to data: URLs, so the
 * base64 payload is turned into a Blob first. Returns false when nothing could be opened.
 */
export async function openPdfDocument(fileRef: string, fileName: string): Promise<boolean> {
  const src = await resolvePdfDocument(fileRef);
  if (!src) return false;
  if (!src.startsWith("data:")) {
    window.open(src, "_blank", "noopener,noreferrer");
    return true;
  }
  const comma = src.indexOf(",");
  const binary = atob(src.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Pop-up blocked: fall back to a download link.
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "document.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
