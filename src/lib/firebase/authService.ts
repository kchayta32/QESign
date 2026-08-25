import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";
import { dbStore } from "./db";
import { Student, UserProfile, TrackType } from "@/types";

export interface StudentRegistrationData {
  studentCode: string;
  prefixTh: string;
  firstNameTh: string;
  lastNameTh: string;
  prefixEn?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  email: string;
  password: string;
  phone: string;
  trackId: TrackType;
  yearLevel: number;
  advisorId: string;
  coAdvisorId?: string;
  projectTitleTh?: string;
  projectTitleEn?: string;
  avatarUrl?: string;
}

/**
 * Register a new student with Firebase Auth and save profile in Firestore & DB store
 */
export async function registerStudentAccount(
  data: StudentRegistrationData
): Promise<{ success: boolean; student?: Student; error?: string }> {
  try {
    const email = data.email.includes("@")
      ? data.email
      : `s${data.studentCode}@ssru.ac.th`;

    let firebaseUid = `std_${data.studentCode}_${Date.now().toString().slice(-4)}`;

    // Try creating account in Firebase Auth
    try {
      if (auth) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          data.password
        );
        firebaseUid = userCredential.user.uid;

        // Update Firebase Auth profile display name and photo
        await updateProfile(userCredential.user, {
          displayName: `${data.prefixTh} ${data.firstNameTh} ${data.lastNameTh}`,
          photoURL: data.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        });
      }
    } catch (authErr: any) {
      console.warn("Firebase Auth notice (using fallback local profile):", authErr?.message);
    }

    const defaultAvatar = data.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";

    const newStudent: Student = {
      id: `STD-${data.studentCode}`,
      uid: firebaseUid,
      studentCode: data.studentCode,
      prefixTh: data.prefixTh,
      firstNameTh: data.firstNameTh,
      lastNameTh: data.lastNameTh,
      prefixEn: data.prefixEn || "Mr.",
      firstNameEn: data.firstNameEn || data.firstNameTh,
      lastNameEn: data.lastNameEn || data.lastNameTh,
      email: email,
      phone: data.phone || "080-000-0000",
      trackId: data.trackId,
      yearLevel: data.yearLevel || 4,
      status: "active",
      advisorId: data.advisorId || "T-101",
      coAdvisorId: data.coAdvisorId,
      projectTitleTh: data.projectTitleTh || "โครงงานวิศวกรรมคอมพิวเตอร์",
      projectTitleEn: data.projectTitleEn || "Computer Engineering Project",
      passed3Chapter: true, // Default active student ready for QE
      passedQE: false,
      finalEligible: false,
      avatarUrl: defaultAvatar,
    };

    // Save to DB store (LocalStorage + Realtime State)
    dbStore.registerNewStudent(newStudent);

    // Save to Firestore if available
    try {
      if (db) {
        const studentDocRef = doc(db, "students", newStudent.id);
        await setDoc(studentDocRef, newStudent, { merge: true });

        const userDocRef = doc(db, "users", firebaseUid);
        const userProfile: UserProfile = {
          uid: firebaseUid,
          email: email,
          displayName: `${data.prefixTh} ${data.firstNameTh} ${data.lastNameTh}`,
          role: "student",
          studentId: data.studentCode,
          phone: data.phone,
          department: "สาขาวิชาวิศวกรรมคอมพิวเตอร์",
          photoURL: defaultAvatar,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, userProfile, { merge: true });
      }
    } catch (firestoreErr) {
      console.warn("Firestore write notice:", firestoreErr);
    }

    return { success: true, student: newStudent };
  } catch (err: any) {
    console.error("Registration error:", err);
    return {
      success: false,
      error: err.message || "เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง",
    };
  }
}

/**
 * Login with Email/StudentCode and Password
 */
export async function loginAccount(
  identifier: string,
  password: string
): Promise<{ success: boolean; role?: "student" | "teacher" | "admin"; entityId?: string; error?: string }> {
  try {
    const isEmail = identifier.includes("@");
    const email = isEmail ? identifier : `s${identifier}@ssru.ac.th`;

    // Check existing students in DB store
    const students = dbStore.getStudents();
    const matchedStudent = students.find(
      (s) =>
        s.studentCode === identifier ||
        s.email.toLowerCase() === identifier.toLowerCase() ||
        s.email.toLowerCase() === email.toLowerCase()
    );

    if (matchedStudent) {
      // Try Firebase Auth login if possible
      try {
        if (auth) {
          await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (authError) {
        console.warn("Firebase Auth login notice:", authError);
      }
      return { success: true, role: "student", entityId: matchedStudent.id };
    }

    // Check existing teachers in DB store
    const teachers = dbStore.getTeachers();
    const matchedTeacher = teachers.find(
      (t) =>
        t.teacherCode === identifier ||
        t.email.toLowerCase() === identifier.toLowerCase()
    );

    if (matchedTeacher) {
      return { success: true, role: "teacher", entityId: matchedTeacher.id };
    }

    // Admin login shortcut
    if (identifier.toLowerCase() === "admin" || identifier.toLowerCase() === "admin@ssru.ac.th") {
      return { success: true, role: "admin", entityId: "ADMIN-01" };
    }

    // If not found in mock/store, try Firebase Auth
    if (auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, role: "student", entityId: userCredential.user.uid };
    }

    return {
      success: false,
      error: "ไม่พบบัญชีผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูล",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
    };
  }
}

/**
 * Logout current account
 */
export async function logoutAccount(): Promise<void> {
  try {
    if (auth) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn("Logout notice:", e);
  }
}
