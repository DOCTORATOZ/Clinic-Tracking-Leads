-- Role Model foundation. Legacy admin/manager values remain in the enum for
-- historical compatibility but are migrated to clinic_admin memberships.

alter table public.clinics
  add column if not exists active boolean not null default true,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists updated_at timestamptz not null default now();

create table public.system_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason text
);

create table public.user_active_clinics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.membership_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  role public.app_role not null check (role in ('viewer', 'nurse', 'care_coordinator', 'clinic_admin')),
  status text not null check (status in ('invited', 'activated', 'failed', 'cancelled')),
  invited_by uuid not null references auth.users(id),
  auth_user_id uuid references auth.users(id),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index membership_invitations_active_email_idx
  on public.membership_invitations(clinic_id, lower(email))
  where status = 'invited';

create table public.tenant_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  action text not null check (action in ('tenant.suspended', 'tenant.activated')),
  actor_id uuid not null references auth.users(id),
  reason text,
  occurred_at timestamptz not null default now()
);

create table public.case_clinical_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  concern text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follow_up_clinical_details (
  result_id uuid primary key references public.follow_up_results(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  symptom_status text,
  clinical_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.follow_up_results
  add column if not exists coordination_summary text;
alter table public.follow_up_results
  alter column summary drop not null;

insert into public.case_clinical_details (case_id, clinic_id, concern)
select id, clinic_id, concern from public.cases where concern is not null
on conflict (case_id) do nothing;
update public.cases set concern = null where concern is not null;

insert into public.follow_up_clinical_details (result_id, clinic_id, symptom_status, clinical_summary)
select id, clinic_id, symptom_status, summary from public.follow_up_results
where symptom_status is not null or summary is not null
on conflict (result_id) do nothing;
update public.follow_up_results set symptom_status = null, summary = null
where symptom_status is not null or summary is not null;

update public.clinic_memberships set role = 'clinic_admin'
where active and role in ('admin', 'manager');

insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data)
select clinic_id, 'membership', user_id, 'membership.role_migrated', null,
  jsonb_build_object('nextRole', 'clinic_admin')
from public.clinic_memberships where role = 'clinic_admin';

create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  with eligible as (
    select m.clinic_id
    from public.clinic_memberships m
    join public.clinics c on c.id = m.clinic_id and c.active
    where m.user_id = auth.uid() and m.active
  ), selected as (
    select a.clinic_id from public.user_active_clinics a
    join eligible e on e.clinic_id = a.clinic_id
    where a.user_id = auth.uid()
  )
  select coalesce(
    (select clinic_id from selected limit 1),
    (select clinic_id from eligible where (select count(*) from eligible) = 1 limit 1)
  )
$$;

create or replace function public.has_clinic_role(required_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.clinic_memberships
    where clinic_id = public.current_clinic_id()
      and user_id = auth.uid() and active and role = any(required_roles)
  )
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.system_administrators where user_id = auth.uid() and active)
$$;

