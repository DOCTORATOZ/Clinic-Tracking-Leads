# แผนทำต่อแบบแบ่งชุดตามโควตา

## ล่าสุด — 2 ตุลาคม 2026: Preview ขึ้นแล้ว

- เว็บ Preview พร้อม: https://clinic-tracking-leads-qy1l9ii9n-doctor-a-to-z.vercel.app (ยังมี Vercel Authentication)
- Supabase dev apply 0001–0018 แล้ว ไม่ reset/seed; public signup ปิด, invitation ปิด, Google sync ปิด และไม่แตะ Production
- Local browser 7/7 และ remote login/สิทธิ์ครบ 5 roles พร้อม flow intake → Nurse result → appointment/calendar ผ่าน
- ปิดบัญชีทดสอบทั้งหมดและ suspend คลินิกทดสอบแล้ว; คง membership Admin สุดท้ายตาม guard โดยบัญชีถูก ban
- หลักฐาน ข้อจำกัด และ security warnings อยู่ใน [PREVIEW_RELEASE.md](PREVIEW_RELEASE.md); ยังไม่ถือว่าครบ requirement หรือพร้อม production
- ทำต่อ: ให้ผู้ใช้ UAT ผ่าน Clinic Admin → เก็บ defect → ปิดงาน correctness/CRUD และ security review ตามชุดด้านล่าง → CI จริง ก่อนพิจารณา production
- Usage ก่อนปิดงาน: 5-hour 92%, weekly 30%; ไม่ใช้ reset credit และไม่เริ่มชุดฟีเจอร์ใหม่
- Checkpoint เก่าที่ระบุว่ายังไม่ deploy เป็นประวัติ ไม่ใช่สถานะล่าสุด

## ล่าสุด — local release gates พร้อมตรวจปล่อย

- รายละเอียดและคำสั่งทำต่ออยู่ใน [PREVIEW_RELEASE.md](PREVIEW_RELEASE.md)
- ผู้ใช้ยืนยัน dev ref `gispylnpqiwxqbqnvmya` และอนุมัติใช้บัญชีที่ผู้ดูแล provision ก่อน; ปิดคำเชิญผ่าน UI/API แล้ว
- Lint 0 errors/0 warnings, TypeScript ผ่าน, unit 38/38, harness 4/4; workflow browser 6/6 ก่อน patch ปิด invitation (ต้องตรวจเพิ่ม)
- Fresh migration/RLS และ upgrade rehearsal พร้อม synthetic 0010 data ผ่าน; dry run remote มี 0011–0018 ไม่มี seed
- ยังไม่ apply/deploy/commit; usage ล่าสุด 97% จึงเก็บขั้นตอนต่อให้ตรวจ remote หลัง apply ได้ครบ ไม่เริ่ม mutation ปลายทางใกล้หมดโควตา
- ข้อความ checkpoint เก่าด้านล่างเป็นประวัติ ไม่ใช่จำนวน lint/สถานะล่าสุด

## จุดส่งต่อ — เตรียม Preview 1 ตุลาคม 2026

- ผู้ใช้อนุมัติเดินตามลำดับเตรียม Supabase dev + Vercel Preview; ยังไม่อนุญาต production/Google sync
- รอบนี้แก้ chart key coercion 3 จุด, ตรวจ reason ใน System Admin ว่าเป็นข้อความไม่ว่าง และ named PostCSS config; lint ลดจาก 24 errors/1 warning เป็น 20 errors/0 warnings; TypeScript ผ่าน
- หยุดงานเพิ่มเพราะ usage ล่าสุด 62% เกินเพดาน 60% ระหว่างรอบตรวจ (เริ่มรอบ 56%); ไม่ใช้ reset credits
- ขั้นถัดไป: แก้ lint 20 จุดโดยไม่ปิด rules → final regression → แยก db push ออกจาก seed → rehearsal upgrade 0010 ถึง 0018 → ยืนยัน linked project เป็น dev → apply migrations เท่านั้น → ตั้ง Preview env/Auth และ smoke ทุก role
- Remote ที่อ่านล่าสุดมี migrations 0001–0010; local มีถึง 0018 ห้าม deploy code ใหม่โดยถือว่าฐานพร้อมแล้ว
- ยังไม่ได้แก้ invitation callback/password setup; หากทดลองก่อนต้องใช้บัญชีที่ผู้ดูแล provision และระบุข้อจำกัด
- ยังไม่ได้ apply/seed/deploy/commit หรือหยุด server ที่ผู้ใช้ทดสอบ

