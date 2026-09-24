-- Development-only reference data. Create auth users and memberships in the
-- Supabase dashboard/CLI; no password or production identity is seeded here.
insert into public.clinics (id, name, timezone, case_number_prefix, case_number_next)
values ('11111111-1111-1111-1111-111111111111', 'Care D Clinic · One Day Surgery (development)', 'Asia/Bangkok', 'CDS', 24094)
on conflict (id) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  case_number_prefix = excluded.case_number_prefix,
  case_number_next = excluded.case_number_next;

insert into public.sources (clinic_id, code, label) values
  ('11111111-1111-1111-1111-111111111111', 'facebook', 'Facebook'),
  ('11111111-1111-1111-1111-111111111111', 'line_oa', 'LINE OA'),
  ('11111111-1111-1111-1111-111111111111', 'phone', 'โทรศัพท์'),
  ('11111111-1111-1111-1111-111111111111', 'referral', 'ส่งต่อจากโรงพยาบาล'),
  ('11111111-1111-1111-1111-111111111111', 'walk_in', 'Walk-in')
on conflict (clinic_id, code) do nothing;

with plan as (
  insert into public.follow_up_plans (id, clinic_id, name) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'ติดตามหลัง One Day Surgery 1/3/7/14/30 วัน')
  on conflict (id) do update set name = excluded.name returning id
)
insert into public.follow_up_plan_steps (clinic_id, plan_id, sequence, day_offset, due_time, instruction)
select '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', v.sequence, v.day_offset, '10:00', v.instruction
from (values
  (1, 1, 'ประเมินอาการและแผลหลังทำหัตถการ'),
  (2, 3, 'ติดตามการฟื้นตัว'),
  (3, 7, 'ยืนยันผลและคำแนะนำ'),
  (4, 14, 'ติดตามต่อเนื่อง'),
  (5, 30, 'สรุปผลการดูแล')
) as v(sequence, day_offset, instruction)
on conflict (plan_id, sequence) do update set
  day_offset = excluded.day_offset,
  due_time = excluded.due_time,
  instruction = excluded.instruction;

insert into public.service_catalog (id, clinic_id, code, name, default_follow_up_plan_id, active)
values (
  '23333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'one_day_vascular_procedure',
  'One Day Surgery · หัตถการหลอดเลือด',
  '22222222-2222-2222-2222-222222222222',
  true
)
on conflict (clinic_id, code) do update set
  name = excluded.name,
  default_follow_up_plan_id = excluded.default_follow_up_plan_id,
  active = true;

-- Development-only operational fixtures migrated from the original prototype.
insert into public.patients (id, clinic_id, full_name, hn_normalized, phone_normalized) values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'สมฤดี มณี', 'HN-24082', '0812345678'),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'นลินี ศรีสุข', 'HN-24091', '0823456789'),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'ธนวัฒน์ วงศ์ดี', 'HN-24093', '0834567890')
on conflict (id) do nothing;

insert into public.cases (id, clinic_id, patient_id, source_id, service_id, selected_plan_id, case_number, state, priority, source_received_at) values
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001', (select id from public.sources where clinic_id = '11111111-1111-1111-1111-111111111111' and code = 'phone'), '23333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'CDS-24091', 'follow_up_active', 'normal', now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002', (select id from public.sources where clinic_id = '11111111-1111-1111-1111-111111111111' and code = 'line_oa'), '23333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'CDS-24092', 'appointment_scheduled', 'normal', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000003', (select id from public.sources where clinic_id = '11111111-1111-1111-1111-111111111111' and code = 'facebook'), '23333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'CDS-24093', 'awaiting_nurse_call', 'high', now() - interval '1 day')
on conflict (id) do update set
  source_id = excluded.source_id,
  service_id = excluded.service_id,
  selected_plan_id = excluded.selected_plan_id,
  case_number = excluded.case_number,
  state = excluded.state,
  priority = excluded.priority,
  source_received_at = excluded.source_received_at;

insert into public.follow_up_tasks (id, clinic_id, case_id, plan_id, step_snapshot, due_at, status) values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '{"label":"ประเมินอาการและแผลหลังทำหัตถการ","sequence":1}', now() - interval '1 day', 'pending'),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '{"label":"ยืนยันนัดเพื่อทำหัตถการ","sequence":0}', date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok' + interval '13 hours', 'pending'),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '{"label":"โทรคัดกรองและให้คำแนะนำก่อนหัตถการ","sequence":0}', now() + interval '3 days', 'pending')
on conflict (id) do update set
  step_snapshot = excluded.step_snapshot,
  due_at = excluded.due_at,
  status = excluded.status;

insert into public.appointments (id, clinic_id, case_id, starts_at, ends_at, appointment_type, provider_name, status) values
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000002', now() + interval '1 day' + interval '3 hours', now() + interval '1 day' + interval '4 hours', 'ประเมินก่อนทำหัตถการ', 'พยาบาลณิชา', 'scheduled'),
  ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000001', now() + interval '5 days' + interval '7 hours', now() + interval '5 days' + interval '8 hours', 'ตรวจติดตามหลังหัตถการ', 'พยาบาลณิชา', 'scheduled')
on conflict (id) do update set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  appointment_type = excluded.appointment_type,
  provider_name = excluded.provider_name,
  status = excluded.status;
