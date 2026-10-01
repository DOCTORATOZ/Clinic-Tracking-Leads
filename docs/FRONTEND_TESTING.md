# ทดลอง frontend — local sandbox

อัปเดต 1 ตุลาคม 2026 · เป็นชุดทดสอบ ไม่ใช่ production และยังไม่ผ่าน requirement ทั้งหมด

## เปิดใช้งาน

เปิด [หน้าเข้าสู่ระบบ](http://127.0.0.1:3102/login) บนเครื่องนี้
หากเซิร์ฟเวอร์ปิด ให้เปิด Docker Desktop แล้วรันจาก root repository:

```sh
yarn dev:sandbox
```

คำสั่งนี้เปิด Next ที่ 3102 ใช้ build directory `.next-sandbox` และ Supabase project `clinic_contract_workflow` ที่ API 55321 / DB 55322
ไม่แก้ `.env` ไม่ reset ฐาน ไม่หยุดเว็บเดิมที่ 3001 และไม่เชื่อมฐาน Care D 54321
ใช้ migrations และเติมเฉพาะ fixture ที่ยังไม่มีใน test project เท่านั้น; ข้อมูลทดลองที่เคยบันทึกยังอยู่
Google sync ถูกบังคับปิดใน sandbox

เว็บนี้แชร์ชุดข้อมูลกับ integration tests: อย่ารัน `yarn test:integration` พร้อมกับการทดลองด้วยมือ เพราะ tests เพิ่มข้อมูลจำลองได้ แม้ไม่ล้างข้อมูล
ใช้ `127.0.0.1` ตามลิงก์ ไม่สลับเป็น localhost ระหว่าง login; กดออกจากระบบก่อนเปลี่ยนบัญชี

## บัญชีทดสอบ

รหัสผ่านทุกบัญชีด้านล่าง: `IntegrationPass123!` — ใช้เฉพาะ local เท่านั้น

| Role | Email | เริ่มทดลอง |
|---|---|---|
| Clinic Admin | `admin-a@integration.local` | Workflow และ `/admin` |
| Care Coordinator | `coordinator-a@integration.local` | รับลีด/ประสานงาน/นัดหมาย |
| Nurse | `nurse-a@integration.local` | เคสและงานที่มอบหมายให้ Nurse A |
| Viewer | `viewer-a@integration.local` | อ่านข้อมูล ไม่มีปุ่มเพิ่มลีด |
| System Admin | `system@integration.local` | redirect ไป `/system`; ไม่มีข้อมูลคลินิก |

## ลำดับลองใช้งาน

1. ใช้ Coordinator → เพิ่มลีด / สร้างเคส → ลองกดถัดไปโดยไม่กรอก ต้องมีข้อความผิดพลาด
2. ใช้ชื่อทดสอบที่ไม่ซ้ำ พร้อม social หรือโทรศัพท์; เลือกบันทึกลีดอย่างเดียวพร้อมวันติดต่อ หรือทำต่อสามขั้นเพื่อเปิดเคส
3. หากต้องการทดลองการติดตาม ให้ระบุสิทธิ์ติดต่อที่ยืนยันแล้วสำหรับบุคคลจำลอง และมอบหมาย Nurse A; การเลือกแผนอย่างเดียวยังไม่สร้างงาน
4. ในรายละเอียดเคส ยืนยันวันเริ่มแผนตามเหตุการณ์จำลอง พร้อม Nurse ผู้ยืนยัน → ดูงานที่เกิดขึ้น → บันทึกผลและนัดหมาย
5. สลับ Nurse เพื่อลองงานที่ได้รับมอบหมาย; สลับ Viewer เพื่อตรวจไม่มีปุ่มแก้ไข
6. ใช้ Admin → จัดการคลินิก → ตรวจ Users, Clinic config, Sources, Services, Follow-up plans, Tools และ Audit
7. ดูปฏิทิน/ภาพรวม และลองย่อหน้าจอมือถือ; บันทึกภาพและขั้นตอนหากพบปัญหา

การเพิ่มนัดจากรายการนัดกับจากรายละเอียดเคสยังเป็นคนละฟอร์มและยังรอรวม flow; เริ่มทดสอบ flow หลักจากรายละเอียดเคสก่อน ไม่ถือว่าฟอร์มทั้งสองผ่าน parity แล้ว
ไม่ใช้ผู้ป่วยจริง ไม่กรอกข้อมูลสุขภาพจริง; เลี่ยงปิดบัญชี fixture/ระงับ clinic ทดสอบระหว่างทดลอง เพราะ runner จะไม่เปิดสิทธิ์กลับให้อัตโนมัติ

## ผลตรวจล่าสุดและข้อจำกัด

- Login + role boundary + ไม่มี page error ผ่านทั้ง 5 roles บนพอร์ต 3102
- หน้า `/admin` โหลด memberships/config ได้; modal เพิ่มลีดแสดงตรงกลางและมีสามขั้น
- ตรวจ unit tests 33 ข้อ, harness 4 ข้อ และ typecheck ผ่านก่อนส่ง frontend รอบนี้
- Smoke รอบนี้ไม่ได้เขียนข้อมูลคลินิก และไม่ใช่การรับรอง CRUD ทุก resource; lint/flow ที่ซ้ำ/admin lifecycle/full visual QA ยังเป็นงานค้าง
- หน้า Care D Clinic · One Day Surgery (test) ใน sandbox เป็น fixture เดิม ไม่ใช่ฐาน Care D ที่เว็บ 3001 ใช้อยู่

ส่ง feedback พร้อม role, หน้า, ขั้นตอน, ผลที่คาดหวัง, ผลจริง และภาพหน้าจอ โดยใช้ข้อมูลจำลองเท่านั้น
