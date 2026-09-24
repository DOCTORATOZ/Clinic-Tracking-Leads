-- Complete the operational CRUD boundary. Clinical records remain append-only;
-- corrections are new records that point to the record they supersede.

alter table public.follow_up_results
  add column if not exists corrects_result_id uuid references public.follow_up_results(id),
  add column if not exists correction_reason text;

create index if not exists follow_up_results_corrects_result_idx
  on public.follow_up_results(corrects_result_id) where corrects_result_id is not null;

create or replace function public.require_workflow_role(allowed public.app_role[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.current_clinic_id();
begin
  if v_clinic is null or not public.has_clinic_role(allowed) then raise exception 'FORBIDDEN'; end if;
  return v_clinic;
end $$;

create or replace function public.update_patient_profile(p_patient_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]); v_before jsonb; v_patient public.patients;
begin
  select to_jsonb(p) into v_before from public.patients p where p.id = p_patient_id and p.clinic_id = v_clinic for update;
  if v_before is null then raise exception 'PATIENT_NOT_FOUND'; end if;
  update public.patients set full_name = coalesce(nullif(trim(p_input->>'fullName'), ''), full_name),
    hn_normalized = nullif(trim(coalesce(p_input->>'hn', hn_normalized)), ''),
    phone_normalized = nullif(trim(coalesce(p_input->>'phone', phone_normalized)), ''),
    email = nullif(trim(coalesce(p_input->>'email', email)), ''),
    birth_date = coalesce(nullif(p_input->>'birthDate', '')::date, birth_date), updated_at = now()
  where id = p_patient_id returning * into v_patient;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, before_data, after_data)
  values (v_clinic, 'patient', p_patient_id, 'patient.updated', auth.uid(), v_before, to_jsonb(v_patient));
  return to_jsonb(v_patient);
end $$;

create or replace function public.update_case_operational(p_case_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]); v_before jsonb; v_case public.cases;
begin
  select to_jsonb(c) into v_before from public.cases c where c.id = p_case_id and c.clinic_id = v_clinic for update;
  if v_before is null then raise exception 'CASE_NOT_FOUND'; end if;
  if (v_before->>'state') = 'closed' then raise exception 'CLOSED_CASE_READ_ONLY'; end if;
  if p_input ? 'sourceId' and p_input->>'sourceId' <> '' and not exists(select 1 from public.sources where id = (p_input->>'sourceId')::uuid and clinic_id = v_clinic) then raise exception 'SOURCE_NOT_FOUND'; end if;
  if p_input ? 'serviceId' and p_input->>'serviceId' <> '' and not exists(select 1 from public.service_catalog where id = (p_input->>'serviceId')::uuid and clinic_id = v_clinic) then raise exception 'SERVICE_NOT_FOUND'; end if;
  update public.cases set source_id = case when p_input ? 'sourceId' then nullif(p_input->>'sourceId','')::uuid else source_id end,
    service_id = case when p_input ? 'serviceId' then nullif(p_input->>'serviceId','')::uuid else service_id end,
    priority = case when p_input ? 'priority' then p_input->>'priority' else priority end,
    source_received_at = case when p_input ? 'sourceReceivedAt' then (p_input->>'sourceReceivedAt')::timestamptz else source_received_at end,
    updated_at = now() where id = p_case_id returning * into v_case;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, before_data, after_data)
  values (v_clinic, 'case', p_case_id, 'case.updated', auth.uid(), v_before, to_jsonb(v_case));
  return to_jsonb(v_case);
end $$;

create or replace function public.assign_case_nurse(p_case_id uuid, p_nurse_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]); v_previous uuid; v_case public.cases;
begin
  if not exists(select 1 from public.clinic_memberships where clinic_id = v_clinic and user_id = p_nurse_id and active and role = 'nurse') then raise exception 'NURSE_NOT_FOUND'; end if;
  select assigned_to into v_previous from public.cases where id = p_case_id and clinic_id = v_clinic and state <> 'closed' for update;
  if not found then raise exception 'CASE_NOT_FOUND'; end if;
  update public.cases set assigned_to = p_nurse_id, state = 'awaiting_nurse_call', updated_at = now() where id = p_case_id returning * into v_case;
  insert into public.case_assignments(clinic_id, case_id, assigned_to, assigned_by, reason) values(v_clinic, p_case_id, p_nurse_id, auth.uid(), nullif(trim(p_reason), ''));
  update public.follow_up_tasks set assigned_to = p_nurse_id where case_id = p_case_id and clinic_id = v_clinic and status in ('pending','in_progress','paused');
  insert into public.audit_events(clinic_id, entity_type, entity_id, action, actor_id, before_data, after_data, reason)
  values(v_clinic, 'case', p_case_id, 'case.nurse_assigned', auth.uid(), jsonb_build_object('assignedTo',v_previous), jsonb_build_object('assignedTo',p_nurse_id), nullif(trim(p_reason),''));
  return to_jsonb(v_case);
end $$;

create or replace function public.transition_case_lifecycle(p_case_id uuid, p_action text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role]); v_case public.cases; v_action text := lower(p_action);
begin
  select * into v_case from public.cases where id = p_case_id and clinic_id = v_clinic for update;
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  if v_action = 'close' then
    if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'CLOSURE_REASON_REQUIRED'; end if;
    update public.cases set state = 'closed', closed_reason = trim(p_reason), closed_at = now(), updated_at = now() where id = p_case_id returning * into v_case;
    update public.follow_up_tasks set status = 'cancelled', closure_reason = 'case_closed' where case_id = p_case_id and clinic_id = v_clinic and status in ('pending','in_progress','paused');
  elsif v_action = 'reopen' then
    if v_case.state <> 'closed' then raise exception 'CASE_NOT_CLOSED'; end if;
    update public.cases set state = 'follow_up_active', closed_reason = null, closed_at = null, updated_at = now() where id = p_case_id returning * into v_case;
  else raise exception 'INVALID_CASE_ACTION'; end if;
  insert into public.audit_events(clinic_id, entity_type, entity_id, action, actor_id, reason) values(v_clinic, 'case', p_case_id, 'case.' || v_action || 'd', auth.uid(), nullif(trim(p_reason),''));
  return to_jsonb(v_case);
end $$;

create or replace function public.transition_follow_up_task(p_task_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]); v_task public.follow_up_tasks; v_status public.task_status;
begin
  select * into v_task from public.follow_up_tasks where id = p_task_id and clinic_id = v_clinic for update;
  if v_task.id is null then raise exception 'TASK_NOT_FOUND'; end if;
  v_status := (p_input->>'status')::public.task_status;
  if v_status not in ('pending','in_progress','paused','cancelled') then raise exception 'INVALID_TASK_STATUS'; end if;
  if v_status in ('paused','cancelled') and nullif(trim(coalesce(p_input->>'reason','')), '') is null then raise exception 'TASK_REASON_REQUIRED'; end if;
  update public.follow_up_tasks set status = v_status,
    due_at = coalesce(nullif(p_input->>'dueAt','')::timestamptz, due_at),
    assigned_to = case when p_input ? 'assignedTo' then nullif(p_input->>'assignedTo','')::uuid else assigned_to end,
    closure_reason = case when v_status in ('paused','cancelled') then nullif(trim(p_input->>'reason'),'') else null end,
    completed_at = case when v_status = 'completed' then now() else completed_at end where id = p_task_id returning * into v_task;
  insert into public.audit_events(clinic_id, entity_type, entity_id, action, actor_id, reason) values(v_clinic, 'follow_up_task', p_task_id, 'follow_up_task.' || v_status, auth.uid(), nullif(trim(p_input->>'reason'),''));
  return to_jsonb(v_task);
end $$;

create or replace function public.create_manual_follow_up_task(p_case_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]); v_task public.follow_up_tasks;
begin
  if not exists(select 1 from public.cases where id = p_case_id and clinic_id = v_clinic and state <> 'closed') then raise exception 'CASE_NOT_FOUND'; end if;
  if nullif(trim(coalesce(p_input->>'dueAt','')), '') is null or nullif(trim(coalesce(p_input->>'label','')), '') is null then raise exception 'INVALID_TASK'; end if;
  insert into public.follow_up_tasks(clinic_id, case_id, due_at, assigned_to, step_snapshot, created_by)
  values(v_clinic, p_case_id, (p_input->>'dueAt')::timestamptz, nullif(p_input->>'assignedTo','')::uuid, jsonb_build_object('kind','manual','label',trim(p_input->>'label')), auth.uid()) returning * into v_task;
  insert into public.audit_events(clinic_id, entity_type, entity_id, action, actor_id) values(v_clinic, 'follow_up_task', v_task.id, 'follow_up_task.created', auth.uid());
  return to_jsonb(v_task);
end $$;

create or replace function public.transition_appointment_workflow_v2(p_appointment_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]); v_previous public.appointments; v_next public.appointment_status;
begin
  select * into v_previous from public.appointments where id = p_appointment_id and clinic_id = v_clinic for update;
  if v_previous.id is null then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
  v_next := coalesce(nullif(p_input->>'status','')::public.appointment_status, v_previous.status);
  if v_next in ('cancelled','no_show','rescheduled') and nullif(trim(coalesce(p_input->>'reason','')), '') is null then raise exception 'APPOINTMENT_REASON_REQUIRED'; end if;
  update public.appointments set starts_at = coalesce(nullif(p_input->>'startsAt','')::timestamptz, starts_at), ends_at = coalesce(nullif(p_input->>'endsAt','')::timestamptz, ends_at),
    appointment_type = coalesce(nullif(trim(p_input->>'appointmentType'),''), appointment_type), branch = coalesce(nullif(trim(p_input->>'branch'),''), branch),
    provider_name = coalesce(nullif(trim(p_input->>'providerName'),''), provider_name), status = v_next, lifecycle_reason = nullif(trim(p_input->>'reason'),''), updated_at = now()
  where id = p_appointment_id;
  insert into public.appointment_history(clinic_id, appointment_id, previous_status, next_status, reason, changed_by) values(v_clinic, p_appointment_id, v_previous.status, v_next, nullif(trim(p_input->>'reason'),''), auth.uid());
  insert into public.audit_events(clinic_id, entity_type, entity_id, action, actor_id, reason) values(v_clinic, 'appointment', p_appointment_id, 'appointment.' || v_next, auth.uid(), nullif(trim(p_input->>'reason'),''));
  return (select to_jsonb(a) from public.appointments a where a.id = p_appointment_id);
end $$;

create or replace function public.add_follow_up_result_correction(p_result_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role, 'nurse'::public.app_role]); v_original public.follow_up_results; v_new public.follow_up_results;
begin
  select * into v_original from public.follow_up_results where id = p_result_id and clinic_id = v_clinic for update;
  if v_original.id is null then raise exception 'RESULT_NOT_FOUND'; end if;
  if nullif(trim(coalesce(p_input->>'reason','')), '') is null then raise exception 'CORRECTION_REASON_REQUIRED'; end if;
  if public.has_clinic_role(array['nurse'::public.app_role]) and not exists(select 1 from public.follow_up_tasks where id = v_original.task_id and assigned_to = auth.uid()) then raise exception 'TASK_NOT_FOUND'; end if;
  insert into public.follow_up_results(clinic_id, task_id, occurred_at, contact_channel, contact_status, outcome, coordination_summary, next_action, performed_by, reported_by, recorded_by, corrects_result_id, correction_reason)
  values(v_clinic, v_original.task_id, coalesce(nullif(p_input->>'occurredAt','')::timestamptz, v_original.occurred_at), coalesce(nullif(p_input->>'contactChannel',''),v_original.contact_channel), coalesce(nullif(p_input->>'contactStatus',''),v_original.contact_status), coalesce(nullif(p_input->>'outcome',''),v_original.outcome), coalesce(nullif(p_input->>'summary',''),v_original.coordination_summary), coalesce(nullif(p_input->>'nextAction',''),v_original.next_action), v_original.performed_by, v_original.reported_by, auth.uid(), v_original.id, trim(p_input->>'reason')) returning * into v_new;
  insert into public.audit_events(clinic_id, entity_type, entity_id, action, actor_id, reason, after_data) values(v_clinic, 'follow_up_result', v_new.id, 'follow_up_result.corrected', auth.uid(), trim(p_input->>'reason'), jsonb_build_object('correctsResultId',v_original.id));
  return to_jsonb(v_new);