อัปเดต 1 ตุลาคม 2026 · ดูหลักฐานล่าสุดใน [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
Contract หลัก: [REQUIREMENTS_REVIEW_2026_09.md](REQUIREMENTS_REVIEW_2026_09.md)

## จุดส่งต่อปัจจุบัน — frontend sandbox

- ผู้ใช้อนุมัติ refactor ที่เคยถูกปฏิเสธแล้ว; ลบ legacy Patients/CaseDetail/Dashboard/helpers และ direct appointment transition แล้ว ไม่ต้องขออนุมัติส่วนนี้ซ้ำ
- Frontend ทดลองได้ที่ 3102 ด้วย `yarn dev:sandbox`; บัญชี/ข้อจำกัด/รายการลองอยู่ใน FRONTEND_TESTING.md
- ขั้นถัดไป: รับ feedback frontend แล้วรวม NewAppointment กับฟอร์มใน CaseWorkflow, ถอด RecordResult branch เก่า, แก้ shared UI/effect lint และรัน clean regression บน final tree ก่อนปิด S1b
- เพดานล่าสุด 5-hour 60%; รักษาเว็บเดิม 3001 และข้อมูล Care D ไม่ reset/reseed
- ข้อความรออนุมัติ/เพดาน 70% ด้านล่างเป็นประวัติของ checkpoint ก่อนหน้า

## Checkpoint — 1 ตุลาคม 2026: S1b ทำได้บางส่วน

- ผู้ใช้อนุมัติรอบนี้ให้ใช้เพดาน **5-hour 70%** แทนเกณฑ์เดิม หลังตรวจพบ weekly ใช้เกิน 60% แล้ว; ไม่ใช้ reset credits ไม่ถือเป็นอนุมัติให้ใช้จนเต็มบัญชี
- ทำแล้ว: ย้าย Zod format validators เป็น API ปัจจุบันโดยคง offset options, ใช้ SubmitEvent ในฟอร์ม, status ใช้ semantic output และก่อนออกจากหน้าที่มีข้อมูลค้างใช้ preventDefault
- เพิ่ม regression tests สำหรับ UUID/date/time/email, end-after-start, reschedule, attribution/retry input และ browser beforeunload
- **ยังไม่จบ S1b:** lint มีข้อผิดพลาดเหลือ; การลบ Patients/CaseDetail/Dashboard และ helper เก่าถูก auto-review ปฏิเสธสองครั้ง เนื่องจากความเสี่ยงทำให้ workflow/build เสีย จึงยังไม่ลบและไม่ใช้วิธีอื่นข้ามข้อจำกัด
- ก่อนดำเนินส่วนที่ถูกปฏิเสธ ต้องขออนุมัติผู้ใช้สำหรับ refactor ลบองค์ประกอบเก่าที่ไม่ได้ render และรวมฟอร์มเพิ่มนัด โดยคง CaseWorkflow/PersonDirectory/OperationalDashboard พร้อมทดสอบ regression
- ยังไม่ได้รวม NewAppointment หรือถอด legacy direct appointment transition; ห้ามอ้างว่า flow ถูก unify แล้ว
- ไม่เริ่ม S2 จน S1b ผ่านเกณฑ์หรือผู้ใช้จัดลำดับใหม่; วันเป้าหมายเดิมใน timeline เป็นประวัติ ไม่ใช่สถานะว่าเสร็จตามวันที่

## Checkpoint ล่าสุด — S1a / 28 กันยายน 2026

- รอบนี้จำกัดหนึ่งขั้น: แยก SQL rehearsal ไป container `supabase_db_clinic_contract_workflow`, ป้องกัน standalone provisioning ไปผิด URL, อ่าน CLI status เป็น JSON ไม่ใช้ eval และเติม fixture เฉพาะที่ยังไม่มี
- ไม่ลบ fixture และไม่ overwrite role, tenant status, archived plan/version, service defaults, task/result/appointment เดิม; ไม่แก้ฐาน Care D เพื่อให้ test ผ่าน
- รอบถัดไปเริ่ม **S1b — legacy paths / lint** เท่านั้น ไม่เริ่ม S2 พร้อมกัน; งาน S1 เดิมจึงยังไม่เสร็จทั้งหมด
- ใช้โควตารวมของบัญชีไม่เกิน 60% ทั้งรอบ 5 ชั่วโมงและรายสัปดาห์ เพื่อสำรองอย่างน้อย 40%; เช็กก่อน/ระหว่าง/หลังแต่ละรอบ และเริ่มปิดงานตั้งแต่เข้าใกล้ 50% ไม่รอชน 60%
- Usage เป็นบัญชีร่วมกับงานอื่นและอัปเดตเป็นช่วง จึงรับรองเปอร์เซ็นต์ต่อฟีเจอร์ไม่ได้; ไม่ใช้ reset credit ไม่สร้าง automation และไม่เปิดงานถัดไปเองหลัง checkpoint
- ก่อนเริ่มรอบนี้ใช้ 5-hour 4%, weekly 2%; ตัวเลขสิ้นสุดดู IMPLEMENTATION_STATUS เป็น snapshot ตามเวลาตรวจ
- กำหนดการและเงื่อนไขส่งมอบอยู่ใน [PROJECT_TIMELINE.md](PROJECT_TIMELINE.md)

## ข้อตกลงรอบโควตาจำกัด — ประวัติ 25 กันยายน 2026

- รอบปัจจุบันทำเฉพาะตรวจรวม, แก้ build/login และ modal focus ที่พบจริง, เพิ่ม Nurse test และส่งต่อแผน ไม่ใช้ reset credit ไม่ deploy
- ตัวเลขก่อนเริ่มรอบ: weekly เหลือ 9%, 5-hour เหลือ 98%; เป็น snapshot ไม่ใช่โควตาที่รับรองว่าจะเหลือเท่านี้เมื่ออ่านเอกสาร
- เมื่อจบ S0 ตรวจจากบัญชีอีกครั้ง: weekly เหลือ **2%**, 5-hour เหลือ **55%**, reset credits ยัง 3 ครั้ง ไม่ได้ใช้; weekly reset 28 ก.ย. 2026 เวลา 12:30 น. ไทย
- โควตา 2% ที่เหลือไม่ควรรับปากทำ S1 ครบ เหมาะกับการตรวจ/แก้จุดเล็กที่มีขอบเขตชัดเท่านั้น; เริ่มชุดใหญ่เมื่อมีโควตาพอหรือได้รับคำสั่งใช้ reset อย่างชัดเจน
- ประเมินเป็นขนาดงาน ไม่เดาเปอร์เซ็นต์ usage ต่อฟีเจอร์: dependency, context และจำนวน defect ทำให้ usage ต่างกัน
- ทำทีละชุดจบด้วย test ที่เกี่ยวข้องและบันทึกหลักฐาน ไม่เปิดงาน schema/UI หลายชุดพร้อมกัน
- เมื่อใกล้หมดโควตา ให้จบที่ checkpoint พร้อมไฟล์/คำสั่ง/ผลทดสอบ/สิ่งค้าง ไม่ใช้ reset หรือสร้าง automation เอง

## ลำดับชุดงาน

| ชุด | ขนาด | งานที่จำกัดไว้ | เกณฑ์จบ |
|---|---|---|---|
| S0 — baseline ปัจจุบัน | เล็ก | แก้ login build, ตรวจ keyboard modal, เพิ่ม Nurse self-report, รัน local tests และบันทึกผล | build/typecheck/unit/5 browser scenarios/SQL tests มีผลชัด; lint failures ไม่ปิดบัง |
| S1a — test harness safety | เสร็จรอบ 28 ก.ย. | SQL rehearsal ใน test container, standalone URL guard, JSON status, insert-only fixtures | safety tests + SQL + workflow regression และตรวจข้อมูลก่อน/หลัง |
| S1b — code quality | บางส่วน 1 ต.ค.; ยังไม่ผ่าน gate | validators/form types/status ปรับแล้ว; ยังเหลือ dead workspace/legacy mutation service, รวม appointment form และ lint | ต้องได้อนุมัติส่วนลบที่ถูกปฏิเสธ; lint/typecheck/unit ผ่าน, workflow tests ไม่ถอย |
| S2 — mutation correctness | ใหญ่ แบ่ง 2 รอบ | S2a: assignment/task/manual task concurrency+reason+idempotency; S2b: addendum/appointment terminal correction/provider overlap+explicit confirmation | API และ direct RPC tests ปฏิเสธ stale/invalid input; race/retry ไม่เขียนซ้ำและไม่เปลี่ยนประวัติ |
| S3 — intake/directory parity | กลาง | ค้นชื่อเป็น suggestion ไม่ auto-match, แสดงเลขและสถานะเคสเปิด, pagination/filter intake ฝั่ง server, duplicate-failure/retry UX, contact update validation ข้างช่อง | social-only/shared phone/HN conflict/หลายเคส/เกิน 100 คน ผ่าน browser และ API |
| S4 — clinical/task lifecycle | กลาง | Nurse งาน assigned/self-report/addendum, skip+reason, pause/resume รายงานผลกระทบ, close รายการค้างทีละรายการ, combined result+appointment/retry UX | workflow ทุก role พร้อม attribution/time, rollback และ consent block ผ่าน; ไม่มี silent completion/cancel |
| S5 — admin/platform | ใหญ่ แบ่ง 2 รอบ | S5a: membership invitation lifecycle/audit+last admin tests; S5b: plan editor/version/defaults, audit pagination, config dialogs, tenant creation/bootstrap ที่กำหนดสิทธิ์ชัด | CRUD ตาม archive/versioning ผ่าน; self-escalation/platform clinical denial/concurrent last-admin removal ถูกปฏิเสธ |
| S6 — full read models / visual QA | กลาง | Calendar ทุกมุมมองและตัวกรอง, queue owner/status/date/priority, lifecycle/actor ภาษาไทย, dashboard counts, safe timelines, generated DB types | desktop+mobile ทุก role; ไม่ใช้ count จากรายการที่ถูก limit; ไม่มี runtime mock imports |
| S7 — release gate | กลาง | CI migration reset เฉพาะ test project, tests รวม, fresh migration+upgrade rehearsal, safe dev target check แล้ว Preview smoke | มีหลักฐาน local → Supabase dev → Vercel Preview ครบ; ไม่มี production/Google/real patient data |

ให้เริ่ม **S1b** ตามโควตาที่ตรวจได้จริง แล้วประเมินใหม่ก่อน S2 ไม่รับรองว่าจะจบทั้งตารางในหนึ่งโควตา

## รายละเอียดจุดเริ่มสำหรับแต่ละชุด

### S1a ที่ดำเนินการแล้ว / ข้อจำกัดชุดทดสอบ

- SQL runner และ UI runner ใช้ `scripts/contract-local.sh` กับ project `clinic_contract_workflow`; ไม่มี stop/reset/drop และไม่พึ่ง container daz แล้ว
- `scripts/contract-safety.mjs` ตรวจ URL 55321 ก่อนสร้าง client; fixture ใช้ conflict-do-nothing ไม่ reactivate/แก้ข้อมูลเก่าทางลัด
- `yarn test:harness` ทดสอบ guard และ fixture policy โดยไม่ต้องใช้ Docker
- Fixtures คงสภาพเมื่อรันซ้ำ: หาก test เปลี่ยน role/ระงับ tenant/archive catalog ต้องมี fixtures เฉพาะ scenario และ cleanup ที่ได้รับอนุญาต ไม่แก้ provision ให้เขียนทับเพื่อซ่อนปัญหา
- ยังไม่ได้พิสูจน์บน CI หรือรองรับ runner หลายชุดพร้อมกัน; รันทีละชุด และไม่ใช้ `CONTRACT_RESTART_AUTH` เพื่อหยุดบริการอัตโนมัติอีก

### S1b — จุดเริ่มรอบถัดไป

- `components/operations/operations-workspace.tsx`: `Patients`, `CaseDetail`, `Dashboard` เก่า unused; `RecordResult` เก่าขาด requestId; global `NewAppointment` ควรใช้ form/service เดียวกับ CaseWorkflow
- `modules/appointments/service.ts`: direct transition เก่าที่ไม่ถูกใช้ควรถอดเพื่อไม่ให้กลับมาใช้งานโดยไม่มี transaction
- Lint: shared `components/ui/*`, hooks/use-mobile, compiler effect-state, semantic tags, deprecated Zod/React types; ไม่ disable ทั้ง repo เพื่อให้ผ่าน

### S2 / S4

- ตรวจทุก callable SQL function/grant/policy รวมของเก่า ไม่ตรวจเฉพาะ migration ใหม่
- `assign_case_nurse`, `transition_follow_up_task`, `create_manual_follow_up_task`, `add_follow_up_result_correction` ยังต้องตรวจ expected revision/idempotency ตามชนิด mutation
- ยืนยันว่า assignment ไม่เปลี่ยนกำหนดงาน in-progress โดยเงียบ ๆ; retry มี owner/reason/dueAt; duplicate submit ไม่สร้าง task/addendum ซ้ำ
- ตรวจ Nurse close เมื่อยังมีงานค้างและการ cancel/skip ที่อนุญาต; ไม่ใช้ complete แทนงานที่ไม่ได้ทำ
- ตรวจแยกผู้รายงานจริงจาก recorder และ clinical addendum; ไม่ใช้ free-text เป็น staff identity
- นัดเสร็จสิ้นต้องผ่าน admin correction flow พร้อมเหตุผล; provider collision ต้องเตือนและรับ explicit override ไม่ตีความ reason ธรรมดาว่าอนุมัติ overlap
- ใช้ migration ใหม่หลัง 0018 สำหรับการแก้ถัดไป เพราะ 0013–0018 ถูก apply กับ isolated Supabase แล้ว

### S5

- `/api/clinic/memberships`: review read path ที่ใช้ admin client, failure หลัง Auth invite ก่อนบันทึก membership/audit, retry invitation และสถานะ invited/active/disabled
- Integration tests: self-change, last-admin removal/race, disabled membership, multiple clinic switch, service defaults ย้าย version แต่ task snapshot เดิมไม่เปลี่ยน
- `ClinicAdminWorkspace`: ข้อผิดพลาดใน Tools/Audit ไม่ควร unhandled; เพิ่ม pagination/empty/retry; plan editor ไม่ให้ต้องกรอก CSV เอง
- `SystemAdminWorkspace`: metadata-only; tenant create ยังต้องมี API/RPC ที่ตรวจ platform permission และ audit; ไม่เพิ่ม clinic access ให้ System Admin อัตโนมัติ

## Requirement → หลักฐานที่มี / ยังขาด

| กลุ่ม | หน้าจอ/API/DB | หลักฐานที่มี | ยังต้องเพิ่ม |
|---|---|---|---|
| บุคคล/รับลีด | IntakeWizard, PersonDirectory, `/api/intake`, `save_intake` | unit validation, social-only/linked person browser, duplicate SQL | duplicate failure UI, HN/shared phone flow, pagination, open-case labels |
| แผน | CaseWorkflow, `/cases/:id/plans`, cycle RPCs | SQL activation idempotency/Bangkok/preview; UI activation | version/default immutability, anchor completed/in-progress matrix |
| ผล/นัด/ปิด | result/appointment/case lifecycle RPCs | atomic rollback SQL, UI report/addendum/complete/close/reopen | retry & combined UI, all appointment states/collision, pause/resume/skip, concurrency |
| สิทธิ์ | ClinicContext/RLS/projections | SQL cross-clinic/clinical/suspend, browser viewer/system/Nurse | active-clinic multi-membership, disabled user, full mutation denial matrix |
| Admin/Platform | `/admin`, `/system` | guarded endpoints/dialog implementation | full invitation/config/version/audit/tenant CRUD browser + API tests |
| Release | contract configs/scripts | local isolated tests/build | lint, CI, generated types, remote dev/Preview smoke |

## คำสั่งตรวจซ้ำ

```sh
yarn tsc --noEmit --incremental false
yarn test
yarn test:harness
yarn test:database
yarn test:integration
NEXT_DIST_DIR=.next-contract-build yarn build
yarn lint
git diff --check
```

รันจาก root repository จริง ไม่ใช่ ChatGPT project mirror; ห้ามรัน database reset บน Care D เพื่อทดสอบ

ทุกชุดจบต้องอัปเดต IMPLEMENTATION_STATUS พร้อมผลจริง อย่าติ๊ก requirement ครบเพียงเพราะมีไฟล์หรือ build ผ่าน
