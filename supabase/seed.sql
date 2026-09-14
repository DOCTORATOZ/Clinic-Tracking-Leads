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
