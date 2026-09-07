// Remove the demo/test records (4 sample students + their QE bookings, results, advisor
// logs and conference evidence) from the Firebase Realtime Database.
//
// Only ids defined in src/lib/mock/seedData.ts (DEMO_*) are touched, so real roster
// accounts and real bookings are never affected. Idempotent.
//
// Usage:
//   node -r ./scripts/register-ts.js scripts/reset-demo-data.js [--dry-run] [--all-transactions]
//
//   --all-transactions  additionally wipes EVERY record in qeBookings / qeResults /
//                       advisorLogs / conferenceEvidence / projectDocuments (+ documentFiles)
//                       (use only to reset a test system).
const { ref, update, get } = require("firebase/database");
const { rtdb } = require("../src/lib/firebase/config.ts");
const { RTDB_ROOT, toSafeKey } = require("../src/lib/firebase/rtdb.ts");
const seed = require("../src/lib/mock/seedData.ts");

const dryRun = process.argv.includes("--dry-run");
const allTransactions = process.argv.includes("--all-transactions");

const DEMO_PLAN = [
  ["qeBookings", seed.DEMO_QE_BOOKINGS],
  ["qeResults", seed.DEMO_QE_RESULTS],
  ["advisorLogs", seed.DEMO_ADVISOR_LOGS],
  ["conferenceEvidence", seed.DEMO_CONFERENCE_EVIDENCE],
  ["projectDocuments", []],
  ["students", seed.DEMO_STUDENTS],
];
const TRANSACTIONAL = ["qeBookings", "qeResults", "advisorLogs", "conferenceEvidence", "projectDocuments"];

(async () => {
  console.log(`=== Reset demo data (${dryRun ? "DRY RUN" : "LIVE"}${allTransactions ? ", ALL transactions" : ""}) ===`);
  const removals = {};

  for (const [name, items] of DEMO_PLAN) {
    const snap = await get(ref(rtdb, `${RTDB_ROOT}/${name}`));
    const cloud = snap.exists() ? snap.val() : {};
    const cloudKeys = new Set(Object.keys(cloud));
    const targets = items.map((i) => toSafeKey(i.id)).filter((k) => cloudKeys.has(k));
    console.log(`[${name}] cloud=${cloudKeys.size} demo-in-cloud=${targets.length}${targets.length ? " -> " + targets.join(", ") : ""}`);
    for (const k of targets) removals[`${name}/${k}`] = null;

    if (allTransactions && TRANSACTIONAL.includes(name)) {
      for (const k of cloudKeys) removals[`${name}/${k}`] = null;
    }
  }

  if (allTransactions) {
    // Uploaded PDF payloads live next to (not inside) projectDocuments.
    const files = await get(ref(rtdb, `${RTDB_ROOT}/documentFiles`));
    const fileKeys = files.exists() ? Object.keys(files.val()) : [];
    console.log(`[documentFiles] cloud=${fileKeys.length}`);
    for (const k of fileKeys) removals[`documentFiles/${k}`] = null;
  }

  // Demo students used stock photos; if one had a database avatar, drop it too.
  for (const s of seed.DEMO_STUDENTS) {
    const snap = await get(ref(rtdb, `${RTDB_ROOT}/avatars/students/${toSafeKey(s.id)}`));
    if (snap.exists()) removals[`avatars/students/${toSafeKey(s.id)}`] = null;
  }

  const paths = Object.keys(removals);
  if (paths.length === 0) {
    console.log("\nNothing to remove — cloud is already clean.");
    process.exit(0);
  }
  console.log(`\n${paths.length} record(s) to remove.`);
  if (dryRun) {
    console.log("Dry run: no changes written.");
    process.exit(0);
  }

  await update(ref(rtdb, RTDB_ROOT), removals);

  // Read-back verification
  console.log("\n=== Read-back ===");
  let failures = 0;
  for (const p of paths) {
    const snap = await get(ref(rtdb, `${RTDB_ROOT}/${p}`));
    if (snap.exists()) {
      failures++;
      console.log(`[FAIL] ${p} still exists`);
    }
  }
  for (const name of TRANSACTIONAL) {
    const snap = await get(ref(rtdb, `${RTDB_ROOT}/${name}`));
    console.log(`[${name}] remaining records: ${snap.exists() ? Object.keys(snap.val()).length : 0}`);
  }
  console.log(failures === 0 ? "\n=== DONE: demo data removed ===" : `\n=== ${failures} FAILURE(S) ===`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("Reset failed:", e);
  process.exit(1);
});
