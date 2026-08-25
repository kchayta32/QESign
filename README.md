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
- **Backend & Cloud**: [Firebase v10](https://firebase.google.com/) (Auth, Firestore, Storage)
  - Firebase Project ID: `ce-room-da794`
  - Realtime Sync & In-Memory / Local Storage Fallback Cache
- **Deployment**: [Vercel](https://vercel.com/) พร้อมไฟล์ `vercel.json` ปรับแต่งความปลอดภัยและ Caching

---

## 🏛️ สถาปัตยกรรมฐานข้อมูลและคอลเลกชัน (Firestore ER Schema)

1. **`users`**: ข้อมูลบัญชีผู้ใช้ (นักศึกษา, อาจารย์, ผู้ดูแลระบบ)
2. **`students`**: ข้อมูลนักศึกษา, แทร็กความเชี่ยวชาญ, อาจารย์ที่ปรึกษา, สถานะการสอบ
3. **`teachers`**: ข้อมูลอาจารย์ประจำสาขา, ความเชี่ยวชาญ, บทบาทกรรมการ
4. **`tracks`**: 4 แทร็กหลัก (HW, SW, NW, DB) พร้อมโควตาและจำนวนจองแบบเรียลไทม์
5. **`qe_bookings`**: ข้อมูลการจองรอบสอบ QE, วันที่, ช่วงเวลา (Time Slot), ห้องสอบ, รายชื่อกรรมการ 3 ท่าน
6. **`qe_results`**: ตารางคะแนนและมติของคณะกรรมการ 3 ท่าน (3-Examiner Matrix)
7. **`advisor_meeting_logs`**: บันทึกการเข้าพบอาจารย์ที่ปรึกษา (บันทึกรายสัปดาห์, ความก้าวหน้า %, การอนุมัติ)
8. **`conference_evidence`**: หลักฐานการส่ง/นำเสนอบทความวิชาการ (Acceptance Letter, Proceedings)
9. **`final_exam_eligibility`**: ผลการประเมินสิทธิ์สอบ Final ผ่านเงื่อนไข 3 ข้อ (3-Condition Gate)

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

### 4. ทดสอบความถูกต้องของ Business Rules Engine
```bash
node scripts/test-rules.js
```

---

## 🎮 การทดสอบ Role & Mock Profiles

ระบบมาพร้อมกับ Role Switcher ที่แถบเมนูด้านบน เพื่อให้ทดสอบ Use-case ต่างๆ ได้ทันที:
1. **👨‍🎓 นักศึกษา (Student View)**:
   - `STD-01: นายธนากร สุขเจริญ` -> **ปลดล็อกสิทธิ์ Final 3/3 ผ่านครบถ้วน** (พร้อมพิมพ์ใบรับรองทางการ)
   - `STD-02: นางสาวกานดา รัตนกุล` -> **สอบ QE ผ่าน 2/3, บันทึกพบที่ปรึกษา 4/6 ครั้ง** (รอดำเนินการ)
   - `STD-03: นายปิติพัฒน์ แสนดี` -> **รอเข้าสอบ QE และรอกรรมการประเมินผล**
   - `STD-04: นายธาวิน วงศ์สุวรรณ` -> **ยังไม่ผ่าน 3 บท (Prerequisite Blocked)**
2. **👨‍🏫 อาจารย์ / กรรมการ (Teacher View)**:
   - เปิดตารางประเมินผลสอบ 3 กรรมการ (`TeacherEvaluationSheet`) พร้อมคำนวณมติ 2/3 สดแบบเรียลไทม์
   - อนุมัติ/ปฏิเสธ บันทึกการเข้าพบอาจารย์ที่ปรึกษา (Advisor Logs) ได้ใน 1 คลิก
   - ตรวจรับรองเอกสารงานประชุมวิชาการ (Conference Evidence Verification)
3. **🛠️ ผู้ดูแลระบบ (Admin View)**:
   - ดูสถิติภาพรวม, โควตา 4 แทร็ก (HW, SW, NW, DB), รอบการสอบ และส่งออกรายงาน

---

## 📄 ลิขสิทธิ์และผู้พัฒนา
สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏสวนสุนันทา
