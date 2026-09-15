# เพิ่ม System Admin ด้วย CLI

คำสั่งนี้ใช้เพิ่มหรือเปิดใช้งาน `system_admin` ที่ระดับ platform โดยตรง
จึงไม่สร้าง `clinic_memberships` และไม่ทำให้บัญชีเห็นข้อมูลผู้ป่วยโดยอัตโนมัติ

## เตรียมค่าในเครื่อง

เพิ่มค่าต่อไปนี้ใน `.env` **บนเครื่องผู้ดูแลเท่านั้น** และห้าม commit ไฟล์หรือ
นำค่าไปใส่ Vercel Preview:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

สร้างผู้ใช้ก่อนที่ Supabase Dashboard: **Authentication → Users → Add user**

## เพิ่มหรือเปิดใช้ System Admin

ค้นหาผู้ใช้จากอีเมล:

```bash
yarn system-admin:grant -- --email platform-admin@example.com --confirm
```

หรือระบุ UUID ของ Supabase Auth โดยตรง:

```bash
yarn system-admin:grant -- --user-id 11111111-1111-4111-8111-111111111111 --confirm
```

ถ้าต้องการบันทึกว่าผู้ใดทำรายการ ให้ส่ง UUID ของผู้ดูแลที่ดำเนินการ:

```bash
yarn system-admin:grant -- --email platform-admin@example.com --actor-user-id 22222222-2222-4222-8222-222222222222 --confirm
```

คำสั่งต้องมี `--confirm` เสมอ และจะหยุดหากไม่พบ Auth user, UUID ไม่ถูกต้อง
หรือไม่มี service-role key ใน environment.

หากขึ้น `permission denied for table system_administrators` ให้ apply migration
ล่าสุดกับ Supabase dev ก่อน:

```bash
yarn supabase db push --linked
```

หลังดำเนินการ ให้ผู้ใช้ sign out/sign in ใหม่ แล้วเข้า `/system`.

## ระงับสิทธิ์

การระงับยังทำผ่าน Supabase SQL Editor โดยผู้ดูแล platform ที่ได้รับอนุมัติ:

```sql
update public.system_administrators
set active = false,
    revoked_at = now(),
    revocation_reason = 'เหตุผลการระงับ'
where user_id = 'AUTH_USER_UUID'::uuid;
```

ไม่ควรลบ record เพราะควรเก็บประวัติการกำหนดสิทธิ์ไว้.
