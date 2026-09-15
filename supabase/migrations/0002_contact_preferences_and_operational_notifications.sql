-- Phase 1 care-coordination additions. Consent for care contact is distinct
-- from optional future marketing consent; neither enables outbound messaging.
alter table public.patients
  add column if not exists preferred_contact_channel text,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists care_contact_consent_at timestamptz,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists consent_recorded_by uuid references auth.users(id);

create table public.operational_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task_overdue', 'appointment_due', 'calendar_sync_failed', 'needs_review')),
  title text not null,
  body text,
  case_id uuid references public.cases(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index operational_notifications_inbox_idx
  on public.operational_notifications(clinic_id, recipient_user_id, read_at, created_at desc);

alter table public.operational_notifications enable row level security;
create policy "tenant read operational notifications" on public.operational_notifications
  for select using (clinic_id = public.current_clinic_id());
create policy "tenant write operational notifications" on public.operational_notifications
  for all using (
    clinic_id = public.current_clinic_id()
    and public.has_clinic_role(array['admin'::public.app_role, 'manager'::public.app_role])
  ) with check (
    clinic_id = public.current_clinic_id()
    and public.has_clinic_role(array['admin'::public.app_role, 'manager'::public.app_role])
  );
