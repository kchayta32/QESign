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
  ProjectDocument,
  ProjectGroup
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
  projectGroups: ProjectGroup[];
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
  "projectGroups",
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

// Firebase emits optimistic local onValue events before update() is acknowledged.
// Keep affected records at their last published values until the actual write settles,
// even if the caller's UI timeout has already elapsed. Other clients' records stay live.
const pendingRecords = new Map<string, number>();
const snapshotPublishers = new Set<() => void>();

function holdRecords(changes: Record<string, unknown>): () => void {
  const keys = Array.from(new Set(Object.keys(changes).map((path) => path.split('/').slice(0, 2).join('/'))));
  for (const key of keys) pendingRecords.set(key, (pendingRecords.get(key) || 0) + 1);
  return () => {
    for (const key of keys) {
      const count = (pendingRecords.get(key) || 1) - 1;
      if (count) pendingRecords.set(key, count); else pendingRecords.delete(key);
    }
    snapshotPublishers.forEach((publish) => publish());
  };
}

/**
 * Subscribe to one collection. Unacknowledged local writes are excluded from the
 * published snapshot so React/cache/business rules never treat them as confirmed.
 */
export function subscribeToCollection<T>(
  name: CollectionName,
  onUpdate: (items: T[], raw: unknown, exists: boolean) => void
): () => void {
  if (!cloudAvailable()) {
    if (!isCloudDisabled()) console.warn(`Realtime Database not initialized; ${name} stays in local mode.`);
    return () => {};
  }
  let latest: Record<string, unknown> | null = null;
  let published: Record<string, unknown> | null = null;
  let received = false;
  const publish = () => {
    if (!received) return;
    const next = { ...latest };
    for (const key of Array.from(pendingRecords.keys())) {
      const [collection, id] = key.split('/');
      if (collection !== name) continue;
      if (published && id in published) next[id] = published[id]; else delete next[id];
    }
    published = Object.keys(next).length ? next : null;
    onUpdate(snapshotToArray<T>(published), published, published !== null);
  };
  snapshotPublishers.add(publish);
  try {
    const unsubscribe = onValue(
      collectionRef(name),
      (snapshot) => {
        latest = snapshot.exists() ? snapshot.val() : null;
        received = true;
        publish();
      },
      (error) => {
        console.warn(`Realtime Database listener error on ${name}:`, error.message);
      }
    );
    return () => { snapshotPublishers.delete(publish); unsubscribe(); };
  } catch (e) {
    snapshotPublishers.delete(publish);
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
  const release = holdRecords(changes);
  let write: Promise<void>;
  try {
    write = update(ref(rtdb, RTDB_ROOT), stripUndefined(changes));
  } catch (error) {
    release();
    throw error;
  }
  // Do not release on UI timeout: Firebase may still commit or roll back later.
  const settled = write.then(() => { release(); }, (error) => { release(); throw error; });
  try {
    await Promise.race([
      settled,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("ยังไม่ได้รับการยืนยันจากฐานข้อมูล กรุณาตรวจสอบการเชื่อมต่อและลองใหม่"), { code: "WRITE_UNCONFIRMED" })), 15000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Read the authoritative slot, not just a reviewer's possibly stale collection cache. */
export async function readQEBookingSlot(studentId: string): Promise<QEBooking | undefined> {
  if (isCloudDisabled()) return undefined;
  if (!rtdb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    const slot = await get(ref(rtdb, `${RTDB_ROOT}/qeBookingSlots/${toSafeKey(studentId)}`));
    if (!slot.exists()) return undefined;
    const booking = await get(ref(rtdb, `${RTDB_ROOT}/qeBookings/${toSafeKey(String(slot.val()))}`));
    return booking.exists() ? booking.val() as QEBooking : undefined;
  };
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("อ่านคำร้องสอบล่าสุดไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่")), 8000);
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