end $$;

grant execute on function public.update_patient_profile(uuid,jsonb), public.update_case_operational(uuid,jsonb), public.assign_case_nurse(uuid,uuid,text), public.transition_case_lifecycle(uuid,text,text), public.transition_follow_up_task(uuid,jsonb), public.create_manual_follow_up_task(uuid,jsonb), public.transition_appointment_workflow_v2(uuid,jsonb), public.add_follow_up_result_correction(uuid,jsonb) to authenticated;

-- Nurse screens receive only records assigned to the authenticated nurse.  The
-- views deliberately project operational identity fields, not coordination or
-- clinical free text belonging to another case.
create or replace view public.nurse_cases with (security_barrier = true) as
select c.id, c.clinic_id, c.case_number, c.state, c.priority, c.source_received_at, c.assigned_to,
  p.full_name, p.hn_normalized, p.phone_normalized, s.label as source_label,
  svc.name as service_name, c.selected_plan_id
from public.cases c join public.patients p on p.id = c.patient_id
left join public.sources s on s.id = c.source_id left join public.service_catalog svc on svc.id = c.service_id
where c.clinic_id = public.current_clinic_id() and c.assigned_to = auth.uid()
  and public.has_clinic_role(array['nurse'::public.app_role]);

create or replace view public.nurse_follow_up_tasks with (security_barrier = true) as
select t.id, t.clinic_id, t.case_id, t.due_at, t.status, t.step_snapshot, t.assigned_to,
  c.case_number, p.full_name
from public.follow_up_tasks t join public.cases c on c.id = t.case_id join public.patients p on p.id = c.patient_id
where t.clinic_id = public.current_clinic_id() and t.assigned_to = auth.uid()
  and public.has_clinic_role(array['nurse'::public.app_role]);

create or replace view public.nurse_appointments with (security_barrier = true) as
select a.id, a.clinic_id, a.case_id, a.starts_at, a.ends_at, a.appointment_type, a.branch, a.provider_name, a.status,
  c.case_number, p.full_name
from public.appointments a join public.cases c on c.id = a.case_id join public.patients p on p.id = c.patient_id
where a.clinic_id = public.current_clinic_id() and c.assigned_to = auth.uid()
  and public.has_clinic_role(array['nurse'::public.app_role]);

grant select on public.nurse_cases, public.nurse_follow_up_tasks, public.nurse_appointments to authenticated;

create or replace view public.clinic_nurse_directory with (security_barrier = true) as
select user_id, display_name from public.clinic_memberships
where clinic_id = public.current_clinic_id() and active and role = 'nurse'
  and public.has_clinic_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]);
grant select on public.clinic_nurse_directory to authenticated;

create or replace view public.coordination_cases with (security_barrier = true) as
select c.id, c.clinic_id, c.case_number, c.state, c.priority, c.source_received_at,
  c.assigned_to, p.full_name, p.phone_normalized, s.label as source_label, svc.name as service_name
from public.cases c join public.patients p on p.id = c.patient_id
left join public.sources s on s.id = c.source_id left join public.service_catalog svc on svc.id = c.service_id
where c.clinic_id = public.current_clinic_id()
  and public.has_clinic_role(array['care_coordinator'::public.app_role, 'clinic_admin'::public.app_role]);
