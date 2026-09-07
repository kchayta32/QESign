import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { ref as dbRef, set, get } from "firebase/database";
import { storage, rtdb } from "@/lib/firebase/config";
import { RTDB_ROOT, isCloudDisabled } from "@/lib/firebase/rtdb";

export const AVATAR_MAX_PX = 192;
export const AVATAR_JPEG_QUALITY = 0.82;
export const AVATAR_MAX_FILE_MB = 8;

/**
 * Firebase Storage is opt-in. The project has no provisioned Storage bucket, and the
 * Storage SDK retries a failed upload with exponential back-off for up to 10 minutes
 * (DEFAULT_MAX_UPLOAD_RETRY_TIME) before it gives up — which is what made "บันทึกข้อมูล"
 * on the first-login profile form hang. Set NEXT_PUBLIC_FIREBASE_USE_STORAGE=true only
 * after a bucket exists and its rules/CORS allow uploads.
 */
export const USE_FIREBASE_STORAGE = process.env.NEXT_PUBLIC_FIREBASE_USE_STORAGE === "true";

/** Upper bound for any single avatar persistence attempt so the save button never hangs. */
export const AVATAR_UPLOAD_TIMEOUT_MS = 6000;

/**
 * How long the profile form waits for the Realtime Database to acknowledge the avatar
 * write. If acknowledgement is slow, return the resized inline JPEG so the profile write
 * itself can persist the picture rather than referencing an unconfirmed upload.
 */
export const AVATAR_RTDB_ACK_WAIT_MS = 2500;

export type AvatarKind = "students" | "teachers";

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

/** Marker scheme for avatars stored in the Realtime Database (kept out of account records). */
const RTDB_AVATAR_SCHEME = "avatar://";

const INITIALS_AVATAR_BASE = "https://ui-avatars.com/api/?background=A6192E&color=fff&size=256&name=";

/** Placeholder avatar with initials (no external photo required). */
export function fallbackAvatar(name: string): string {
  return `${INITIALS_AVATAR_BASE}${encodeURIComponent(name.trim() || "SSRU")}`;
}

export function isRtdbAvatar(url: string | undefined): boolean {
  return !!url && url.startsWith(RTDB_AVATAR_SCHEME);
}

/**
 * Downscale an image file to a square JPEG data URL (≈8–15 KB) so profile pictures stay
 * small wherever they end up being stored.
 */
export function resizeImageFile(file: File, maxPx: number = AVATAR_MAX_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP)"));
      return;
    }
    if (file.size > AVATAR_MAX_FILE_MB * 1024 * 1024) {
      reject(new Error(`ไฟล์รูปต้องมีขนาดไม่เกิน ${AVATAR_MAX_FILE_MB} MB`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไฟล์รูปไม่ถูกต้อง"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxPx;
        canvas.height = maxPx;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("เบราว์เซอร์ไม่รองรับการย่อรูป"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxPx, maxPx);
        resolve(canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Persist an avatar and return the URL to store on the account record.
 *  1. Realtime Database node /ssru_ce/avatars/<kind>/<id> (referenced as avatar://<kind>/<id>)
 *     so account records stay small — this is the default path;
 *  2. Firebase Storage (public download URL) only when explicitly enabled;
 *  3. as a last resort the inline data URL (the record is still saved instantly).
 * Storage attempts are bounded by AVATAR_UPLOAD_TIMEOUT_MS; the database write is waited
 * on for at most AVATAR_RTDB_ACK_WAIT_MS (it keeps going in the background afterwards).
 */
export async function uploadAvatar(kind: AvatarKind, accountId: string, dataUrl: string): Promise<string> {
  if (USE_FIREBASE_STORAGE && storage) {
    try {
      const fileRef = storageRef(storage, `avatars/${kind}/${accountId}.jpg`);
      const url = await withTimeout<string>(
        uploadString(fileRef, dataUrl, "data_url", { contentType: "image/jpeg" }).then(() => getDownloadURL(fileRef)),
        AVATAR_UPLOAD_TIMEOUT_MS,
        "Firebase Storage upload"
      );
      return url;
    } catch (e: any) {
      console.debug("Firebase Storage unavailable, using database avatar store:", e?.code || e?.message);
    }
  }
  if (rtdb && !isCloudDisabled()) {
    const key = `${kind}/${accountId}`;
    // Cache first so the UI can render the new picture immediately, even if the write is
    // still in flight (Firebase queues it and delivers it once the connection is up).
    avatarCache.set(key, dataUrl);
    const write = set(dbRef(rtdb, `${RTDB_ROOT}/avatars/${key}`), dataUrl).then(
      () => "ok" as const,
      (e: any) => {
        avatarCache.delete(key);
        console.debug("Database avatar store rejected the write:", e?.code || e?.message);
        return "error" as const;
      }
    );
    const outcome = await Promise.race([
      write,
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), AVATAR_RTDB_ACK_WAIT_MS)),
    ]);
    if (outcome === "ok") return `${RTDB_AVATAR_SCHEME}${key}`;
    // A queued write is not durable (closing the tab can lose it). Persist the small
    // inline JPEG with the profile on timeout/rejection, never a dangling reference.
  }
  return dataUrl;
}

const avatarCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

/** Resolve an avatar:// reference to its data URL (cached per session). */
export async function resolveRtdbAvatar(url: string): Promise<string | null> {
  if (!isRtdbAvatar(url)) return url;
  const key = url.slice(RTDB_AVATAR_SCHEME.length);
  const cached = avatarCache.get(key);
  if (cached) return cached;
  if (!rtdb || isCloudDisabled()) return null;
  let p = inflight.get(key);
  if (!p) {
    p = get(dbRef(rtdb, `${RTDB_ROOT}/avatars/${key}`))
      .then((snap) => {
        const val = snap.exists() ? String(snap.val()) : null;
        if (val) avatarCache.set(key, val);
        return val;
      })
      .catch(() => null)
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}
