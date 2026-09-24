# Contract ฉบับทบทวน — 24 กันยายน 2026

เอกสารนี้มีอำนาจเหนือข้อความที่ขัดกันใน handoff/requirements/architecture/role model เดิม โดยไม่ลบประวัติเดิม การยอมรับ contract ไม่หมายความว่า implementation ผ่านแล้ว

## บุคคลและเคส

- ลีด/ผู้ป่วยคือบุคคลใน `patients` มีได้โดยไม่มีเคส; เคสคือเรื่องหรือรอบการดูแลของบุคคลเดิม ไม่สร้างบุคคลใหม่เมื่อเริ่มบริการ
- บุคคลมีหลายเคสได้ การติดต่อซ้ำให้เลือกเคสเดิมหรือเรื่องใหม่ ไม่ auto-merge
- การติดต่อผูกบุคคลและอาจผูกเคส แยกจากงาน ผลการติดตาม และนัดหมาย
- ข้อมูลทางคลินิกไม่มี hard delete; ใช้ประวัติ/addendum/archive แทน

## Intake 3 ขั้น

1. ค้นหา/ระบุตัวบุคคล: ชื่อหรือชื่อแสดง + โทรศัพท์หรือ social อย่างน้อยหนึ่งช่องทาง; HN optional; แยกผู้ติดต่อแทน ตรวจซ้ำ HN/phone/social ชื่อเป็นเพียงคำแนะนำ พบซ้ำต้อง link หรือ create พร้อมเหตุผล ห้าม HN ซ้ำคลินิกเดียวกัน ตรวจซ้ำล้มเหลวห้ามถือว่าไม่พบ บันทึกลีดอย่างเดียวพร้อม owner/next contact ได้
2. รายละเอียดเคส: บังคับหัวข้อและ coordinator owner (เริ่มต้นผู้บันทึก) ระบุ source/service/priority/nurse/coordination note ได้ บริการ/แผน/Nurse รอเติมได้ priority เริ่ม normal; แผน default ไม่ต้องเหตุผล แผนอื่นต้องเหตุผล เลือกแผนยังไม่สร้างงาน
3. ตรวจทาน: บุคคล/เคส/ผู้รับผิดชอบ/สิ่งที่ยังขาด/แผนรอยืนยันวันเริ่ม สร้างบุคคล+เคส+audit atomic มี idempotency สำเร็จแล้วเปิดรายละเอียด

Validation ทั้ง client/API/database; inline errors และ error ใน modal; focus ช่องแรกผิด; ไม่ล้างค่าหลัง error; pending/double-submit guard; confirm discard

Consent: unknown/granted/declined พร้อม actor/time แยกการตลาด ไม่อนุมานย้อนหลัง; unknown/declined ระงับ outgoing contact แต่บันทึก incoming ได้ ไม่ reset จากเคสใหม่

## Lifecycle และแผน

- Intake: new/in_progress/awaiting_callback/linked_to_case/closed
- Case: open/paused/closed แยก care stage assessment/preparation/post_procedure และสถานะนัด
- Task: pending/in_progress/paused/completed/skipped/cancelled; overdue computed
- Appointment: scheduled/completed/cancelled/no_show; reschedule เป็น history ไม่หยุด follow-up
- รอบแผนเลือก version + anchor เหตุการณ์จริง; Nurse ยืนยันหรือ co/admin บันทึกคำสั่งพร้อม Nurse identity วันเหตุการณ์/วันบันทึก ไม่ใช้วันรับเรื่องหรือนัดแทนอัตโนมัติ
- Activation สร้าง snapshot งานครั้งเดียว; คัดกรองเป็น ad-hoc แยก; แก้ anchor preview ผลกระทบก่อน ปรับเฉพาะยังไม่เริ่ม ไม่แตะ completed/in-progress/history; plan version ใหม่ไม่เปลี่ยนรอบเดิม
- Default dev: Bangkok 09:00 วันปฏิทิน ไม่เลื่อนวันหยุด เว้นแต่แผนระบุ ต้องทบทวนกับคลินิกก่อน production
- Pause พักงานยังไม่เริ่ม ไม่ยกเลิกนัด; resume ทบทวนวัน ไม่เลื่อนเงียบ ๆ
- ผลมีหลาย contact attempts แยก performed_by/reported_by/recorded_by/occurred_at/recorded_at; retry/ad-hoc explicit; correction immutable addendum ไม่เปลี่ยน task หรือสร้าง retry
- ผล+นัดใน flow เดียวต้อง atomic นัดต้องมี start<end; collision ผู้ให้บริการเตือน/ยืนยันเหตุผล; เลื่อน/ยกเลิก/no-show/แก้สำคัญมี history; terminal correction เฉพาะ admin พร้อมเหตุผล
- Close reason: care_completed/not_interested/unreachable/referred/cancelled/other; ทบทวนงาน/นัดค้างและตัดสินใจทุกชิ้นก่อน close ห้ามใช้ completed แทน cancelled
- Co ปิด coordination reason ได้; care_completed ต้อง Nurse ยืนยัน/คำสั่ง; assigned Nurse ปิดจบการดูแลได้; reopen admin+reason เท่านั้น ไม่คืนงานหรือสร้างแผนเอง

