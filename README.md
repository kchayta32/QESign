# ระบบจองสอบ QE และโครงงาน สาขาวิชาวิศวกรรมคอมพิวเตอร์ มรภ.สวนสุนันทา
## (SSRU CE Qualifying Examination & Project Booking System)

ระบบเว็บแอปพลิเคชันสำหรับการบริหารจัดการ จองรอบสอบวัดคุณสมบัติ (Qualifying Examination: QE), ติดตามความก้าวหน้าโครงงาน, บันทึกการเข้าพบอาจารย์ที่ปรึกษา (Advisor Meeting Logs), ตรวจสอบหลักฐานการตีพิมพ์/ประชุมวิชาการ (Conference Evidence) และระบบประเมินผลสอบด้วยเกณฑ์ 3 คณะกรรมการ (2/3 Pass Rule) พร้อม **Interactive 3-Condition Eligibility Gate** สำหรับปลดล็อกสิทธิ์สอบป้องกันโครงงานฉบับสมบูรณ์ (Final Project Defense)

---

## 🚀 เทคโนโลยีและสถาปัตยกรรม (Tech Stack)

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, TypeScript)
- **Styling & Design System**: [Tailwind CSS](https://tailwindcss.com/)
  - **SSRU Crimson (#A6192E)**, SSRU Red Dark (#7D1222), Clean White (#FFFFFF), Dark Neutral (#2C2C2C)
  - ฟอนต์มาตรฐาน: Sarabun & Kanit (ภาษาไทยระดับมืออาชีพ)
- **Animations & Micro-interactions**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Cloud**: [Firebase v10](https://firebase.google.com/) — **Realtime Database** (`/ssru_ce`, source of truth), Storage (รูปโปรไฟล์), Auth/Firestore (opportunistic mirror)
  - Firebase Project ID: `ce-room-da794`
  - Per-collection realtime listeners, id-keyed records, localStorage cache
- **Deployment**: [Vercel](https://vercel.com/) พร้อมไฟล์ `vercel.json` ปรับแต่งความปลอดภัยและ Caching

---

## 🏛️ โครงสร้างข้อมูลใน Realtime Database (`/ssru_ce/<collection>/<id>`)

1. **`students`**: บัญชีนักศึกษา (รหัส, ชื่อ, แทร็ก, อาจารย์ที่ปรึกษา, สถานะ 3 บท/QE, `profileCompleted`, `passwordHash`, `lastLoginAt`)
2. **`teachers`**: บัญชีอาจารย์ 8 ท่าน (รหัสอาจารย์ = ส่วนหน้า @ ของอีเมล, สาขาวิชา, เว็บไซต์, รูปโปรไฟล์, แทร็กที่เชี่ยวชาญ)
3. **`admins`**: บัญชีผู้ดูแลระบบ
4. **`qeBookings`**: การจองรอบสอบ QE (วันที่, ช่วงเวลา, ห้องสอบ, กรรมการ 3 ท่าน, สถานะ)
5. **`qeResults`**: คะแนนและมติของคณะกรรมการ 3 ท่าน (2/3 Rule)
6. **`advisorLogs`**: บันทึกการเข้าพบอาจารย์ที่ปรึกษา (สถานะ pending/approved/rejected)
7. **`conferenceEvidence`**: หลักฐานการเผยแพร่ผลงาน (ลิงก์เอกสาร, สถานะการรับรอง)

แทร็ก (HW/SW/NW/DB) และรอบสอบ นิยามไว้ในโค้ด (`src/lib/mock/seedData.ts`) โดยจำนวนที่นั่งที่ถูกจองคำนวณสดจาก `qeBookings` ส่วนสิทธิ์สอบ Final คำนวณจาก Rules Engine ทุกครั้งที่แสดงผล

---

## ⚖️ กฎทางธุรกิจและเงื่อนไขความถูกต้อง (Business Rules Engine)

### 1. เกณฑ์คุณสมบัติก่อนจองสอบ (Prerequisite Check)
- นักศึกษาต้องมีสถานะ `active` และผ่านการสอบหัวข้อและเค้าโครงโครงงาน 3 บท (`passed3Chapter === true`) จึงจะสามารถเปิดระบบจองรอบสอบ QE ได้

### 2. เกณฑ์การตัดสินผลสอบ QE ด้วยคณะกรรมการ 3 ท่าน (2/3 Committee Rule)
- จัดคณะกรรมการสอบประจำห้องจำนวน **3 ท่าน**
- นักศึกษาจะ **"ผ่านการสอบ (PASSED)"** ก็ต่อเมื่อ **ได้รับมติเสียงเห็นชอบ $\ge 2$ ใน 3 เสียง** (หรือคะแนนเฉลี่ย $\ge 60\%$)

### 3. ประตูตรวจสอบสิทธิ์สอบป้องกัน Final (3-Condition Eligibility Gate)
นักศึกษาจะได้รับการปลดล็อกสิทธิ์สอบป้องกันโครงงานฉบับสมบูรณ์ (Final Project Defense) ก็ต่อเมื่อผ่านเงื่อนไขครบทั้ง 3 ข้อพร้อมกัน (**Strict AND Logic**):
- **Condition 1**: บันทึกการเข้าพบอาจารย์ที่ปรึกษาที่ได้รับอนุมัติ $\ge 6$ ครั้ง
- **Condition 2**: ผ่านการสอบวัดคุณสมบัติ QE ด้วยมติกรรมการ $\ge 2/3$ เสียง
- **Condition 3**: มีเอกสารหลักฐานการนำเสนอบทความวิชาการ (Conference / Journal) ที่ได้รับการรับรองความถูกต้อง

---

## 🛠️ วิธีการติดตั้งและรันระบบ (Setup & Running)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่าตัวแปรสภาพแวดล้อม (Environment Variables)
คัดลอกไฟล์ `.env.example` เป็น `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCTzpSgjEdEze3I1Vmcbs7YSv22Z0OGLZM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ce-room-da794.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://ce-room-da794-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ce-room-da794
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ce-room-da794.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=342530054907
NEXT_PUBLIC_FIREBASE_APP_ID=1:342530054907:web:03d4b8b17644f2a5032e5e
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-NDNR437WE4
```

### 3. รันระบบในโหมดพัฒนา (Development Mode)
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

### 4. ตรวจสอบความถูกต้อง (Type-check & Tests)
```bash
npm run typecheck   # TypeScript
npm test            # Business rules + password hashing + account/login flow (ไม่แตะฐานข้อมูลจริง)
npm run build       # Production build
```

### 5. Seed / Migrate ฐานข้อมูล Firebase Realtime Database
```bash
npm run seed:firebase -- --dry-run   # ดูก่อนว่าจะเพิ่ม/แก้อะไร
npm run seed:firebase                # เพิ่มบัญชีที่ยังไม่มีในคลาวด์ (idempotent, ไม่ทับข้อมูลเดิม)
npm run probe:firebase               # ตรวจสอบสถานะ Firebase Auth / RTDB
```

---

## 🔐 บัญชีผู้ใช้งานและการเข้าสู่ระบบ (Accounts & Login)

บัญชีทั้งหมดถูก **ลงทะเบียนไว้ล่วงหน้า** (ไม่มีการสมัครสมาชิกเอง) และจัดเก็บใน Firebase Realtime Database (`/ssru_ce`)

| ประเภท | ชื่อผู้ใช้ (ใช้ได้ทั้ง 2 แบบ) | รหัสผ่านเริ่มต้น | ตัวอย่าง |
|---|---|---|---|
| นักศึกษา | รหัสนักศึกษา หรือ `s<รหัส>@ssru.ac.th` | รหัสนักศึกษา | `66122519001` / `66122519001` |
| อาจารย์ | รหัสอาจารย์ (ส่วนหน้า `@` ของอีเมล) หรือ อีเมล | รหัสอาจารย์ | `parinwat.th@ssru.ac.th` / `parinwat.th` |
| ผู้ดูแลระบบ | `ceadmin` หรือ `ceadmin@ssru.ac.th` | `ceadmin` | — |

- **นักศึกษาที่ลงทะเบียนไว้ (495 คน)**: `65122519001–075`, `66122519001–095`, `67122519001–088`, `68122519001–105`, `69122519001–132`
- **อาจารย์ (8 ท่าน)**: `kwanruan.ru`, `pornpawit.bo`, `ravi.ut`, `kant.ch` (วิศวกรรมคอมพิวเตอร์) • `sethakarn.pr`, `taksaorn.ak` (วิศวกรรมหุ่นยนต์) • `parinwat.th`, `pongrapee.ka` (การจัดการวิศวกรรม)
- **เข้าใช้งานครั้งแรก**: ระบบบังคับให้กรอกข้อมูลโปรไฟล์ (ชื่อ-สกุล, โทรศัพท์, แทร็ก, อาจารย์ที่ปรึกษา, รูปโปรไฟล์ ฯลฯ) และแนะนำให้ตั้งรหัสผ่านใหม่ก่อนใช้งาน
- **เปลี่ยนรหัสผ่าน**: เมนูบัญชี → เปลี่ยนรหัสผ่าน (รหัสผ่านใหม่จัดเก็บเป็น PBKDF2-SHA256 hash ในบัญชีผู้ใช้บน RTDB) • ผู้ดูแลระบบสามารถ **รีเซ็ตกลับเป็นค่าเริ่มต้น** ได้จากตารางบัญชีผู้ใช้งาน
- **Firebase Authentication**: ระบบจะสร้าง/ล็อกอินบัญชี Firebase Auth ให้อัตโนมัติ *เมื่อเปิดใช้ Email/Password provider* ในโปรเจกต์ `ce-room-da794` (ปัจจุบันยังไม่ได้เปิด — ระบบทำงานได้ด้วยข้อมูลบัญชีบน RTDB ทั้งหมด)

### ขั้นตอนการใช้งานสำหรับนักศึกษาใหม่
1. ล็อกอินด้วยรหัสนักศึกษา → กรอกโปรไฟล์ + เลือกอาจารย์ที่ปรึกษา
2. อาจารย์ที่ปรึกษากด **"ยืนยันผ่าน 3 บท"** ในตารางนักศึกษาในความดูแล (เปิดสิทธิ์จอง QE)
3. นักศึกษาจองรอบสอบ QE → กรรมการ 3 ท่านประเมิน (มติ 2/3)
4. บันทึกการเข้าพบที่ปรึกษา ≥ 6 ครั้ง (อนุมัติแล้ว) + ส่งลิงก์หลักฐาน Conference ให้อาจารย์รับรอง
5. ครบ 3/3 → พิมพ์หนังสือรับรองสิทธิ์สอบ Final Defense

### ข้อมูลตัวอย่าง (Demo data)
นักศึกษาตัวอย่าง 4 คน (`64122010023`, `64122010045`, `64122010088`, `65122010102`) พร้อมการจอง/ผลสอบ/บันทึกตัวอย่าง จะถูก seed ไว้เพื่อสาธิตระบบ ตั้งค่า `NEXT_PUBLIC_INCLUDE_DEMO_DATA=false` เพื่อปิด (บัญชีที่มีอยู่ในคลาวด์แล้วจะไม่ถูกลบ)

---

## ☁️ Deployment
- **Production**: https://qe-sign.vercel.app (Vercel project `qe-sign`, deploy ด้วย `vercel --prod`)
- **Repository**: https://gitlab.com/kitti-group1/qe-ce-ssru
- Realtime Database rules ที่แนะนำอยู่ใน `database.rules.json` (ปัจจุบันเปิด read/write สำหรับ `/ssru_ce` เนื่องจากยังไม่ได้เปิด Firebase Auth; ควรเพิ่มเงื่อนไข `auth != null` เมื่อเปิดใช้ Auth แล้ว)

---

## 📄 ลิขสิทธิ์และผู้พัฒนา
สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏสวนสุนันทา