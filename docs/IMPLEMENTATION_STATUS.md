# สถานะ implementation — 1 ตุลาคม 2026

## Frontend sandbox พร้อมทดลอง — checkpoint ล่าสุด

- ผู้ใช้อนุมัติให้ทำต่อหลังข้อจำกัดเดิม: ลบ Patients/CaseDetail/Dashboard และ helpers ที่ไม่ได้ render แล้ว พร้อม legacy direct appointment transition; คง PersonDirectory/CaseWorkflow/OperationalDashboard และ Priority ที่คิวงานยังใช้
- ทดสอบหลัง cleanup รอบก่อนจบ 6/6 แต่มีการคืน Priority ระหว่างรัน; ไม่อ้างว่าเป็น clean regression บน final tree
- รอบปัจจุบันเพิ่ม `yarn dev:sandbox`: frontend 3102 / `.next-sandbox` / test Supabase 55321 ไม่แก้ `.env` หรือหยุด server เดิม 3001
- Typecheck, unit 33/33, harness 4/4 ผ่าน; browser smoke บน frontend 3102 ผ่านทั้ง 5 roles (login, API access boundary, admin memberships/config, modal และไม่มี page error) โดยไม่เขียนเคส/ผล/นัด
- เปิด server ไว้ให้ผู้ใช้ทดลอง; ดูบัญชีและขั้นตอนใน [FRONTEND_TESTING.md](FRONTEND_TESTING.md)
- S1b ยังไม่จบ: appointment forms ยังไม่รวม, RecordResult legacy branch และ shared UI lint ยังต้องปรับ; ไม่เริ่ม S2 ไม่ deploy และไม่เปิด Google sync
- โควตารอบนี้กลับมาใช้เพดาน 5-hour 60% ตามคำสั่งล่าสุด; snapshot ก่อนส่ง frontend ใช้ 26%, weekly 4%; ไม่มีการใช้ reset credit โดย agent

## Checkpoint 1 ตุลาคม — S1b บางส่วน ยังไม่ผ่าน gate

- ปรับ Zod format validators เป็น API ปัจจุบัน คง offset/time validation; เปลี่ยน FormEvent เป็น SubmitEvent, status เป็น output และ beforeunload ใช้ preventDefault
- Unit tests ผ่าน 33/33, typecheck ผ่าน, browser regression รอบสุดท้ายผ่าน 6/6 (1.2 นาที) รวมคำเตือนก่อน reload และข้อมูลยังอยู่เมื่อยกเลิก
- เพิ่ม validation tests 12 ข้อ; ปรับ browser assertion ให้ชี้บุคคลใหม่เฉพาะราย ไม่จับ fixture เก่า; จำกัดเวลารอ navigation ที่ถูกยกเลิก โดยไม่ลด assertions
- Browser ก่อนรอบสุดท้ายพบ test timeout จากการรอ reload ที่ยกเลิก และ selector จับหลายคน; แก้ทั้งสองแล้ว ไม่ล้างข้อมูลเพื่อให้ผ่าน
- Workspace ผลล่าสุด: `/Users/thiti.ch/.yarn_tmp/clinic-contract.olxWzF`
- Lint ยังไม่ผ่าน: 28 errors / 1 warning; ไม่ปิดกฎตรวจ ไม่รัน build หรือ SQL rehearsal ใหม่ในรอบนี้
- การลบ legacy components ถูก auto-review ปฏิเสธสองครั้งเนื่องจากความเสี่ยงต่อ workflow/build จึงเก็บโค้ดเดิมไว้ ต้องขออนุมัติก่อนลบ/รวม flow; ยังไม่ได้รวม appointment forms หรือถอด direct transition เก่า
- ไม่เริ่ม S2 ไม่แก้ schema/Care D ไม่ deploy; tests ใช้ isolated project เท่านั้น
- ผู้ใช้อนุมัติ 5-hour 70% แต่ snapshot หลังทดสอบใช้ **79%** (weekly **77%**) เกินเพดาน จึงหยุดทันทีและบันทึกส่งต่อเท่านั้น ไม่ใช้ reset credit; usage เป็นบัญชีร่วม ไม่สามารถแยกสัดส่วนจาก task นี้ได้
- รอบถัดไปต้องตรวจโควตาและขออนุมัติส่วน refactor ที่ถูกปฏิเสธก่อน; ดู CONTINUATION_PLAN และ PROJECT_TIMELINE ซึ่งปรับเป็นลำดับตาม gate จริงแล้ว