create or replace function public.set_tenant_lifecycle(target_clinic uuid, next_active boolean, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_system_admin() then raise exception 'FORBIDDEN'; end if;
  if next_active then
    update public.clinics set active = true, suspended_at = null, suspension_reason = null, updated_at = now() where id = target_clinic;
    if not found then raise exception 'CLINIC_NOT_FOUND'; end if;
    insert into public.tenant_lifecycle_events (clinic_id, action, actor_id, reason) values (target_clinic, 'tenant.activated', auth.uid(), reason);
  else
    if nullif(trim(coalesce(reason, '')), '') is null then raise exception 'SUSPENSION_REASON_REQUIRED'; end if;
    update public.clinics set active = false, suspended_at = now(), suspension_reason = reason, updated_at = now() where id = target_clinic;
    if not found then raise exception 'CLINIC_NOT_FOUND'; end if;
    insert into public.tenant_lifecycle_events (clinic_id, action, actor_id, reason) values (target_clinic, 'tenant.suspended', auth.uid(), reason);
  end if;
end $$;

create or replace function public.set_active_clinic(target_clinic uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not exists(
    select 1 from public.clinic_memberships m join public.clinics c on c.id = m.clinic_id
    where m.user_id = auth.uid() and m.clinic_id = target_clinic and m.active and c.active
  ) then raise exception 'FORBIDDEN'; end if;
  insert into public.user_active_clinics (user_id, clinic_id) values (auth.uid(), target_clinic)
  on conflict (user_id) do update set clinic_id = excluded.clinic_id, updated_at = now();
  return target_clinic;
end $$;

create or replace function public.list_my_active_clinics()
returns table (clinic_id uuid, clinic_name text, role public.app_role, selected boolean)
language sql stable security definer set search_path = public as $$
  select m.clinic_id, c.name, m.role,
    m.clinic_id = (select a.clinic_id from public.user_active_clinics a where a.user_id = auth.uid())
  from public.clinic_memberships m
  join public.clinics c on c.id = m.clinic_id
  where m.user_id = auth.uid() and m.active and c.active
  order by c.name
$$;

create or replace function public.prevent_last_clinic_admin_removal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.active and old.role = 'clinic_admin' and
    (tg_op = 'DELETE' or not new.active or new.role <> 'clinic_admin') and
    (select count(*) from public.clinic_memberships where clinic_id = old.clinic_id and active and role = 'clinic_admin') <= 1
  then raise exception 'LAST_CLINIC_ADMIN_REQUIRED'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists clinic_memberships_preserve_admin on public.clinic_memberships;
create trigger clinic_memberships_preserve_admin
before update of active, role or delete on public.clinic_memberships
for each row execute function public.prevent_last_clinic_admin_removal();

-- Care coordinators consume only explicitly projected operational data.
create or replace view public.coordination_cases
with (security_barrier = true) as
select c.id, c.clinic_id, c.case_number, c.state, c.priority, c.source_received_at,
  c.assigned_to, p.full_name, p.phone_normalized, s.label as source_label
from public.cases c
join public.patients p on p.id = c.patient_id
left join public.sources s on s.id = c.source_id
where c.clinic_id = public.current_clinic_id()
  and public.has_clinic_role(array['care_coordinator'::public.app_role, 'clinic_admin'::public.app_role]);

create or replace view public.platform_tenants
with (security_barrier = true) as
select c.id, c.name, c.timezone, c.active, c.suspended_at, c.suspension_reason, c.created_at, c.updated_at,
  (select count(*) from public.clinic_memberships m where m.clinic_id = c.id and m.active) as active_member_count
from public.clinics c
where public.is_system_admin();

create or replace view public.coordination_follow_up_results
with (security_barrier = true) as
select r.id, r.clinic_id, r.task_id, r.occurred_at, r.contact_channel,
  r.contact_status, r.outcome, r.coordination_summary, r.next_action,
  r.performed_by, r.reported_by, r.recorded_by, r.recorded_at
from public.follow_up_results r
where r.clinic_id = public.current_clinic_id()
  and public.has_clinic_role(array['care_coordinator'::public.app_role, 'clinic_admin'::public.app_role]);

create or replace view public.coordination_follow_up_tasks
with (security_barrier = true) as
select t.id, t.clinic_id, t.case_id, t.due_at, t.status, t.step_snapshot, t.assigned_to,
  c.case_number, p.full_name
from public.follow_up_tasks t
join public.cases c on c.id = t.case_id
join public.patients p on p.id = c.patient_id
where t.clinic_id = public.current_clinic_id()
  and public.has_clinic_role(array['care_coordinator'::public.app_role, 'clinic_admin'::public.app_role]);

alter table public.system_administrators enable row level security;
alter table public.user_active_clinics enable row level security;
alter table public.membership_invitations enable row level security;
alter table public.case_clinical_details enable row level security;
alter table public.follow_up_clinical_details enable row level security;
alter table public.tenant_lifecycle_events enable row level security;

create policy "users read own active clinic" on public.user_active_clinics
for select using (user_id = auth.uid());
create policy "users change own active clinic" on public.user_active_clinics
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "system admins read platform assignments" on public.system_administrators
for select using (public.is_system_admin());
create policy "clinic admins read invitations" on public.membership_invitations
for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role]));
create policy "clinic admins read clinical case details" on public.case_clinical_details
for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role, 'nurse'::public.app_role]));
create policy "clinic admins read clinical follow-up details" on public.follow_up_clinical_details
for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role, 'nurse'::public.app_role]));
create policy "system admins read tenant lifecycle" on public.tenant_lifecycle_events
for select using (public.is_system_admin());

grant select on public.coordination_cases, public.coordination_follow_up_results, public.coordination_follow_up_tasks, public.platform_tenants to authenticated;
grant execute on function public.set_active_clinic(uuid), public.list_my_active_clinics(), public.is_system_admin(), public.set_tenant_lifecycle(uuid, boolean, text) to authenticated;

-- Existing broad tenant policies are replaced for the main clinical tables.
drop policy if exists "tenant read cases" on public.cases;
drop policy if exists "tenant write cases" on public.cases;
drop policy if exists "nurse read cases" on public.cases;
create policy "clinic admins read cases" on public.cases for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role]));
create policy "nurses read assigned cases" on public.cases for select using (clinic_id = public.current_clinic_id() and assigned_to = auth.uid() and public.has_clinic_role(array['nurse'::public.app_role]));
create policy "clinic admins write cases" on public.cases for all using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role])) with check (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role]));

