-- Clinic Tracking Leads: production foundation
-- Every tenant-owned table has clinic_id and RLS is enabled in this migration.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'manager', 'nurse', 'viewer');
create type public.case_state as enum ('new', 'awaiting_nurse_call', 'contact_in_progress', 'follow_up_active', 'appointment_scheduled', 'closed');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'paused', 'skipped', 'cancelled');
create type public.appointment_status as enum ('scheduled', 'completed', 'rescheduled', 'cancelled', 'no_show');
create type public.calendar_sync_status as enum ('disabled', 'pending', 'synced', 'failed', 'needs_review');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Bangkok',
  case_number_prefix text not null default 'CD',
  case_number_next integer not null default 1 check (case_number_next > 0),
  created_at timestamptz not null default now()
);

create table public.clinic_memberships (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  hn_normalized text,
  full_name text not null,
  phone_normalized text,
  email text,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_clinic_hn_idx on public.patients(clinic_id, hn_normalized) where hn_normalized is not null;
create index patients_clinic_phone_idx on public.patients(clinic_id, phone_normalized) where phone_normalized is not null;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  code text not null,
  label text not null,
  active boolean not null default true,
  unique (clinic_id, code)
);

create table public.follow_up_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (clinic_id, name, version)
);
create table public.follow_up_plan_steps (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid not null references public.follow_up_plans(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  day_offset integer not null check (day_offset >= 0),
  due_time time not null default '10:00',
  instruction text,
  unique (plan_id, sequence)
);

create table public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  code text not null,
  name text not null,
  default_follow_up_plan_id uuid references public.follow_up_plans(id) on delete set null,
  active boolean not null default true,
  unique (clinic_id, code)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  source_id uuid references public.sources(id),
  service_id uuid references public.service_catalog(id),
  case_number text not null,
  state public.case_state not null default 'new',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  source_received_at timestamptz not null default now(),
  concern text,
  assigned_to uuid references auth.users(id),
  selected_plan_id uuid references public.follow_up_plans(id),
  plan_override_reason text,
  closed_reason text,
  closed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, case_number)
);
create index cases_clinic_patient_idx on public.cases(clinic_id, patient_id);
create index cases_clinic_state_idx on public.cases(clinic_id, state);

create table public.case_assignments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  assigned_to uuid not null references auth.users(id),
  assigned_by uuid references auth.users(id),
  reason text,
  assigned_at timestamptz not null default now()
);

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  plan_id uuid references public.follow_up_plans(id) on delete set null,
  plan_step_id uuid references public.follow_up_plan_steps(id) on delete set null,
  step_snapshot jsonb not null,
  due_at timestamptz not null,
  status public.task_status not null default 'pending',
  assigned_to uuid references auth.users(id),
  closure_reason text,
  created_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index follow_up_tasks_queue_idx on public.follow_up_tasks(clinic_id, status, due_at);

create table public.follow_up_results (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  task_id uuid not null references public.follow_up_tasks(id) on delete cascade,
  occurred_at timestamptz not null,
  contact_channel text not null,
  contact_status text not null,
  outcome text not null,
  symptom_status text,
  summary text not null,
  next_action text,
  performed_by uuid references auth.users(id),
  reported_by uuid references auth.users(id),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  source_result_id uuid references public.follow_up_results(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  appointment_type text not null,
  branch text,
  provider_name text,
  status public.appointment_status not null default 'scheduled',
  lifecycle_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_calendar_idx on public.appointments(clinic_id, starts_at, status);
create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  previous_status public.appointment_status,
  next_status public.appointment_status not null,
  reason text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  provider text not null default 'google',
  destination_calendar_id text,
  encrypted_token_reference text,
  status public.calendar_sync_status not null default 'disabled',
  connected_by uuid references auth.users(id),
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'appointment')),
  entity_id uuid not null,
  provider text not null default 'google',
  external_event_id text,
  idempotency_key text not null,
  sync_status public.calendar_sync_status not null default 'pending',
  external_etag text,
  unique (clinic_id, provider, idempotency_key),
  unique (clinic_id, provider, external_event_id)
);
create table public.calendar_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'appointment')),
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'cancel')),
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'needs_review')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  unique (clinic_id, idempotency_key, operation)
);
create table public.calendar_sync_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  outbox_id uuid references public.calendar_sync_outbox(id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  outcome text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references auth.users(id),
  reason text,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_timeline_idx on public.audit_events(clinic_id, entity_type, entity_id, occurred_at desc);

create or replace function public.current_clinic_id() returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.clinic_memberships where user_id = auth.uid() and active limit 1
$$;
create or replace function public.has_clinic_role(required_roles public.app_role[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.clinic_memberships where clinic_id = public.current_clinic_id() and user_id = auth.uid() and active and role = any(required_roles))
$$;
create or replace function public.next_case_number(target_clinic uuid) returns text language plpgsql security definer set search_path = public as $$
declare next_value integer; prefix_value text;
begin
  update public.clinics set case_number_next = case_number_next + 1 where id = target_clinic returning case_number_next - 1, case_number_prefix into next_value, prefix_value;
  if next_value is null then raise exception 'clinic not found'; end if;
  return prefix_value || '-' || lpad(next_value::text, 5, '0');
end $$;

alter table public.clinics enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.patients enable row level security;
alter table public.sources enable row level security;
alter table public.follow_up_plans enable row level security;
alter table public.follow_up_plan_steps enable row level security;
alter table public.service_catalog enable row level security;
alter table public.cases enable row level security;
alter table public.case_assignments enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.follow_up_results enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_event_links enable row level security;
alter table public.calendar_sync_outbox enable row level security;
alter table public.calendar_sync_logs enable row level security;
alter table public.audit_events enable row level security;

create policy "members read their clinic" on public.clinics for select using (id = public.current_clinic_id());
create policy "members read memberships" on public.clinic_memberships for select using (clinic_id = public.current_clinic_id());

do $$ declare tbl text; begin
  foreach tbl in array array['patients','sources','follow_up_plans','follow_up_plan_steps','service_catalog','cases','case_assignments','follow_up_tasks','follow_up_results','appointments','appointment_history','calendar_connections','calendar_event_links','calendar_sync_outbox','calendar_sync_logs','audit_events'] loop
    execute format('create policy "tenant read %1$s" on public.%1$I for select using (clinic_id = public.current_clinic_id())', tbl);
    execute format('create policy "tenant write %1$s" on public.%1$I for all using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array[''admin''::public.app_role,''manager''::public.app_role])) with check (clinic_id = public.current_clinic_id() and public.has_clinic_role(array[''admin''::public.app_role,''manager''::public.app_role]))', tbl);
  end loop;
end $$;

-- Nurses may read operational data, while mutations are performed through
-- service-role domain services after explicit membership checks.
create policy "nurse read cases" on public.cases for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['nurse'::public.app_role]));
create policy "nurse read tasks" on public.follow_up_tasks for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['nurse'::public.app_role]));
