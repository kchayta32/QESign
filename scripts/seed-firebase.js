// Seed / migrate the Firebase Realtime Database with the pre-registered roster.
// Idempotent: adds records that are missing, converts legacy array-indexed nodes to
// id-keyed maps, never overwrites records that already exist (profile edits, hashes).
//
// Usage:  node -r ./scripts/register-ts.js scripts/seed-firebase.js [--dry-run]
const { ref, remove } = require("firebase/database");
const { rtdb } = require("../src/lib/firebase/config.ts");
const {
  readCollectionOnce,
  pushManyToRTDB,
  rewriteCollectionKeyed,
  hasLegacyNumericKeys,
  RTDB_ROOT,
} = require("../src/lib/firebase/rtdb.ts");
const seed = require("../src/lib/mock/seedData.ts");
const { SEED_ADMINS, mergeRegistry } = require("../src/lib/firebase/db.ts");

const dryRun = process.argv.includes("--dry-run");

const PLAN = [
  ["teachers", seed.MOCK_TEACHERS],
  ["students", seed.MOCK_STUDENTS],
  ["admins", SEED_ADMINS],
  ["qeBookings", seed.MOCK_QE_BOOKINGS],
  ["qeResults", seed.MOCK_QE_RESULTS],
  ["advisorLogs", seed.MOCK_ADVISOR_LOGS],
  ["conferenceEvidence", seed.MOCK_CONFERENCE_EVIDENCE],
];

// Nodes no longer stored in the cloud (definitions live in code; counts are computed).
const OBSOLETE_NODES = ["tracks", "examRounds"];

/** A cloud record nobody has ever touched (no login, no password, no profile submission). */
const isPristine = (r) => !r.passwordHash && !r.lastLoginAt && !r.profileCompleted;

/**
 * Legacy-layout migration merge: current seed wins over *pristine* legacy records (they
 * are just an outdated copy of the old seed, e.g. wrong e-mails), while any record that
 * carries user state keeps the cloud version. Records unknown to the seed are preserved.
 */
function migrationMerge(seedItems, cloudItems) {
  const merged = mergeRegistry(seedItems, cloudItems); // cloud wins by default
  const seedById = new Map(seedItems.map((s) => [s.id, s]));
  return merged.map((r) => (seedById.has(r.id) && isPristine(r) ? seedById.get(r.id) : r));
}

(async () => {
  console.log(`=== Seeding Realtime Database (${dryRun ? "DRY RUN" : "LIVE"}) ===`);
  for (const [name, seedItems] of PLAN) {
    const { items: cloudItems, raw, exists } = await readCollectionOnce(name);
    if (exists && hasLegacyNumericKeys(raw)) {
      const merged = migrationMerge(seedItems, cloudItems);
      console.log(`[${name}] legacy numeric keys detected -> rewriting ${merged.length} records id-keyed`);
      if (!dryRun) await rewriteCollectionKeyed(name, merged);
      continue;
    }
    const cloudIds = new Set(cloudItems.map((i) => i.id));
    const missing = seedItems.filter((i) => !cloudIds.has(i.id));
    console.log(`[${name}] cloud=${cloudItems.length} seed=${seedItems.length} missing=${missing.length}`);
    if (missing.length > 0 && !dryRun) {
      const ok = await pushManyToRTDB(name, missing);
      if (!ok) {
        console.error(`[${name}] push FAILED`);
        process.exitCode = 1;
      }
    }
  }

  for (const node of OBSOLETE_NODES) {
    const { exists } = await readCollectionOnce(node);
    if (exists) {
      console.log(`[${node}] obsolete node present -> removing`);
      if (!dryRun) await remove(ref(rtdb, `${RTDB_ROOT}/${node}`));
    }
  }

  // Read-back verification
  console.log("\n=== Read-back ===");
  for (const [name, seedItems] of PLAN) {
    const { items, raw } = await readCollectionOnce(name);
    const ids = new Set(items.map((i) => i.id));
    const missing = seedItems.filter((i) => !ids.has(i.id)).length;
    const legacy = hasLegacyNumericKeys(raw);
    const ok = dryRun || (missing === 0 && !legacy);
    console.log(`[${ok ? "OK" : "FAIL"}] ${name}: ${items.length} records, seed missing=${missing}, legacyKeys=${legacy}`);
    if (!ok) process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
