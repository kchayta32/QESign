// Institution-wide constants (single source of truth for names used across the UI)

export const UNIVERSITY_NAME_TH = "มหาวิทยาลัยราชภัฏสวนสุนันทา";
export const UNIVERSITY_NAME_EN = "Suan Sunandha Rajabhat University";
export const FACULTY_NAME_TH = "คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม";
export const FACULTY_NAME_EN = "Faculty of Engineering and Industrial Technology";
export const DEPARTMENT_CE_TH = "สาขาวิชาวิศวกรรมคอมพิวเตอร์";
export const DEPARTMENT_CE_SHORT_TH = "วิศวกรรมคอมพิวเตอร์";
export const FACULTY_PHONE = "02-160-1438";

export const EMAIL_DOMAIN = "ssru.ac.th";

/** University e-mail convention for students: s<studentCode>@ssru.ac.th */
export function studentEmailFromCode(studentCode: string): string {
  return `s${studentCode.trim()}@${EMAIL_DOMAIN}`;
}

/** Current Thai academic year (B.E.). Academic year starts in June. */
export function currentAcademicYearBE(now: Date = new Date()): number {
  const beYear = now.getFullYear() + 543;
  return now.getMonth() + 1 >= 6 ? beYear : beYear - 1;
}

/** Enrolment year (2-digit B.E.) is encoded in the first 2 digits of an SSRU student code. */
export function enrolmentYearFromCode(studentCode: string): number | null {
  const m = studentCode.trim().match(/^(\d{2})\d{9}$/);
  if (!m) return null;
  return 2500 + parseInt(m[1], 10);
}

/** Year level derived from the student code, clamped to a sane range. */
export function yearLevelFromCode(studentCode: string, now: Date = new Date()): number {
  const enrol = enrolmentYearFromCode(studentCode);
  if (!enrol) return 4;
  const level = currentAcademicYearBE(now) - enrol + 1;
  return Math.min(8, Math.max(1, level));
}

/** Admin account identity (password rule is the same as everyone else: default = code). */
export const ADMIN_ACCOUNT = {
  id: "ADMIN-01",
  code: "ceadmin",
  email: `ceadmin@${EMAIL_DOMAIN}`,
  displayName: `ผู้ดูแลระบบ ${DEPARTMENT_CE_TH}`,
} as const;
