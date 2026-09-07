// Reset all users (both students and teachers) in the Firebase Realtime Database
// to brand new accounts, and wipe transactional data for a fresh start.
// Usage: node -r ./scripts/register-ts.js scripts/reset-all-users.js [--dry-run]
const { ref, get, update, remove } = require("firebase/database");
const { rtdb } = require("../src/lib/firebase/config.ts");
const { RTDB_ROOT, toSafeKey } = require("../src/lib/firebase/rtdb.ts");
const { MOCK_TEACHERS, expandStudentCodes, createRosterStudent } = require("../src/lib/mock/seedData.ts");

const dryRun = process.argv.includes("--dry-run");
const db = rtdb;

(async () => {
  console.log(`=== Reset All Users to Fresh/New State (${dryRun ? "DRY RUN" : "LIVE"}) ===\n`);

  const updates = {};

  // Stage 1: Clear all transactional nodes first
  const TRANSACTIONAL_NODES = [
    "qeBookingSlots",
    "qeBookings",
    "qeResults",
    "advisorLogs",
    "conferenceEvidence",
    "documentSlots",
    "projectDocuments",
    "projectGroups",
    "projectMemberships",
    "documentFiles",
    "reviewFiles",
  ];

  console.log("--- Stage 1: Clearing transactional nodes ---");
  for (const node of TRANSACTIONAL_NODES) {
    const snap = await get(ref(db, `${RTDB_ROOT}/${node}`));
    if (snap.exists()) {
      const count = Object.keys(snap.val()).length;
      console.log(`Clearing ${node} (${count} items)...`);
      if (!dryRun) {
        await remove(ref(db, `${RTDB_ROOT}/${node}`));
      }
    }
  }

  // Stage 2: Reset teachers
  console.log("\n--- Stage 2: Resetting teachers ---");
  const tSnap = await get(ref(db, `${RTDB_ROOT}/teachers`));
  const cloudTeachers = tSnap.val() || {};
  console.log(`Found ${Object.keys(cloudTeachers).length} teachers in cloud.`);
  const teacherUpdates = {};
  for (const [key, t] of Object.entries(cloudTeachers)) {
    const seed = MOCK_TEACHERS.find((s) => s.id === key || s.id === t.id);
    teacherUpdates[`teachers/${key}`] = {
      ...t,
      prefixTh: seed?.prefixTh || t.prefixTh,
      firstNameTh: seed?.firstNameTh || t.firstNameTh,
      lastNameTh: seed?.lastNameTh || t.lastNameTh,
      academicRankTh: seed?.academicRankTh || t.academicRankTh,
      profileCompleted: false,
      passwordChanged: false,
      authProvisioned: false,
      currentAdviseesCount: 0,
      passwordHash: null,
      lastLoginAt: null,
    };
  }
  if (!dryRun && Object.keys(teacherUpdates).length > 0) {
    await update(ref(db, RTDB_ROOT), teacherUpdates);
    console.log("✓ Teachers reset to pristine state");
  }

  // Stage 3: Reset students in batches
  console.log("\n--- Stage 3: Resetting students ---");
  const sSnap = await get(ref(db, `${RTDB_ROOT}/students`));
  const cloudStudents = sSnap.val() || {};
  console.log(`Found ${Object.keys(cloudStudents).length} students in cloud.`);
  const studentUpdates = {};
  for (const [key, s] of Object.entries(cloudStudents)) {
    const code = s.studentCode || key.replace(/^STD-/, "");
    const cleanRoster = createRosterStudent(code);
    studentUpdates[`students/${key}`] = {
      ...cleanRoster,
      id: s.id || `STD-${code}`,
      studentCode: code,
      email: cleanRoster.email,
      trackId: s.trackId || "SW",
      yearLevel: cleanRoster.yearLevel,
      status: "active",
      profileCompleted: false,
      passwordChanged: false,
      authProvisioned: false,
      passed3Chapter: false,
      passedQE: false,
      finalEligible: false,
      advisorId: "",
      projectTitleTh: "",
      projectTitleEn: "",
      phone: "",
      avatarUrl: "",
      passwordHash: null,
      lastLoginAt: null,
    };
  }
  if (!dryRun && Object.keys(studentUpdates).length > 0) {
    // Write in chunks of 100 to avoid request size limits
    const entries = Object.entries(studentUpdates);
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = Object.fromEntries(entries.slice(i, i + 100));
      await update(ref(db, RTDB_ROOT), chunk);
      console.log(`✓ Students reset batch ${i + 1} - ${Math.min(i + 100, entries.length)}`);
    }
  }

  // Stage 4: Reset examSlots
  console.log("\n--- Stage 4: Resetting examSlots ---");
  const slotSnap = await get(ref(db, `${RTDB_ROOT}/examSlots`));
  if (slotSnap.exists()) {
    const slots = slotSnap.val();
    const slotUpdates = {};
    for (const [key, slot] of Object.entries(slots)) {
      slotUpdates[`examSlots/${key}`] = {
        ...slot,
        status: "open",
        capacity: slot.capacity && slot.capacity > 1 ? slot.capacity : 5,
        bookedStudents: null,
        bookedStudentId: null,
        bookedStudentCode: null,
        bookedStudentName: null,
        bookingId: null,
      };
    }
    if (!dryRun) {
      await update(ref(db, RTDB_ROOT), slotUpdates);
      console.log(`✓ Reset ${Object.keys(slots).length} exam slots to open with capacity`);
    }
  }

  console.log(`\nPrepared ${Object.keys(updates).length} updates/removals.`);

  if (dryRun) {
    console.log("Dry run finished. No changes written.");
    process.exit(0);
  }

  console.log("Writing updates to Realtime Database...");
  await update(ref(db, RTDB_ROOT), updates);
  console.log("✓ Successfully reset all users and transactions in Realtime Database!");

  // Verify
  console.log("\n=== Verifying User Reset State ===");
  const tCheck = await get(ref(db, `${RTDB_ROOT}/teachers`));
  const tVals = Object.values(tCheck.val() || {});
  const teachersNew = tVals.every((t) => !t.profileCompleted && !t.passwordChanged);
  console.log(`Teachers: all ${tVals.length} are new users? ${teachersNew ? "YES [PASS]" : "NO [FAIL]"}`);

  const sCheck = await get(ref(db, `${RTDB_ROOT}/students`));
  const sVals = Object.values(sCheck.val() || {});
  const studentsNew = sVals.every((s) => !s.profileCompleted && !s.passwordChanged && !s.passed3Chapter);
  console.log(`Students: all ${sVals.length} are new users? ${studentsNew ? "YES [PASS]" : "NO [FAIL]"}`);

  process.exit(teachersNew && studentsNew ? 0 : 1);
})().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
