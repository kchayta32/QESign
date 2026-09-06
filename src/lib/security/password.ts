/**
 * Password hashing for account records stored in Firebase Realtime Database.
 *
 * Format: "pbkdf2-sha256$<iterations>$<hex digest>"
 * Salt   : per-account (login code) combined with a fixed application prefix.
 *
 * Uses WebCrypto (available in all modern browsers and Node >= 18).
 */

const ITERATIONS = 100_000;
const KEY_BITS = 256;
const ALGO_LABEL = "pbkdf2-sha256";
const SALT_PREFIX = "ssru-ce-qe:";

export const MIN_PASSWORD_LENGTH = 6;

function getSubtle(): SubtleCrypto {
  const c = (globalThis as any).crypto as Crypto | undefined;
  if (!c || !c.subtle) {
    throw new Error("WebCrypto is not available in this environment");
  }
  return c.subtle;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(password: string, salt: string, iterations: number): Promise<string> {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALT_PREFIX + salt), iterations },
    keyMaterial,
    KEY_BITS
  );
  return toHex(bits);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const digest = await derive(password, salt, ITERATIONS);
  return `${ALGO_LABEL}$${ITERATIONS}$${digest}`;
}

export async function verifyPassword(password: string, salt: string, storedHash: string | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const [algo, iterStr, digest] = storedHash.split("$");
  if (algo !== ALGO_LABEL || !iterStr || !digest) return false;
  const iterations = parseInt(iterStr, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const candidate = await derive(password, salt, iterations);
  return constantTimeEqual(candidate, digest);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function validateNewPassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `รหัสผ่านต้องมีความยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  }
  if (/\s/.test(password)) {
    return "รหัสผ่านต้องไม่มีช่องว่าง";
  }
  return null;
}