drop policy if exists "tenant read follow_up_results" on public.follow_up_results;
drop policy if exists "tenant write follow_up_results" on public.follow_up_results;
create policy "clinic admins read follow-up results" on public.follow_up_results for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role]));
create policy "nurses read assigned follow-up results" on public.follow_up_results for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['nurse'::public.app_role]) and exists (select 1 from public.follow_up_tasks t where t.id = task_id and t.assigned_to = auth.uid()));

do $$ declare tbl text; begin
  foreach tbl in array array['patients','sources','follow_up_plans','follow_up_plan_steps','service_catalog','case_assignments','follow_up_tasks','appointments','appointment_history','calendar_connections','calendar_event_links','calendar_sync_outbox','calendar_sync_logs','audit_events','operational_notifications'] loop
    execute format('drop policy if exists "tenant read %1$s" on public.%1$I', tbl);
    execute format('drop policy if exists "tenant write %1$s" on public.%1$I', tbl);
    execute format('create policy "clinic admin read %1$s" on public.%1$I for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array[''clinic_admin''::public.app_role]))', tbl);
    execute format('create policy "clinic admin write %1$s" on public.%1$I for all using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array[''clinic_admin''::public.app_role])) with check (clinic_id = public.current_clinic_id() and public.has_clinic_role(array[''clinic_admin''::public.app_role]))', tbl);
  end loop;
end $$;

create policy "care coordinators read sources" on public.sources for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['care_coordinator'::public.app_role]));
create policy "care coordinators read plans" on public.follow_up_plans for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['care_coordinator'::public.app_role]));
create policy "care coordinators read plan steps" on public.follow_up_plan_steps for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['care_coordinator'::public.app_role]));
create policy "care coordinators read services" on public.service_catalog for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['care_coordinator'::public.app_role]));
create policy "care coordinators read appointments" on public.appointments for select using (clinic_id = public.current_clinic_id() and public.has_clinic_role(array['care_coordinator'::public.app_role]));