## สิทธิ์และ UI

- care_coordinator: intake/contact/relay/assignment/nurse-reported result/appointment/activate ตามคำสั่ง ไม่เห็น clinical detail
- nurse: assigned work เท่านั้น clinical report ของตน ยืนยันแผน/จบการดูแล
- clinic_admin: workflow/config/users/audit/reopen ไม่เป็นผู้ประเมินแทน Nurse
- viewer: permitted operational read-only ไม่เห็น clinical detail
- system_admin: tenant metadata เท่านั้น ไม่มี clinic inheritance; /system; no membership/no platform role → access-pending
- RLS/API ตรวจ active clinic, tenant suspension, role และ FK clinic scope; final-admin/self-escalation guards; Nurse identity เป็นบุคลากรจริง ไม่ใช้ free text
- ทะเบียนบุคคลจริง (ไม่ derive จาก case), intake queue, case detail/timeline, follow-up filters, calendar month/week/day, dashboard แยกคน/เคส/งาน/นัด
- mockup shell/sidebar/drawer/dialog Thai responsive; loading/empty/error/retry; /admin users/invitations/config/sources/services/immutable plans/tools disabled/safe audit

## Interface และ migration

รักษา UUID/case number/history; ไม่ merge หรือตั้ง consent/actual anchor เดาให้ข้อมูลเดิม; unknown anchor ขึ้นรอตรวจสอบ; incomplete data แจ้งเติมไม่ลบ

API validation มี field errors แยก 400/401/403/409; mutation transaction+audit+idempotency+optimistic concurrency; browser ผ่าน API ไม่มี service key; ตรวจ policies เดิมทั้งหมด ไม่เฉพาะเพิ่มใหม่

## Requirement → surface → acceptance

| Requirement | Surface | เกณฑ์ทดสอบ |
|---|---|---|
| บุคคลไม่มีเคส/social | Intake, patients API | social-only, owner/next contact, directory UUID จริง |
| Duplicate/validation | Wizard, intake transaction | link/create reason, HN conflict, failure retains form |
| Deferred plan | Case/plan cycle API | ไม่สร้างงานเมื่อ intake; activation/replay ไม่มีซ้ำ |
| Anchor correction | Plan preview/confirm | completed/history ไม่เปลี่ยน, in-progress manual |
| Report/addendum | Results API/UI | attribution, no retry on correction, atomic result+appointment |
| Appointment/lifecycle | Dialog/API | transitions/history/collision, no silent follow-up cancellation |
| Close/pause/reopen | Case detail/API | unresolved work rejected, reasons, role guards |
| Privacy | Direct RLS + API | cross-clinic, assignment, clinical denial, suspended, platform isolation |
| UX parity | Browser desktop/mobile | 3 steps, every role, queue/detail/calendar/error states |

ลำดับส่งมอบ: contract → schema/RLS/RPC → wizard/directory → workflow → admin/calendar/dashboard → local/dev/Preview. Integration fixture แยกคลินิกจาก demo ห้ามล้าง Care D เพื่อ test ผ่าน

นอกขอบเขต: production rollout, Google sync/OAuth/cron, patient messaging, auto merge, full EMR. ห้ามสรุปว่าเสร็จจาก typecheck/API status tests เท่านั้น ต้องมี full workflow/RLS/UI หลักฐาน
