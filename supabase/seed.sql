-- Development-only reference data. Create auth users and memberships in the
-- Supabase dashboard/CLI; no password or production identity is seeded here.
insert into public.clinics (id, name, timezone, case_number_prefix, case_number_next)
values ('11111111-1111-1111-1111-111111111111', 'Care D Clinic (development)', 'Asia/Bangkok', 'CD', 24091)
on conflict (id) do nothing;

insert into public.sources (clinic_id, code, label) values
  ('11111111-1111-1111-1111-111111111111', 'facebook', 'Facebook'),
  ('11111111-1111-1111-1111-111111111111', 'line_oa', 'LINE OA'),
  ('11111111-1111-1111-1111-111111111111', 'tiktok', 'TikTok'),
  ('11111111-1111-1111-1111-111111111111', 'phone', 'Phone'),
  ('11111111-1111-1111-1111-111111111111', 'other', 'Other')
on conflict (clinic_id, code) do nothing;

with plan as (
  insert into public.follow_up_plans (id, clinic_id, name) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Standard Day 1/3/7/14/30')
  on conflict do nothing returning id
)
insert into public.follow_up_plan_steps (clinic_id, plan_id, sequence, day_offset, due_time, instruction)
select '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', v.sequence, v.day_offset, '10:00', 'ติดตามตามแผนมาตรฐาน'
from (values (1, 1), (2, 3), (3, 7), (4, 14), (5, 30)) as v(sequence, day_offset)
on conflict (plan_id, sequence) do nothing;

-- Development-only operational fixtures migrated from the original prototype.
insert into public.patients (id, clinic_id, full_name, hn_normalized, phone_normalized) values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'สมฤดี มณี', 'HN-24082', '0812345678'),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'นลินี ศรีสุข', 'HN-24091', '0823456789'),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'ธนวัฒน์ วงศ์ดี', 'HN-24093', '0834567890')
on conflict (id) do nothing;

insert into public.cases (id, clinic_id, patient_id, source_id, case_number, state, priority, source_received_at) values
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001', (select id from public.sources where clinic_id = '11111111-1111-1111-1111-111111111111' and code = 'phone'), 'CD-24082', 'follow_up_active', 'normal', '2026-08-04 02:30:00+00'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002', (select id from public.sources where clinic_id = '11111111-1111-1111-1111-111111111111' and code = 'line_oa'), 'CD-24091', 'appointment_scheduled', 'normal', '2026-08-19 03:00:00+00'),
  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000003', (select id from public.sources where clinic_id = '11111111-1111-1111-1111-111111111111' and code = 'facebook'), 'CD-24093', 'follow_up_active', 'high', '2026-09-10 09:00:00+00')
on conflict (id) do nothing;

insert into public.follow_up_tasks (id, clinic_id, case_id, plan_id, step_snapshot, due_at, status) values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '{"label":"Day 30","sequence":5}', '2026-09-02 03:30:00+00', 'pending'),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '{"label":"Day 3","sequence":2}', '2026-09-11 04:00:00+00', 'pending'),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '{"label":"Day 7","sequence":3}', '2026-09-20 04:30:00+00', 'pending')
on conflict (id) do nothing;

insert into public.appointments (id, clinic_id, case_id, starts_at, ends_at, appointment_type, provider_name, status) values
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000001', '2026-08-05 02:30:00+00', '2026-08-05 03:00:00+00', 'ประเมินหลอดเลือด', 'พยาบาลณิชา', 'scheduled'),
  ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '40000000-0000-0000-0000-000000000003', '2026-09-11 09:30:00+00', '2026-09-11 10:00:00+00', 'ประเมินเส้นฟอกไต', 'พยาบาลณิชา', 'scheduled')
on conflict (id) do nothing;
