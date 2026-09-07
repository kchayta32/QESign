import { rtdb } from "./config";
import { ref, set, update, onValue, get, remove } from "firebase/database";
import type {
  Track,
  Teacher,
  Student,
  AdminAccount,
  ExamRound,
  QEBooking,
  QEResult,
  AdvisorMeetingLog,
  ConferenceEvidence,
  ProjectDocument
} from "@/types";

export const RTDB_ROOT = "ssru_ce";

/**
 * Kill-switch used by local verification scripts so they never touch the live
 * database (server-side only; undefined in the browser bundle).
 */
export function isCloudDisabled(): boolean {
  return typeof process !== "undefined" && process.env?.SSRU_DISABLE_CLOUD === "1";
}

function cloudAvailable(): boolean {
  return !!rtdb && !isCloudDisabled();
}

export interface SSRUCERealtimeState {
  tracks: Track[];
  teachers: Teacher[];
  students: Student[];
  admins: AdminAccount[];
  examRounds: ExamRound[];
  qeBookings: QEBooking[];
  qeResults: QEResult[];
  advisorLogs: AdvisorMeetingLog[];
  conferenceEvidence: ConferenceEvidence[];
  projectDocuments: ProjectDocument[];
}

export type CollectionName = keyof SSRUCERealtimeState;

export const COLLECTION_NAMES: CollectionName[] = [
  "tracks",
  "teachers",
  "students",
  "admins",
  "examRounds",
  "qeBookings",
  "qeResults",
  "advisorLogs",
  "conferenceEvidence",
  "projectDocuments",
];

/**
 * Firebase rejects any payload containing `undefined`. Records in this app routinely
 * carry optional fields (coAdvisorId, rejectionReason, …) so we strip them before
 * every write instead of letting the write fail silently.
 */
export function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Firebase keys may not contain . $ # [ ] / — ids in this app are safe, but guard anyway. */
export function toSafeKey(id: string): string {
  return id.replace(/[.$#[\]/]/g, "_");
}

function collectionRef(name: CollectionName) {
  return ref(rtdb, `${RTDB_ROOT}/${name}`);
}

/** Convert a snapshot value (object keyed by id, or legacy array/numeric keys) to an array. */
export function snapshotToArray<T>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean) as T[];
  if (typeof val === "object") return Object.values(val as Record<string, T>).filter(Boolean);
  return [];
}

/** True when a collection node still uses legacy numeric keys ("0", "1", …) or is an array. */
export function hasLegacyNumericKeys(val: unknown): boolean {
  if (Array.isArray(val)) return true;
  if (!val || typeof val !== "object") return false;
  const keys = Object.keys(val as object);
  return keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
}

export function toKeyedMap<T extends { id: string }>(items: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  for (const item of items) {
    if (item && item.id) map[toSafeKey(item.id)] = stripUndefined(item);
  }
  return map;
}

/**
 * Subscribe to one collection. The callback receives the parsed array plus the raw
 * value (so callers can detect legacy layouts). Returns an unsubscribe function.
 */
export function subscribeToCollection<T>(
  name: CollectionName,
  onUpdate: (items: T[], raw: unknown, exists: boolean) => void
): () => void {
  if (!cloudAvailable()) {
    if (!isCloudDisabled()) console.warn(`Realtime Database not initialized; ${name} stays in local mode.`);
    return () => {};
  }
  try {
    return onValue(
      collectionRef(name),
      (snapshot) => {
        const raw = snapshot.exists() ? snapshot.val() : null;
        onUpdate(snapshotToArray<T>(raw), raw, snapshot.exists());
      },
      (error) => {
        console.warn(`Realtime Database listener error on ${name}:`, error.message);
      }
    );
  } catch (e) {
    console.warn(`Error subscribing to ${name}:`, e);
    return () => {};
  }
}

/** Write (or overwrite) a single record at /ssru_ce/<collection>/<id>. */
export async function pushEntityToRTDB(
  collectionName: CollectionName,
  entityId: string,
  data: unknown
): Promise<boolean> {
  if (!cloudAvailable()) return false;
  try {
    await set(ref(rtdb, `${RTDB_ROOT}/${collectionName}/${toSafeKey(entityId)}`), stripUndefined(data));
    return true;
  } catch (e) {
    console.warn(`Realtime Database push error on ${collectionName}/${entityId}:`, e);
    return false;
  }
}

/** Acknowledged multi-path write: callers must not report success for queued/failed writes. */
export async function persistChanges(changes: Record<string, unknown>): Promise<void> {
  if (isCloudDisabled()) return; // explicit offline test mode only
  if (!rtdb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      update(ref(rtdb, RTDB_ROOT), stripUndefined(changes)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("ยังไม่ได้รับการยืนยันจากฐานข้อมูล กรุณาตรวจสอบการเชื่อมต่อและลองใหม่"), { code: "WRITE_UNCONFIRMED" })), 15000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Delete a single record at /ssru_ce/<collection>/<id>. */
export async function removeEntityFromRTDB(collectionName: CollectionName, entityId: string): Promise<boolean> {
  if (!cloudAvailable()) return false;
  try {
    await remove(ref(rtdb, `${RTDB_ROOT}/${collectionName}/${toSafeKey(entityId)}`));
    return true;
  } catch (e) {
    console.warn(`Realtime Database remove error on ${collectionName}/${entityId}:`, e);
    return false;
  }
}

/** Multi-record upsert in one round-trip (does not touch records that are not listed). */
export async function pushManyToRTDB<T extends { id: string }>(
  collectionName: CollectionName,
  items: T[]
): Promise<boolean> {
  if (!cloudAvailable() || items.length === 0) return false;
  try {
    await update(collectionRef(collectionName), toKeyedMap(items));
    return true;
  } catch (e) {
    console.warn(`Realtime Database bulk push error on ${collectionName}:`, e);
    return false;
  }
}

/** Replace a whole collection with an id-keyed map (used once to migrate legacy layouts). */
export async function rewriteCollectionKeyed<T extends { id: string }>(
  collectionName: CollectionName,
  items: T[]
): Promise<boolean> {
  if (!cloudAvailable()) return false;
  try {
    await set(collectionRef(collectionName), toKeyedMap(items));
    return true;
  } catch (e) {
    console.warn(`Realtime Database rewrite error on ${collectionName}:`, e);
    return false;
  }
}

export async function readCollectionOnce<T>(collectionName: CollectionName): Promise<{ items: T[]; raw: unknown; exists: boolean }> {
  if (!cloudAvailable()) return { items: [], raw: null, exists: false };
  const snap = await get(collectionRef(collectionName));
  const raw = snap.exists() ? snap.val() : null;
  return { items: snapshotToArray<T>(raw), raw, exists: snap.exists() };
}
