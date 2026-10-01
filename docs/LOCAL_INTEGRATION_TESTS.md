# Local RLS/API integration tests

> อัปเดต 1 ตุลาคม 2026: ใช้ test project แยก ไม่ reset/recreate volumes ของ Care D ตามสคริปต์รุ่นเก่า หากต้องการทดลองหน้าจอด้วยมือ ดู [FRONTEND_TESTING.md](FRONTEND_TESTING.md)

ชุดทดสอบนี้ใช้ Supabase local และ Playwright เท่านั้น ไม่มีการเชื่อมต่อหรือแก้ไข
Supabase dev project.

## Prerequisites

- Docker Desktop ต้องเปิดอยู่
- ติดตั้ง Chromium สำหรับ Playwright หนึ่งครั้ง:

```bash
yarn playwright install chromium
```

## Run

```bash
yarn test:integration
```

คำสั่งจะ start Supabase test project `clinic_contract_workflow`, apply migrations โดยไม่ reset/seed และเติมเฉพาะ identities ที่ยังไม่มีสำหรับ
`clinic_admin`, `care_coordinator`, `nurse`, `viewer`, `system_admin` และรัน
authenticated API/browser tests ที่พอร์ต `3101` เพื่อแยกจาก `yarn dev` ปกติที่พอร์ต
`3001`. ใช้ใน CI ต่อจาก `yarn typecheck` และ `yarn test`.

ใช้ `supabase-test/config.toml` ที่ API 55321 / DB 55322 และ `.next-contract` แยกจาก dev server ไม่มีการลบ/recreate volumes หรือหยุด Care D อัตโนมัติ

Supabase local เปิด email/password provider สำหรับบัญชีที่ provisioning script สร้างไว้
แต่ `[auth].enable_signup` ยังคงเป็น `false`; จึงไม่เปิด public self-registration.

Analytics และ Vector Storage ถูกปิดสำหรับ local test stack เพราะระบบไม่ได้ใช้บริการ
ทั้งสองส่วน และช่วยลด container health failures บน Docker Desktop.

กรณี Docker ไม่พร้อม Supabase CLI จะหยุดก่อนทำงาน และไม่มีข้อมูล Supabase dev ได้รับผลกระทบ.

สคริปต์รองรับ Supabase CLI เวอร์ชันปัจจุบันและอ่าน `supabase status -o json` เป็นข้อมูล ไม่ใช้ eval
หลังเริ่ม local containers แล้ว จึงไม่ต้องส่ง flag `--local`.

## จัดการ Local Supabase

Studio ที่ [http://127.0.0.1:54323](http://127.0.0.1:54323) เป็นของ **Care D local หลัก ไม่ใช่ test project**; test project ปิด Studio อยู่ ห้ามใช้ Studio นี้ reset/seed เพื่อแก้ผล test

- **Authentication → Users**: ดูหรือสร้างบัญชีทดสอบ
- **Table Editor**: ดู `clinics`, `clinic_memberships`, `system_administrators`
- **SQL Editor**: ตรวจหรือปรับ test fixture เฉพาะ local
- **Database → Policies**: ตรวจ RLS policies

Mailpit สำหรับดู email local/invitation อยู่ที่
[http://127.0.0.1:55324](http://127.0.0.1:55324) สำหรับ test project (54324 เป็น Care D หลัก).

`yarn test:integration` จะเติมบัญชีที่ยังไม่มี ไม่ reset รหัสผ่าน/role/สถานะของบัญชีที่มีอยู่แล้ว:

| Role | Email |
|---|---|
| Clinic Admin | `admin-a@integration.local` |
| Care Coordinator | `coordinator-a@integration.local` |
| Nurse | `nurse-a@integration.local` |
| Viewer | `viewer-a@integration.local` |
| System Admin | `system@integration.local` |

รหัสผ่านสำหรับบัญชี integration ทั้งหมดคือ `IntegrationPass123!` และใช้สำหรับ
local tests เท่านั้น ห้ามนำไปใช้กับ Supabase dev หรือ production.
