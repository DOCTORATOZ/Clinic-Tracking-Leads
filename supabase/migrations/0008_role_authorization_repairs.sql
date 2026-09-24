-- Role-specific operational helpers and guardrails added after the foundation.
create or replace function public.find_coordination_patient_matches(p_hn text default null, p_phone text default null)
returns table (id uuid, full_name text, hn_normalized text, phone_normalized text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_clinic_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  return query select p.id, p.full_name, p.hn_normalized, p.phone_normalized, p.created_at
  from public.patients p
  where p.clinic_id = public.current_clinic_id()
    and ((nullif(p_hn, '') is not null and p.hn_normalized = p_hn) or (nullif(p_phone, '') is not null and p.phone_normalized = p_phone))
  order by p.created_at desc;
end $$;

create or replace function public.update_clinic_membership(
  target_user uuid, next_role public.app_role, next_active boolean, change_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.current_clinic_id(); v_previous public.clinic_memberships;
begin
  if v_clinic is null or not public.has_clinic_role(array['clinic_admin'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if target_user = auth.uid() then raise exception 'SELF_ROLE_CHANGE_FORBIDDEN'; end if;
  if next_role not in ('viewer', 'nurse', 'care_coordinator', 'clinic_admin') then raise exception 'INVALID_CLINIC_ROLE'; end if;
  select * into v_previous from public.clinic_memberships where clinic_id = v_clinic and user_id = target_user for update;
  if v_previous.user_id is null then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  update public.clinic_memberships set role = next_role, active = next_active where clinic_id = v_clinic and user_id = target_user;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, reason, before_data, after_data)
  values (v_clinic, 'membership', target_user, 'membership.updated', auth.uid(), change_reason,
    jsonb_build_object('role', v_previous.role, 'active', v_previous.active),
    jsonb_build_object('role', next_role, 'active', next_active));
end $$;

create or replace function public.record_follow_up_result_workflow_v2(p_clinic_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_task public.follow_up_tasks; v_result public.follow_up_results; v_performed_by uuid := nullif(p_input->>'performedBy','')::uuid; v_reported_by uuid := nullif(p_input->>'reportedBy','')::uuid;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['clinic_admin'::public.app_role, 'care_coordinator'::public.app_role, 'nurse'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  select * into v_task from public.follow_up_tasks where id = (p_input->>'taskId')::uuid and clinic_id = p_clinic_id for update;
  if v_task.id is null or (public.has_clinic_role(array['nurse'::public.app_role]) and v_task.assigned_to is distinct from auth.uid()) then raise exception 'TASK_NOT_FOUND'; end if;
  if public.has_clinic_role(array['nurse'::public.app_role]) then
    if (v_performed_by is not null and v_performed_by <> auth.uid()) or (v_reported_by is not null and v_reported_by <> auth.uid()) then raise exception 'NURSE_ATTRIBUTION_REQUIRED'; end if;
    v_performed_by := auth.uid(); v_reported_by := auth.uid();
  elsif (v_performed_by is not null and not exists (
    select 1 from public.clinic_memberships m where m.clinic_id = p_clinic_id and m.active and m.role = 'nurse' and m.user_id = v_performed_by
  )) or (v_reported_by is not null and not exists (
    select 1 from public.clinic_memberships m where m.clinic_id = p_clinic_id and m.active and m.role = 'nurse' and m.user_id = v_reported_by
  )) then raise exception 'NURSE_REPORTER_REQUIRED';
  end if;
  insert into public.follow_up_results (clinic_id, task_id, occurred_at, contact_channel, contact_status, outcome, coordination_summary, next_action, performed_by, reported_by, recorded_by)
  values (p_clinic_id, v_task.id, (p_input->>'occurredAt')::timestamptz, p_input->>'contactChannel', p_input->>'contactStatus', p_input->>'outcome', coalesce(nullif(p_input->>'coordinationSummary',''), nullif(p_input->>'summary','')), nullif(p_input->>'nextAction',''), v_performed_by, v_reported_by, auth.uid()) returning * into v_result;
  if public.has_clinic_role(array['nurse'::public.app_role]) and nullif(p_input->>'clinicalSummary','') is not null then insert into public.follow_up_clinical_details (result_id, clinic_id, symptom_status, clinical_summary) values (v_result.id, p_clinic_id, nullif(p_input->>'symptomStatus',''), p_input->>'clinicalSummary'); end if;
  if p_input->>'contactStatus' = 'contacted' then update public.follow_up_tasks set status = 'completed', completed_at = now() where id = v_task.id; end if;
  if nullif(p_input->>'retryDueAt','') is not null then insert into public.follow_up_tasks (clinic_id, case_id, due_at, step_snapshot, status, created_by) values (p_clinic_id, v_task.case_id, (p_input->>'retryDueAt')::timestamptz, jsonb_build_object('kind','manual_retry','sourceTaskId',v_task.id), 'pending', auth.uid()); end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (p_clinic_id, 'follow_up_result', v_result.id, 'follow_up.result_recorded', auth.uid(), jsonb_build_object('taskId', v_task.id, 'performedBy', v_performed_by, 'reportedBy', v_reported_by, 'recordedBy', auth.uid()));
  return to_jsonb(v_result);
end $$;

grant execute on function public.find_coordination_patient_matches(text, text), public.update_clinic_membership(uuid, public.app_role, boolean, text), public.record_follow_up_result_workflow_v2(uuid, jsonb) to authenticated;
