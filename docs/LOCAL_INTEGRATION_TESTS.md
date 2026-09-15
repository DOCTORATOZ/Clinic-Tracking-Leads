# Local RLS/API integration tests

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

คำสั่งจะ start Supabase local, reset migrations/seed, provision identities สำหรับ
`clinic_admin`, `care_coordinator`, `nurse`, `viewer`, `system_admin` และรัน
authenticated API/browser tests ที่พอร์ต `3101` เพื่อแยกจาก `yarn dev` ปกติที่พอร์ต
`3001`. ใช้ใน CI ต่อจาก `yarn typecheck` และ `yarn test`.

ก่อนเริ่ม test script จะลบและ recreate เฉพาะ local Supabase volumes เพื่อให้ Auth
provider configuration จาก `supabase/config.toml` ถูกโหลดใหม่ทุกครั้ง.

Supabase local เปิด email/password provider สำหรับบัญชีที่ provisioning script สร้างไว้
แต่ `[auth].enable_signup` ยังคงเป็น `false`; จึงไม่เปิด public self-registration.

Analytics และ Vector Storage ถูกปิดสำหรับ local test stack เพราะระบบไม่ได้ใช้บริการ
ทั้งสองส่วน และช่วยลด container health failures บน Docker Desktop.

กรณี Docker ไม่พร้อม Supabase CLI จะหยุดก่อนทำงาน และไม่มีข้อมูล Supabase dev ได้รับผลกระทบ.

สคริปต์รองรับ Supabase CLI เวอร์ชันปัจจุบันและใช้ `supabase status -o env`
หลังเริ่ม local containers แล้ว จึงไม่ต้องส่ง flag `--local`.

## จัดการ Local Supabase

หลัง local stack ทำงาน เปิด Supabase Studio ได้ที่
[http://127.0.0.1:54323](http://127.0.0.1:54323).

- **Authentication → Users**: ดูหรือสร้างบัญชีทดสอบ
- **Table Editor**: ดู `clinics`, `clinic_memberships`, `system_administrators`
- **SQL Editor**: ตรวจหรือปรับ test fixture เฉพาะ local
- **Database → Policies**: ตรวจ RLS policies

Mailpit สำหรับดู email local/invitation อยู่ที่
[http://127.0.0.1:54324](http://127.0.0.1:54324).

`yarn test:integration` จะ reset local database แล้ว provision บัญชีเหล่านี้ใหม่ทุกครั้ง:

| Role | Email |
|---|---|
| Clinic Admin | `admin-a@integration.local` |
| Care Coordinator | `coordinator-a@integration.local` |
| Nurse | `nurse-a@integration.local` |
| Viewer | `viewer-a@integration.local` |
| System Admin | `system@integration.local` |

รหัสผ่านสำหรับบัญชี integration ทั้งหมดคือ `IntegrationPass123!` และใช้สำหรับ
local tests เท่านั้น ห้ามนำไปใช้กับ Supabase dev หรือ production.