Contract: [REQUIREMENTS_REVIEW_2026_09.md](REQUIREMENTS_REVIEW_2026_09.md)

สถานะ: **ยังไม่ครบ contract และยังไม่พร้อมปล่อย Preview**
งานอยู่ใน working tree ของ `develop` ยังไม่ได้ commit/deploy ในรอบนี้
ห้ามตีความรายการที่มีไฟล์แล้วว่าเสร็จจนผ่าน integration/RLS/UI tests

## Checkpoint ใหม่ — 28 กันยายน 2026: S1a เสร็จหนึ่งขั้น

ขอบเขตเฉพาะ test harness safety ไม่แก้ workflow/schema เพิ่ม และไม่เริ่ม S1b ในรอบเดียวกัน

- SQL rehearsal ย้ายจาก container Care D ไป `supabase_db_clinic_contract_workflow`; สร้างฐานใหม่เฉพาะชื่อ `clinic_contract_test_*` ไม่ reset/drop ฐานใด
- UI/SQL runners ใช้ helper เดียวกัน ตรวจ project id ก่อนเริ่ม; ยกเลิก auto-stop ผ่าน `CONTRACT_RESTART_AUTH`
- Provision script ตรวจ allowlist `http://127.0.0.1:55321` ก่อนสร้าง client; เรียกเดี่ยวก็ไม่ยอมใช้ Care D URL หรือ remote
- อ่าน Supabase status เป็น JSON ไม่ eval shell output และไม่พิมพ์ credentials
- Fixtures ใช้ insert-if-missing: ไม่มี hard delete/overwrite plan version, service default, role, tenant status หรือข้อมูล workflow เดิม; ไม่ตั้งสถานะกลับเพื่อกลบ test failures

### หลักฐานรอบนี้

| ตรวจ | ผล |
|---|---|
| Shell syntax / provisioning syntax | ผ่าน |
| `yarn test:harness` | ผ่าน 4/4: target guard, standalone refusal, fixture preservation, composite key/error propagation |
| `yarn test` | ผ่าน 21/21 (3 files) |
| `yarn tsc --noEmit --incremental false` | ผ่าน |
| `yarn test:database` | ผ่าน migrations 0001–0018 และ SQL assertions ใน test container; ฐาน `clinic_contract_test_20260928214858_24962` |
| Provision สองครั้งติดกัน | public data fingerprint ก่อน/หลังตรงกัน แสดงว่าข้อมูลเดิมไม่ถูกเขียนทับในรอบนี้ |
| `yarn test:integration` | ผ่าน 5/5 browser scenarios รวม Nurse/coordinator/viewer/system/admin, mobile focus, intake → plan → result/addendum → appointment → close/reopen; ประมาณ 1 นาที |
| Care D หลัง tests | public data fingerprint ตรงก่อนเริ่ม; container uptime เดิมต่อเนื่อง ไม่มี reset/stop/restart จากงานรอบนี้ |
| `git diff --check` | ผ่าน |
| Build / lint / dev / Preview | ไม่รันใหม่ใน S1a; build ผ่านครั้งก่อน 25 ก.ย., lint ยังมีปัญหาที่บันทึกไว้ ไม่อ้างว่าแก้แล้ว |

หลักฐาน fingerprints (SHA-256 ของ public data dump หลังตัด random restrict token ไม่ได้บันทึกเนื้อหาข้อมูล):

- Care D ก่อน/หลัง: `1a197c80ac164a3a464b4fa3af0b5b69b837fefa338222bd2bda37b1f5025674`
- Test project ก่อน/หลัง provision สองครั้ง: `496846fdca3aae7d6e931e32b3d216b2925f72823a68aad86b19dae1ca2cd466`
- หลัง browser tests ฐานทดสอบมี synthetic records ใหม่ตาม scenario ตามปกติ ไม่คาดหวัง fingerprint เดิม; การเปรียบเทียบ fixture preservation ทำก่อน browser tests
- UI test workspace: `/Users/thiti.ch/.yarn_tmp/clinic-contract.ZdKNqL`; SQL workspace: `/Users/thiti.ch/.yarn_tmp/clinic-contract.mSuo6p`

