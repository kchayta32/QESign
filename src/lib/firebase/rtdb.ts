import { rtdb } from "./config";
import { ref, set, get, update, onValue, child } from "firebase/database";
import {
  Track,
  Teacher,
  Student,
  ExamRound,
  QEBooking,
  QEResult,
  AdvisorMeetingLog,
  ConferenceEvidence
} from "@/types";

export interface SSRUCERealtimeState {
  tracks: Track[];
  teachers: Teacher[];
  students: Student[];
  examRounds: ExamRound[];
  qeBookings: QEBooking[];
  qeResults: QEResult[];
  advisorLogs: AdvisorMeetingLog[];
  conferenceEvidence: ConferenceEvidence[];
}

/**
 * Setup Realtime Listener on /ssru_ce node
 * Invokes onUpdate callback immediately whenever data in Firebase Realtime Database changes
 */
export function subscribeToRealtimeDatabase(
  onUpdate: (data: Partial<SSRUCERealtimeState>) => void
): () => void {
  if (!rtdb) {
    console.warn("Realtime Database not initialized, running in local sync mode.");
    return () => {};
  }

  try {
    const rootRef = ref(rtdb, "ssru_ce");
    const unsubscribe = onValue(
      rootRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          onUpdate({
            tracks: val.tracks ? Object.values(val.tracks) : undefined,
            teachers: val.teachers ? Object.values(val.teachers) : undefined,
            students: val.students ? Object.values(val.students) : undefined,
            examRounds: val.examRounds ? Object.values(val.examRounds) : undefined,
            qeBookings: val.qeBookings ? Object.values(val.qeBookings) : undefined,
            qeResults: val.qeResults ? Object.values(val.qeResults) : undefined,
            advisorLogs: val.advisorLogs ? Object.values(val.advisorLogs) : undefined,
            conferenceEvidence: val.conferenceEvidence ? Object.values(val.conferenceEvidence) : undefined,
          });
        }
      },
      (error) => {
        console.warn("Realtime Database listener notice:", error.message);
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn("Error subscribing to Realtime Database:", e);
    return () => {};
  }
}

/**
 * Sync entire dataset or initial seed to Realtime Database
 */
export async function syncAllToRealtimeDatabase(state: SSRUCERealtimeState): Promise<void> {
  if (!rtdb) return;
  try {
    const rootRef = ref(rtdb, "ssru_ce");
    await set(rootRef, state);
  } catch (e) {
    console.warn("Realtime Database sync error:", e);
  }
}

/**
 * Push an individual entity update to Realtime Database
 */
export async function pushEntityToRTDB(
  collectionName: keyof SSRUCERealtimeState,
  entityId: string,
  data: any
): Promise<void> {
  if (!rtdb) return;
  try {
    const itemRef = ref(rtdb, `ssru_ce/${collectionName}/${entityId}`);
    await set(itemRef, data);
  } catch (e) {
    console.warn(`Realtime Database push error on ${collectionName}/${entityId}:`, e);
  }
}
