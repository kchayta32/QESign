// End-to-end verification of the account model against the real data store & auth service
// (runs in Node with Firebase disabled by the missing `window`; cloud pushes are no-ops).
// Usage: node -r ./scripts/register-ts.js scripts/test-auth.js
process.env.SSRU_DISABLE_CLOUD = "1"; // never write to the live database from tests
const { dbStore } = require("../src/lib/firebase/db.ts");
const { resolveAccount, verifyAccountPassword, loginAccount, changeAccountPassword } = require("../src/lib/firebase/authService.ts");
const { expandStudentCodes, MOCK_TEACHERS } = require("../src/lib/mock/seedData.ts");

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${extra ? " -> " + extra : ""}`);
  if (!ok) failures++;
};

(async () => {
  console.log("=== Account / login verification ===");

  // Roster coverage
  const codes = expandStudentCodes();
  check("roster has 495 codes (75+95+88+105+132)", codes.length === 495, String(codes.length));
  const missing = codes.filter((c) => !dbStore.getStudentById(c));
  check("every roster code is registered in the store", missing.length === 0, missing.slice(0, 3).join(","));
  check("range boundaries present", ["65122519001", "65122519075", "66122519095", "67122519088", "68122519105", "69122519001", "69122519132"].every((c) => dbStore.getStudentById(c)));
  check("out-of-range code is NOT registered", !dbStore.getStudentById("65122519076") && !dbStore.getStudentById("69122519133"));

  // Teachers
  const expectedTeachers = ["kwanruan.ru", "pornpawit.bo", "ravi.ut", "kant.ch", "sethakarn.pr", "taksaorn.ak", "parinwat.th", "pongrapee.ka"];
  check("8 teachers registered", MOCK_TEACHERS.length === 8 && expectedTeachers.every((c) => dbStore.getTeacherById(c)));
  const parinwat = dbStore.getTeacherById("parinwat.th");
  check("teacher e-mail derived from code", parinwat.email === "parinwat.th@ssru.ac.th");
  check("teacher phone / faculty set", parinwat.phone === "02-160-1438" && /วิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม/.test(parinwat.faculty));
  check("teacher photo URL set", /eit\.ssru\.ac\.th/.test(parinwat.avatarUrl));

  // Resolution by code / e-mail
  check("resolve student by code", resolveAccount("66122519001")?.kind === "student");
  check("resolve student by e-mail", resolveAccount("s66122519001@ssru.ac.th")?.id === "STD-66122519001");
  check("resolve teacher by e-mail", resolveAccount("parinwat.th@ssru.ac.th")?.kind === "teacher");
  check("resolve teacher by code (case-insensitive)", resolveAccount("Parinwat.TH")?.id === "T-108");
  check("resolve admin by code", resolveAccount("ceadmin")?.kind === "admin");
  check("unknown identifier not resolved", resolveAccount("99999999999") === undefined);

  // Numeric student e-mail aliases and selected-role guards (before session creation).
  const { studentCodeFromEmail } = require('../src/lib/institution.ts');
  check('numeric student e-mail resolves existing roster account', resolveAccount(' 66122519001@SSRU.AC.TH ')?.id === 'STD-66122519001');
  check('numeric e-mail login succeeds with student role', (await loginAccount('66122519001@ssru.ac.th', '66122519001', 'student')).success);
  for (const role of ['teacher', 'admin']) {
    check(`numeric student e-mail rejects ${role} selection`, !(await loginAccount('66122519001@ssru.ac.th', '66122519001', role)).success);
  }
  check('wrong domain and wrong digit count are not student e-mails', ['66122519001@example.com', '6612251900@ssru.ac.th', '661225190011@ssru.ac.th', '66122519001@ssru.ac.th.evil'].every((value) => studentCodeFromEmail(value) === undefined));
  check('unregistered numeric e-mail cannot create a student', !(await loginAccount('99999999999@ssru.ac.th', '99999999999', 'student')).success);
  check('student alias still checks password', !(await loginAccount('66122519001@ssru.ac.th', 'wrong', 'student')).success);
  check('teacher account rejects student selection', !(await loginAccount('parinwat.th', 'parinwat.th', 'student')).success);
  check('admin correct role still works', (await loginAccount('ceadmin', 'ceadmin', 'admin')).success);

  // Default password rule
  check("student default password = code", await verifyAccountPassword(resolveAccount("66122519001"), "66122519001"));
  check("student wrong password rejected", !(await verifyAccountPassword(resolveAccount("66122519001"), "66122519002")));
  check("teacher default password = code", await verifyAccountPassword(resolveAccount("parinwat.th@ssru.ac.th"), "parinwat.th"));
  check("teacher wrong password rejected", !(await verifyAccountPassword(resolveAccount("parinwat.th"), "wrongpass")));
  check("empty password rejected", !(await verifyAccountPassword(resolveAccount("66122519001"), "")));

  // Full login flow
  const bad = await loginAccount("66122519001", "123456");
  check("loginAccount rejects wrong password", bad.success === false);
  const ok = await loginAccount("66122519001", "66122519001");
  check("loginAccount accepts default password", ok.success && ok.role === "student" && ok.entityId === "STD-66122519001");
  check("first login flags profile setup", ok.needsProfileSetup === true);
  check("lastLoginAt recorded", !!dbStore.getStudentById("66122519001").lastLoginAt);
  const okT = await loginAccount("parinwat.th@ssru.ac.th", "parinwat.th");
  check("teacher login by e-mail", okT.success && okT.role === "teacher" && okT.needsProfileSetup === true);
  const badUnknown = await loginAccount("nobody@ssru.ac.th", "nobody");
  check("unknown account rejected", badUnknown.success === false);

  // Change password
  const chgBad = await changeAccountPassword("student", "STD-66122519001", "wrong", "NewPass123");
  check("change password requires correct current password", chgBad.success === false);
  const chgShort = await changeAccountPassword("student", "STD-66122519001", "66122519001", "abc");
  check("change password enforces min length", chgShort.success === false);
  const chgSame = await changeAccountPassword("student", "STD-66122519001", "66122519001", "66122519001");
  check("new password may not equal the code", chgSame.success === false);
  const chg = await changeAccountPassword("student", "STD-66122519001", "66122519001", "NewPass123");
  check("change password succeeds", chg.success === true);
  check("hash stored & flag set", !!dbStore.getStudentById("66122519001").passwordHash && dbStore.getStudentById("66122519001").passwordChanged === true);
  check("old default password no longer works", (await loginAccount("66122519001", "66122519001")).success === false);
  check("new password works", (await loginAccount("66122519001", "NewPass123")).success === true);
  dbStore.resetPasswordToDefault("student", "STD-66122519001");
  check("admin reset restores default password", (await loginAccount("66122519001", "66122519001")).success === true);

  // Profile completion
  dbStore.updateStudentProfile("STD-66122519001", { firstNameTh: "ทดสอบ", lastNameTh: "ระบบ", profileCompleted: true });
  const after = await loginAccount("66122519001", "66122519001");
  check("after profile completion, setup no longer required", after.needsProfileSetup === false);

  // Tracks derive counts from bookings
  const sw = dbStore.getTracks().find((t) => t.id === "SW");
  check("track counts computed from bookings", sw.activeBookingsCount === dbStore.getQEBookings().filter((b) => b.trackId === "SW" && b.status !== "cancelled").length);

  console.log(failures === 0 ? "\n=== ALL PASSED ===" : `\n=== ${failures} FAILURE(S) ===`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