โควตา snapshot ตรวจราว 21:52 น. ไทย: ใช้ **27% / เหลือ 73%** ของ 5-hour และใช้ **5% / เหลือ 95%** ของ weekly ต่ำกว่าเพดานใช้ 60% ทั้งสองรอบ ไม่ใช้ reset credits (ยัง 3 ครั้ง)
ตัวเลขเป็นโควตาร่วมทุกงาน ไม่ใช่บัญชี token เฉพาะ task นี้ และอาจเปลี่ยนหลังบันทึก

ขั้นถัดไป **S1b — legacy flow / code quality** ตาม [CONTINUATION_PLAN.md](CONTINUATION_PLAN.md); ดูช่วงเป้าหมายและ release gates ใน [PROJECT_TIMELINE.md](PROJECT_TIMELINE.md)
ยังไม่ commit/push/deploy และไม่มีข้อมูลผู้ป่วยจริงถูกนำเข้าทดสอบ

## Baseline ก่อนเริ่มปรับ (ประวัติ ไม่ใช่สถานะปัจจุบัน)

- develop มี contract, validation, intake service/API และ migration 0012
- UI ยังเป็น NewCase หน้าเดียว; ไม่เรียก intake API; directory ยังรวมจากเคส
- รอบแผน/anchor ยังไม่มี; legacy create_case_workflow_v2 สร้างงานทันที
- lifecycle เดิมปิดเคสแล้ว cancel งานเงียบ ๆ; correction และ task transitions guards ยังไม่ครบ
- RLS ต้องทบทวน policies เดิม; tests 2 ชุดเดิมไม่พอรับรอง contract
- test:integration เดิม reset local และ provision demo ซ้ำ ต้องแยกก่อนรัน

## สิ่งที่ implement แล้ว

- IntakeWizard สามขั้น เรียก `/api/intake`: social-only/person-only, duplicate decision, field errors, idempotency และเตือนข้อมูลยังไม่บันทึก
- ทะเบียนบุคคลจาก API จริง, เปิดหลายเคส, แก้ช่องทางติดต่อ/สิทธิ์ติดต่อ/เจ้าของงาน/วันติดต่อ และบันทึก contact เข้า/ออก
- migrations 0013–0018: รอบแผนแยก, actual anchor, preview/revise, snapshot, RLS operational/clinical, guarded lifecycle, atomic report+appointment, disabled calendar outbox
- CaseWorkflow: แก้ operational, มอบหมาย Nurse, เริ่ม/แก้ anchor, task/result/addendum, นัดหมาย, pause/resume/close/reopen
- Nurse บันทึกรายงานตนเอง; clinical result ใช้ projection เฉพาะ Nurse/Clinic Admin
- Calendar คำนวณช่วง month/week/day เวลาไทย, เลื่อนตามมุมมอง และกรองผู้รับผิดชอบ; dashboard ใช้ count จริง
- แทน prompt แก้ source/service และระงับ tenant ด้วย dialog; ยังไม่ถือว่า Admin CRUD ครบ
- แยก Supabase browser-test project/ports ออกจาก Care D; ไม่ reset database สาธิต

## หลักฐานรอบก่อน — 25 กันยายน 2026

