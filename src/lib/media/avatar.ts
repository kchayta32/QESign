import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { ref as dbRef, set, get } from "firebase/database";
import { storage, rtdb } from "@/lib/firebase/config";
import { RTDB_ROOT, isCloudDisabled } from "@/lib/firebase/rtdb";

export const AVATAR_MAX_PX = 192;
export const AVATAR_JPEG_QUALITY = 0.82;
export const AVATAR_MAX_FILE_MB = 8;

export type AvatarKind = "students" | "teachers";

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
 *  1. Firebase Storage (public download URL) when the bucket is available;
 *  2. otherwise the Realtime Database node /ssru_ce/avatars/<kind>/<id> (referenced as
 *     avatar://<kind>/<id>) so account records stay small;
 *  3. as a last resort the inline data URL.
 */
export async function uploadAvatar(kind: AvatarKind, accountId: string, dataUrl: string): Promise<string> {
  if (storage) {
    try {
      const fileRef = storageRef(storage, `avatars/${kind}/${accountId}.jpg`);
      await uploadString(fileRef, dataUrl, "data_url", { contentType: "image/jpeg" });
      return await getDownloadURL(fileRef);
    } catch (e: any) {
      console.debug("Firebase Storage unavailable, using database avatar store:", e?.code || e?.message);
    }
  }
  if (rtdb && !isCloudDisabled()) {
    try {
      await set(dbRef(rtdb, `${RTDB_ROOT}/avatars/${kind}/${accountId}`), dataUrl);
      avatarCache.set(`${kind}/${accountId}`, dataUrl);
      return `${RTDB_AVATAR_SCHEME}${kind}/${accountId}`;
    } catch (e: any) {
      console.debug("Database avatar store unavailable, keeping inline avatar:", e?.code || e?.message);
    }
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
