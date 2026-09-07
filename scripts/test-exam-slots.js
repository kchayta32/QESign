// Verification script for Teacher Exam Slot Management & Student Booking
// Runs against real TypeScript store & rules engine:
// Usage: node -r ./scripts/register-ts.js scripts/test-exam-slots.js
process.env.SSRU_DISABLE_CLOUD = "1";
const { dbStore } = require("../src/lib/firebase/db.ts");

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${extra ? " -> " + extra : ""}`);
  if (!ok) failures++;
};

(async () => {
  console.log("=== [START] Teacher Exam Slots & Student Booking Verification ===");

  const teacherA = dbStore.getTeacherById("kant.ch");
  const teacherB = dbStore.getTeacherById("ravi.ut");
  check("Seed teachers available", !!teacherA && !!teacherB, `A: ${teacherA?.id}, B: ${teacherB?.id}`);

  // Setup test students:
  // Student 1: Unprepared student (has NOT passed 3 chapters)
  const studentUnready = dbStore.updateStudentProfile("STD-66122519010", {
    prefixTh: "นาย",
    firstNameTh: "ยังไม่ผ่าน",
    lastNameTh: "สามบท",
    advisorId: teacherA.id,
    profileCompleted: true,
    status: "active",
    trackId: "SW",
    passed3Chapter: false,
    passedQE: false,
  });

  // Student 2: Fully eligible student (PASSED 3 chapters, awaiting QE)
  const studentReady = dbStore.updateStudentProfile("STD-66122519020", {
    prefixTh: "นาย",
    firstNameTh: "สมชาย",
    lastNameTh: "พร้อมสอบ",
    advisorId: teacherA.id,
    profileCompleted: true,
    status: "active",
    trackId: "HW",
    passed3Chapter: true,
    passedQE: false,
  });

  check("Setup unready student (passed3Chapter: false)", !!studentUnready && !studentUnready.passed3Chapter);
  check("Setup ready student (passed3Chapter: true)", !!studentReady && !!studentReady.passed3Chapter);

  // 1. Teacher creates QE Exam Slots with HW, SW, DB choices and location textbox
  console.log("\n--- Test 1: Teacher creates QE Exam Slots (HW / SW / DB) ---");
  const qeSlotHW = await dbStore.createExamSlot({
    teacherId: teacherA.id,
    teacherName: `${teacherA.prefixTh}${teacherA.firstNameTh} ${teacherA.lastNameTh}`,
    category: "QE",
    qeType: "HW",
    examDate: "2026-10-15",
    timeSlot: "09:00 - 10:30",
    location: "ห้องปฏิบัติการคอมพิวเตอร์และฮาร์ดแวร์ 4731 ชั้น 3",
    notes: "การสอบวัดคุณสมบัติเฉพาะทางฮาร์ดแวร์",
  });

  check("QE HW Slot created with ID", !!qeSlotHW.id && qeSlotHW.id.startsWith("SLOT-"), qeSlotHW.id);
  check("QE HW Category & Type", qeSlotHW.category === "QE" && qeSlotHW.qeType === "HW");
  check("QE HW Location Textbox saved", qeSlotHW.location === "ห้องปฏิบัติการคอมพิวเตอร์และฮาร์ดแวร์ 4731 ชั้น 3");
  check("QE HW Status is open", qeSlotHW.status === "open");

  const qeSlotSW = await dbStore.createExamSlot({
    teacherId: teacherA.id,
    teacherName: `${teacherA.prefixTh}${teacherA.firstNameTh} ${teacherA.lastNameTh}`,
    category: "QE",
    qeType: "SW",
    examDate: "2026-10-15",
    timeSlot: "10:45 - 12:15",
    location: "ห้องปฏิบัติการซอฟต์แวร์ 4742 ชั้น 4",
    notes: "การสอบวัดคุณสมบัติเฉพาะทางซอฟต์แวร์",
  });
  check("QE SW Slot created", qeSlotSW.qeType === "SW" && qeSlotSW.category === "QE");

  const qeSlotDB = await dbStore.createExamSlot({
    teacherId: teacherB.id,
    teacherName: `${teacherB.prefixTh}${teacherB.firstNameTh} ${teacherB.lastNameTh}`,
    category: "QE",
    qeType: "DB",
    examDate: "2026-10-16",
    timeSlot: "13:30 - 15:00",
    location: "ห้อง Smart Classroom 4725",
    notes: "การสอบวัดคุณสมบัติเฉพาะทางระบบฐานข้อมูล",
  });
  check("QE DB Slot created by Teacher B", qeSlotDB.qeType === "DB" && qeSlotDB.teacherId === teacherB.id);

  // 2. Teacher creates Project Exam Slots (Proposal / 3 บท / 5 บท)
  console.log("\n--- Test 2: Teacher creates Project Exam Slots ---");
  const projSlotProp = await dbStore.createExamSlot({
    teacherId: teacherA.id,
    teacherName: `${teacherA.prefixTh}${teacherA.firstNameTh} ${teacherA.lastNameTh}`,
    category: "PROJECT",
    projectStage: "Proposal",
    examDate: "2026-10-20",
    timeSlot: "09:00 - 10:30",
    location: "ห้องประชุมภาควิชาวิศวกรรมคอมพิวเตอร์ 4711",
  });
  check("Project Proposal slot created", projSlotProp.category === "PROJECT" && projSlotProp.projectStage === "Proposal");

  const projSlotCh5 = await dbStore.createExamSlot({
    teacherId: teacherB.id,
    teacherName: `${teacherB.prefixTh}${teacherB.firstNameTh} ${teacherB.lastNameTh}`,
    category: "PROJECT",
    projectStage: "สอบ 5 บท",
    examDate: "2026-10-22",
    timeSlot: "13:30 - 15:00",
    location: "ห้อง 4735 อาคาร 47",
  });
  check("Project 5 Chapters slot created", projSlotCh5.category === "PROJECT" && projSlotCh5.projectStage === "สอบ 5 บท");

  // 3. Querying slots
  console.log("\n--- Test 3: Querying Slots ---");
  const allSlots = dbStore.getExamSlots();
  check("getExamSlots returns created slots", allSlots.length >= 5, `Total slots: ${allSlots.length}`);

  const openSlots = dbStore.getOpenExamSlots();
  check("getOpenExamSlots returns all active open slots", openSlots.every((s) => s.status === "open"));

  const teacherASlots = dbStore.getExamSlotsByTeacher(teacherA.id);
  check("getExamSlotsByTeacher filters correctly", teacherASlots.every((s) => s.teacherId === teacherA.id));

  // 4. Student Booking Prerequisite Enforcement
  console.log("\n--- Test 4: Prerequisite & Booking Tests ---");

  // A. Student who has NOT passed 3 chapters tries to book QE slot -> MUST FAIL
  let unreadyBookingFailed = false;
  let unreadyErrorMsg = "";
  try {
    await dbStore.bookExamSlot(qeSlotSW.id, studentUnready);
  } catch (err) {
    unreadyBookingFailed = true;
    unreadyErrorMsg = err.message;
  }
  check("Unready student booking QE slot blocked by 3-chapter rule", unreadyBookingFailed, unreadyErrorMsg);

  // B. Student books Project slot -> SUCCEEDS
  const projectRes = await dbStore.bookExamSlot(projSlotProp.id, studentReady, "นักศึกษาขอนำเสนอข้อเสนอโครงงาน");
  const bookedProject = projectRes.slot;
  check("Student books Project slot", bookedProject.status === "booked" && bookedProject.bookedStudentId === studentReady.id);
  check("Slot details updated with student info", bookedProject.bookedStudentCode === studentReady.studentCode);

  // C. Double booking an already-booked slot must fail
  let doubleBookFailed = false;
  try {
    await dbStore.bookExamSlot(projSlotProp.id, studentReady);
  } catch (err) {
    doubleBookFailed = true;
  }
  check("Double booking already-booked slot rejected", doubleBookFailed);

  // D. Fully eligible student books QE slot -> SUCCEEDS
  const qeRes = await dbStore.bookExamSlot(qeSlotHW.id, studentReady, "ขอสอบวัดคุณสมบัติรอบเช้า");
  const bookedQE = qeRes.slot;
  check("Student books QE slot successfully", bookedQE.status === "booked" && bookedQE.bookedStudentId === studentReady.id);

  // E. Verify that booking QE slot automatically created a corresponding QEBooking record with 3 examiners
  const studentQEBookings = dbStore.getQEBookingsByStudent(studentReady.id);
  const createdQEBooking = studentQEBookings.find((b) => b.examDate === qeSlotHW.examDate && b.timeSlot === qeSlotHW.timeSlot);
  check(
    "QE booking record automatically created with 3 examiners",
    !!createdQEBooking && createdQEBooking.examinerIds.length === 3,
    `Examiners: ${createdQEBooking?.examinerNames.join(", ")}`
  );

  // 5. Cancelling Slot
  console.log("\n--- Test 5: Cancelling Slot ---");
  await dbStore.cancelExamSlot(qeSlotDB.id, teacherB.id);
  const cancelledSlot = dbStore.getExamSlotById(qeSlotDB.id);
  check("Teacher cancels slot", !!cancelledSlot && cancelledSlot.status === "cancelled");

  const openAfterCancel = dbStore.getOpenExamSlots();
  check("Cancelled slot not in open list", !openAfterCancel.some((s) => s.id === qeSlotDB.id));

  console.log(`\n=== Verification Complete: ${failures} failure(s) ===\n`);
  process.exit(failures > 0 ? 1 : 0);
})();