create or replace function public.create_case_workflow_v2(
  p_clinic_id uuid, p_patient_decision jsonb, p_source_id uuid, p_service_id uuid,
  p_source_received_at timestamptz, p_concern text, p_priority text,
  p_assigned_to uuid, p_plan_id uuid, p_plan_override_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_patient_id uuid; v_case public.cases; v_prefix text; v_number integer; v_step record;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if p_patient_decision->>'kind' = 'link' then
    v_patient_id := (p_patient_decision->>'patientId')::uuid;
    if not exists(select 1 from public.patients where id = v_patient_id and clinic_id = p_clinic_id) then raise exception 'PATIENT_NOT_FOUND'; end if;
  else
    insert into public.patients (clinic_id, full_name, hn_normalized, phone_normalized, email, birth_date, preferred_contact_channel, do_not_contact, care_contact_consent_at, marketing_consent_at, consent_recorded_by)
    values (p_clinic_id, p_patient_decision->'patient'->>'fullName', nullif(p_patient_decision->'patient'->>'hn',''), nullif(p_patient_decision->'patient'->>'phone',''), nullif(p_patient_decision->'patient'->>'email',''), nullif(p_patient_decision->'patient'->>'birthDate','')::date, nullif(p_patient_decision->'patient'->>'preferredContactChannel',''), coalesce((p_patient_decision->'patient'->>'doNotContact')::boolean, false), nullif(p_patient_decision->'patient'->>'careContactConsentAt','')::timestamptz, nullif(p_patient_decision->'patient'->>'marketingConsentAt','')::timestamptz, auth.uid()) returning id into v_patient_id;
  end if;
  update public.clinics set case_number_next = case_number_next + 1, updated_at = now() where id = p_clinic_id returning case_number_prefix, case_number_next - 1 into v_prefix, v_number;
  insert into public.cases (clinic_id, patient_id, source_id, service_id, case_number, state, priority, source_received_at, assigned_to, selected_plan_id, plan_override_reason, created_by)
  values (p_clinic_id, v_patient_id, p_source_id, p_service_id, v_prefix || '-' || lpad(v_number::text, 5, '0'), case when p_assigned_to is null then 'new'::public.case_state else 'awaiting_nurse_call'::public.case_state end, p_priority, p_source_received_at, p_assigned_to, p_plan_id, p_plan_override_reason, auth.uid()) returning * into v_case;
  if nullif(p_concern, '') is not null then insert into public.case_clinical_details (case_id, clinic_id, concern) values (v_case.id, p_clinic_id, p_concern); end if;
  if p_plan_id is not null then for v_step in select id, sequence, day_offset, due_time, instruction from public.follow_up_plan_steps where clinic_id = p_clinic_id and plan_id = p_plan_id order by sequence loop
    insert into public.follow_up_tasks (clinic_id, case_id, plan_id, plan_step_id, step_snapshot, due_at, created_by)
    values (p_clinic_id, v_case.id, p_plan_id, v_step.id, jsonb_build_object('id', v_step.id, 'sequence', v_step.sequence, 'dayOffset', v_step.day_offset, 'dueTime', v_step.due_time, 'instruction', v_step.instruction), ((((p_source_received_at at time zone 'Asia/Bangkok')::date + v_step.day_offset) + v_step.due_time) at time zone 'Asia/Bangkok'), auth.uid());
  end loop; end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (p_clinic_id, 'case', v_case.id, 'case.created', auth.uid(), jsonb_build_object('caseNumber', v_case.case_number, 'patientId', v_patient_id, 'selectedPlanId', p_plan_id));
  return to_jsonb(v_case);
end $$;

create or replace function public.record_follow_up_result_workflow_v2(p_clinic_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_task public.follow_up_tasks; v_result public.follow_up_results;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role, 'nurse'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  select * into v_task from public.follow_up_tasks where id = (p_input->>'taskId')::uuid and clinic_id = p_clinic_id for update;
  if v_task.id is null or (public.has_clinic_role(array['nurse'::public.app_role]) and v_task.assigned_to is distinct from auth.uid()) then raise exception 'TASK_NOT_FOUND'; end if;
  insert into public.follow_up_results (clinic_id, task_id, occurred_at, contact_channel, contact_status, outcome, coordination_summary, next_action, performed_by, reported_by, recorded_by)
  values (p_clinic_id, v_task.id, (p_input->>'occurredAt')::timestamptz, p_input->>'contactChannel', p_input->>'contactStatus', p_input->>'outcome', coalesce(nullif(p_input->>'coordinationSummary',''), nullif(p_input->>'summary','')), nullif(p_input->>'nextAction',''), nullif(p_input->>'performedBy','')::uuid, nullif(p_input->>'reportedBy','')::uuid, auth.uid()) returning * into v_result;
  if public.has_clinic_role(array['nurse'::public.app_role]) and nullif(p_input->>'clinicalSummary','') is not null then insert into public.follow_up_clinical_details (result_id, clinic_id, symptom_status, clinical_summary) values (v_result.id, p_clinic_id, nullif(p_input->>'symptomStatus',''), p_input->>'clinicalSummary'); end if;
  if p_input->>'contactStatus' = 'contacted' then update public.follow_up_tasks set status = 'completed', completed_at = now() where id = v_task.id; end if;
  if nullif(p_input->>'retryDueAt','') is not null then insert into public.follow_up_tasks (clinic_id, case_id, due_at, step_snapshot, status, created_by) values (p_clinic_id, v_task.case_id, (p_input->>'retryDueAt')::timestamptz, jsonb_build_object('kind','manual_retry','sourceTaskId',v_task.id), 'pending', auth.uid()); end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (p_clinic_id, 'follow_up_result', v_result.id, 'follow_up.result_recorded', auth.uid(), jsonb_build_object('taskId', v_task.id, 'recordedBy', auth.uid()));
  return to_jsonb(v_result);
end $$;

create or replace function public.create_appointment_workflow_v2(p_clinic_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_appointment public.appointments;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.cases where id = (p_input->>'caseId')::uuid and clinic_id = p_clinic_id) then raise exception 'CASE_NOT_FOUND'; end if;
  insert into public.appointments (clinic_id, case_id, source_result_id, starts_at, ends_at, appointment_type, branch, provider_name, created_by)
  values (p_clinic_id, (p_input->>'caseId')::uuid, nullif(p_input->>'sourceResultId','')::uuid, (p_input->>'startsAt')::timestamptz, nullif(p_input->>'endsAt','')::timestamptz, p_input->>'appointmentType', nullif(p_input->>'branch',''), nullif(p_input->>'providerName',''), auth.uid()) returning * into v_appointment;
  update public.cases set state = 'appointment_scheduled', updated_at = now() where id = v_appointment.case_id;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (p_clinic_id, 'appointment', v_appointment.id, 'appointment.created', auth.uid(), jsonb_build_object('caseId', v_appointment.case_id));
  return to_jsonb(v_appointment);
end $$;

grant execute on function public.create_case_workflow_v2(uuid, jsonb, uuid, uuid, timestamptz, text, text, uuid, uuid, text), public.record_follow_up_result_workflow_v2(uuid, jsonb), public.create_appointment_workflow_v2(uuid, jsonb) to authenticated;
