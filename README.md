# Clinic Tracking Leads

ระบบภายในสำหรับ Care D Clinic เพื่อจัดการผู้ป่วย, เคส, งานติดตาม และนัดหมาย โดยใช้ Next.js และ Supabase เป็นแหล่งข้อมูลหลัก

## สิ่งที่ระบบทำได้

- เจ้าหน้าที่เข้าสู่ระบบด้วยอีเมลและรหัสผ่านจาก Supabase Auth
- สร้างผู้ป่วยและเคสใหม่ พร้อมแหล่งที่มาและแผนติดตาม
- บันทึกผลการติดตาม, ปิดงาน หรือสร้างงาน retry
- สร้างนัดหมายและดูข้อมูลผ่านปฏิทิน
- จำกัดข้อมูลตาม clinic และ role ด้วย Supabase RLS
- เก็บ audit trail สำหรับ workflow หลัก

Google Calendar ยังถูกปิดไว้โดยตั้งใจ (`CALENDAR_SYNC_ENABLED=false`) และไม่ต้องตั้งค่า OAuth เพื่อใช้งาน workflow หลัก

## ความต้องการ

- Node.js 24
- Yarn 1.x
- Supabase project สำหรับ development
- Supabase CLI (ติดตั้งผ่าน dependency ของโปรเจกต์แล้ว)

## เริ่มต้นใช้งาน

```bash
yarn install
cp .env.example .env
```

ตั้งค่าอย่างน้อยสองค่าใน `.env` จาก Supabase Dashboard → Project Settings → API:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ใน browser code หรือ commit secret ลง Git

## เชื่อมและเตรียมฐานข้อมูล development

เชื่อม CLI กับ Supabase dev project (ระบบจะขอ database password):

```bash
yarn db:link
```

ตรวจ migration ที่จะถูก apply ก่อน:

```bash
yarn db:push:dry
```

apply migration และ development seed:

```bash
yarn db:push:dev
```

Development seed สร้าง clinic, source, Standard follow-up plan และข้อมูลตัวอย่างผู้ป่วย/เคส/งานติดตาม/นัดหมายเท่านั้น ไม่สร้างบัญชีผู้ใช้หรือรหัสผ่าน

## สร้างบัญชี admin สำหรับ development

ระบบปิด public sign-up ผู้ดูแลต้องสร้างบัญชีด้วย Supabase Dashboard:

1. เปิด **Authentication → Users → Add user** แล้วสร้างผู้ใช้ด้วยอีเมลและรหัสผ่านสำหรับ dev
2. คัดลอก UUID จากคอลัมน์ `ID` ของผู้ใช้นั้น
3. เปิด SQL Editor ใน Supabase dev แล้วรัน SQL ด้านล่าง โดยแทน `ADMIN_USER_UUID` ด้วย UUID จริง

```sql
insert into public.clinic_memberships (clinic_id, user_id, role, display_name)
values (
  '11111111-1111-1111-1111-111111111111',
  'ADMIN_USER_UUID',
  'admin',
  'Development Admin'
)
on conflict (clinic_id, user_id)
do update set
  role = excluded.role,
  display_name = excluded.display_name,
  active = true;
```

รายละเอียดเพิ่มเติมอยู่ที่ [docs/DEV_AUTH_SETUP.md](docs/DEV_AUTH_SETUP.md)

## รันระบบ

```bash
yarn dev
```

เปิด [http://127.0.0.1:3001](http://127.0.0.1:3001) แล้วเข้าสู่ระบบด้วยบัญชีที่ provision แล้ว

## คำสั่งตรวจสอบ

```bash
yarn typecheck
yarn test
yarn lint
yarn db:status
```

`yarn lint` อาจรายงานปัญหาที่มีอยู่เดิมใน shared UI components; ตรวจเฉพาะไฟล์ที่แก้ใน pull request ด้วยก่อน merge

## โครงสร้างสำคัญ

```text
app/                    หน้าจอและ API routes
components/             UI และ workflow workspace
lib/auth/               clinic context และ role checks
lib/supabase/           browser/server Supabase clients
modules/                domain services และ read models
supabase/migrations/    schema, RLS และ atomic workflow RPCs
supabase/seed.sql       development-only fixtures
docs/                   requirements, architecture และคู่มือดำเนินงาน
```

ทุก browser request ผ่าน Next.js API route ก่อนเข้าสู่ domain service ข้อมูล tenant ต้องใช้ `clinic_id` และตรวจ `ClinicContext` เสมอ ห้ามให้ UI หรือ external provider เขียน business tables โดยตรง

## Workflow data

Mutation สำคัญทำผ่าน PostgreSQL RPC เพื่อให้ข้อมูลหลักและ audit/history อยู่ใน transaction เดียว:

- `create_case_workflow`: ผู้ป่วย, เคส, งานติดตามจากแผน, audit
- `record_follow_up_result_workflow`: ผลติดตาม, สถานะงาน/retry, audit
- `create_appointment_workflow`: นัดหมาย, สถานะเคส, notification, audit

เวลาเก็บเป็น UTC และแสดงใน `Asia/Bangkok`.

## Deployment

1. Apply และทดสอบ migration ใน Supabase dev ก่อนเสมอ
2. ตั้ง Vercel Preview environment ด้วย `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ของ dev project
3. ตรวจ login, สร้างเคส, บันทึกผลติดตาม, สร้างนัดหมาย และปฏิทิน
4. ผ่าน `typecheck` และ `test` ก่อน merge

ยังไม่ deploy production, ไม่เปิด Google sync และไม่ import ข้อมูลผู้ป่วยจริงจนกว่าจะมีการอนุมัติด้านข้อมูล/PDPA และแผน rollout แยกต่างหาก

## เอกสารอ้างอิง

- [Architecture](docs/ARCHITECTURE.md)
- [Requirements](docs/REQUIREMENTS.md)
- [Supabase environment](docs/ENVIRONMENT.md)
- [Development auth setup](docs/DEV_AUTH_SETUP.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN_NEXT_SUPABASE.md)
