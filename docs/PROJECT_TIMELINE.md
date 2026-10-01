# Project timeline — Clinic Tracking Leads

Checkpoint: 1 ตุลาคม 2026 · Contract: [REQUIREMENTS_REVIEW_2026_09.md](REQUIREMENTS_REVIEW_2026_09.md)
ผลจริง: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) · แผนลงรายละเอียด: [CONTINUATION_PLAN.md](CONTINUATION_PLAN.md)

> Checkpoint ล่าสุด 1 ต.ค.: อนุมัติและทำ legacy cleanup บางส่วนแล้ว เปิด frontend sandbox 3102 ให้ทดลองตาม FRONTEND_TESTING.md; รอ feedback และทำ S1b ที่เหลือก่อน S2 ไม่รับรองวัน Preview เดิม เพดานล่าสุดคือ 5-hour 60%

## กำหนดการปรับตามผลจริง — 1 ตุลาคม 2026

S1b เสร็จเฉพาะ validation/form types/status; cleanup โค้ดเก่าถูก auto-review ปฏิเสธและ lint ยังไม่ผ่าน จึงไม่เลื่อนสถานะเป็น S2 ตามปฏิทิน
กำหนดเดิมด้านล่างเก็บเป็นประวัติเท่านั้น ต้องเลื่อน milestone ที่ขึ้นกับ S1b จนผ่าน gate จริง

| ลำดับถัดไป | เป้าหมาย | เงื่อนไขเริ่ม |
|---|---|---|
| รอบถัดไปที่ได้รับอนุมัติ | S1b ส่วนที่เหลือ: cleanup/รวม appointment flow/shared UI lint | อนุมัติขอบเขตลบโค้ดที่ถูกปฏิเสธและมีโควตาพอสำหรับ regression |
| หลัง S1b ผ่าน | S2a → S2b | lint/typecheck/unit/browser regression มีหลักฐาน ไม่ข้ามปัญหาเดิม |
| หลัง S2 ผ่าน | S3 → S4 → S5a → S5b → S6 | acceptance ตาม CONTINUATION_PLAN ทีละชุด |
| หลัง local gates ครบ | S7: dev → Preview | migration rehearsal, สิทธิ์ environment และ manual smoke พร้อม |

ยังเหลือ 9 ชุดเดิม (รวม S1b ที่ทำบางส่วน) ไม่ให้วันรับประกันใหม่ก่อนเคลียร์ blocker; ประเมินจำนวนรอบใหม่หลังจบ S1b
ข้อยกเว้นโควตารอบ 1 ต.ค.: ผู้ใช้ให้ใช้ 5-hour ไม่เกิน 70% แทนเงื่อนไขเดิม ตรวจระหว่างทางและเผื่อปิดงาน ไม่ใช้ reset credit

## สถานะและกรอบเวลาเดิม — แผนเสนอ 28 กันยายน 2026

S0 baseline และ S1a test harness safety มีหลักฐานแล้ว แต่ระบบ **ยังไม่ครบ contract และยังไม่พร้อม Preview**
ไม่ใช้จำนวนไฟล์หรือจำนวน tests ที่ผ่านเป็นเปอร์เซ็นต์ความสำเร็จของทั้งโครงการ

เหลือประมาณ **9 ชุดงาน / 10–18 รอบทำงานแบบจำกัดขอบเขต** และควรเผื่อแก้ regression อีก 2 รอบ
หนึ่งรอบหมายถึงงานที่ตกลง → implement → tests → บันทึก checkpoint ไม่ใช่จำนวนข้อความหรือรอบ reset โควตา
ประมาณการนี้ยังไม่ใช่เวลาที่วัดจริงของงานที่เหลือ และต้องประเมินใหม่ทุก milestone

ตารางวันที่ด้านล่างเป็น **เป้าหมายเสนอเพื่อวางแผน** ภายใต้สมมติฐานทำได้หนึ่งรอบต่อวันทำงาน มีโควตาและ environment พร้อม
ไม่ใช่การนัดรันอัตโนมัติหรือรับประกันวันเสร็จ; หากต้องรอโควตา/สิทธิ์/การทบทวนของคลินิก ให้เลื่อนช่วงถัดไปตามจริง