| ตรวจ | ผล | ขอบเขต/ข้อจำกัด |
|---|---|---|
| `yarn test` | ผ่าน 21 tests / 3 files | validation/intake service/calendar range; ไม่ใช่ CRUD ครบทุก resource |
| `NEXT_DIST_DIR=.next-contract-build yarn build` | ผ่าน | แก้ `/login` ด้วย Suspense ตาม Next.js; ไม่ได้ deploy |
| `yarn tsc --noEmit --incremental false` | ผ่าน | ตรวจหลังแก้ focus loop และเพิ่ม Nurse test |
| `yarn test:database` | ผ่าน migrations 0001–0018 + SQL assertions | ฐานใหม่ `clinic_contract_test_20260925202327_10669`; synthetic auth สำหรับ direct SQL/RLS ไม่ใช่ browser login |
| Browser เดิม | ผ่าน 4 scenarios | intake, viewer/system boundary, mobile layout, admin workflow ถึง close/reopen |
| Browser ขยาย | **ผ่าน 5/5 scenarios (38.8 วินาที)** | เพิ่ม Nurse attribution/clinical denial และ keyboard focus loop; พบ focus หลุดแล้วแก้ใน IntakeWizard; test workspace `/private/tmp/clinic-contract.VMXqNk` |
| `yarn lint` | **ยังไม่ผ่าน** | ทั้ง shared UI เดิม, unused legacy workspace, effect state, accessibility และ deprecated types/validation APIs |
| Dev / Preview | **ยังไม่ได้ตรวจ** | ห้ามใช้ผล local แทนหลักฐาน remote rollout |
| `git diff --check` | ผ่าน | ไม่มี whitespace error |

SQL assertions ครอบคลุม social intake/duplicate denial/idempotency/deferred tasks/Bangkok anchor/stale preview, viewer/platform boundary, direct RLS cross-clinic/clinical denial, consent block, atomic rollback, addendum ไม่เปลี่ยน task และ suspended tenant

Browser screenshots อยู่ใน `test-results/contract-mobile-intake.png` และ `test-results/contract-desktop-workflow.png` (generated artifacts; การตรวจภาพยังไม่ครบทุก role/ทุกหน้าจอ)

## ข้อจำกัดที่ต้องไม่ข้าม

1. ยังไม่มีหลักฐานทดสอบครบสำหรับ concurrent updates/last-admin race, membership invitation lifecycle, active-clinic switching, plan-version service defaults และทุกสถานะนัด
2. RPC เดิมของ assignment/task/manual task/addendum ต้องตรวจ optimistic concurrency, idempotency และ direct-RPC validation เพิ่ม ไม่ถือว่าการ parse ที่ API เพียงอย่างเดียวเพียงพอ
3. Task skip, Nurse จัดการงานค้างก่อนปิด, การแก้ clinical report ด้วย addendum และ terminal appointment correction ยังต้องตรวจให้ตรง contract
4. Intake suggestions จากชื่อคล้าย, open-case labels, pagination และคิวรับเรื่อง server-side ยังไม่ครบ (ตอนนี้ filter หลังโหลดไม่เกิน 100 คน)
5. Existing workspace ยังมี components ที่ไม่ได้ใช้งาน และ global appointment form เก่า ต้องรวม flow ไม่ให้ validation/attribution แตกต่างกัน
6. Clinic Admin ยังต้องเก็บ invitations/status, audit pagination/error states, plan step editor; System Admin ยังไม่มี create-tenant UI/API
7. Supabase generated types และ CI gates ยังไม่ครบ; lint ยังไม่ผ่าน
8. ยังไม่ apply migrations ใหม่กับ Care D local หลัก, Supabase dev หรือ Vercel Preview

## วิธีทำต่ออย่างปลอดภัย

- ใช้ [CONTINUATION_PLAN.md](CONTINUATION_PLAN.md) เป็นลำดับงานชุดย่อย; ยึด requirement contract เมื่อขัดกับเอกสารเก่า
- `yarn test:integration` สร้าง/ใช้ Supabase project `clinic_contract_workflow`, API 55321, DB 55322, Next port 3101, build dir `.next-contract`
- `yarn test:database` สร้าง database ชื่อเฉพาะใน container `supabase_db_clinic_contract_workflow` ไม่ reset `postgres` และไม่ใช้ container Care D แล้ว; การพิสูจน์บน CI อยู่ใน S7
- ใช้ `yarn test:harness` ตรวจ target guard/fixture policy; รัน suites ทีละชุด ไม่ถือว่ารองรับ concurrent runners แล้ว
- test containers/databases ถูกเก็บไว้ตรวจสอบ ไม่ลบอัตโนมัติ; ต้องขอขอบเขตที่แน่นอนก่อน cleanup
- อย่ารัน legacy reset/reseed เพื่อให้ test ผ่าน และอย่าเปิด service-role key ใน browser
- Production, Google sync, OAuth, cron และข้อมูลผู้ป่วยจริงอยู่นอกขอบเขต