| ช่วงเป้าหมาย | ชุดงาน | ผลส่งมอบ / เงื่อนไขผ่าน |
|---|---|---|
| 25 ก.ย. — ทำแล้ว | S0 | baseline build/typecheck/unit/SQL และ browser 5 scenarios; บันทึก lint ที่ยังไม่ผ่าน |
| 28 ก.ย. — ทำแล้ว | S1a | isolated SQL runner, URL guard, fixture preservation; ไม่เปลี่ยน Care D |
| 29 ก.ย. | S1b | ลด flow ซ้ำและ dead paths, lint/typecheck/unit/workflow regression ผ่าน |
| 30 ก.ย.–5 ต.ค. | S2a + S2b | concurrency, idempotency, assignment/tasks, addendum, appointment correction/overlap พร้อม direct RPC/API tests |
| 6–7 ต.ค. | S3 | intake/directory ครบ duplicate failure/shared phone/HN/open cases/server pagination; ฟอร์มไม่สูญข้อมูล |
| 8–12 ต.ค. | S4 | Nurse attribution, skip/pause/close รายการค้าง, combined result+appointment/retry และ rollback/consent tests |
| 13–16 ต.ค. | S5a + S5b | memberships/invitations/last-admin protection, plan versions/defaults, safe audit และ tenant creation |
| 19–20 ต.ค. | S6 | read models/types, dashboard/calendar/filters และ visual QA desktop/mobile ทุก role |
| 21–23 ต.ค. | S7 + regression buffer | CI/test isolation, fresh/upgrade migration rehearsal, Supabase dev และ Vercel Preview smoke หลังผ่าน local gates |

วันที่ทั้งหมดเป็นปี 2026; ช่วงวันที่ไม่ใช่กำหนดการรับผู้ป่วยจริง และไม่รวม production deployment

## Milestones ที่ต้องตรวจ ก่อนเดินต่อ

1. **ฐานงานปลอดภัย (S1):** ไม่แตะ Care D, test fixtures ไม่ reset history, lint/typecheck/unit/regression ผ่าน
2. **ธุรกรรมและ intake ถูกต้อง (S2–S3):** stale/race/retry/duplicate ป้องกันที่ server/DB; ไม่สร้าง person/task ซ้ำ
3. **Workflow และสิทธิ์ครบ (S4–S5):** attribution/clinical isolation/consent, CRUD ตาม archive/versioning, RLS/API ครบทุก role
4. **พร้อมทดสอบปล่อย (S6–S7):** หน้าจอครบ desktop/mobile, migration upgrade ปลอดภัย, CI และ local → dev → Preview มีหลักฐาน

ทุก milestone ต้องมีรายการ requirement → test → ผลจริง; หากยังไม่ผ่าน ให้คงสถานะค้างและบันทึกสาเหตุ ไม่ข้ามไปประกาศว่าเสร็จ

## โควตาและการไม่รบกวนงานอื่น

- เพดาน: บัญชีใช้ไม่เกิน **60%** ทั้ง 5-hour และ weekly สำรองอย่างน้อย **40%** สำหรับงานอื่น
- ตรวจ usage ก่อนเริ่ม กลางรอบ และก่อนส่งงาน; เมื่อเข้าใกล้ 50% ให้หยุดขยาย scope และบันทึก checkpoint เพราะ usage มีความหน่วงและใช้ร่วมกับงานอื่น
- ทำครั้งละหนึ่งชุด ไม่ทำงานหลาย agent ไม่ใช้ reset credit และไม่เปิด automation โดยไม่ได้รับคำสั่ง
- Test project `clinic_contract_workflow`: API 55321 / DB 55322 / browser server 3101 / `.next-contract`; ไม่ reset Care D ไม่ kill dev server ไม่ reuse server ที่ไม่ทราบ environment
- Docker และ browser tests ยังใช้ CPU/RAM บนเครื่องร่วมกัน จึงไม่รับรองผลกระทบเป็นศูนย์หรือจำกัด CPU ที่ 60%; 60% ในแผนนี้หมายถึง usage ของ Codex
- เก็บ synthetic databases/artifacts ไว้ตรวจสอบ ไม่ลบอัตโนมัติ; cleanup ต้องระบุรายการเป้าหมายให้ชัด
- ไม่ deploy production ไม่เปิด Google/OAuth/cron ไม่ส่งข้อความหาผู้ป่วย และไม่ import ข้อมูลผู้ป่วยจริง

## คำสั่งเริ่มรอบถัดไปสำหรับส่งต่องาน

“อ่าน REQUIREMENTS_REVIEW_2026_09, IMPLEMENTATION_STATUS และ CONTINUATION_PLAN ตรวจ usage แล้วทำเฉพาะ S1b ตามโควตาไม่เกิน 60%; อย่า reset Care D อย่าใช้ reset credit และอย่าเริ่ม S2 ในรอบเดียวกัน บันทึก tests/สิ่งค้าง/timeline ก่อนจบ”
