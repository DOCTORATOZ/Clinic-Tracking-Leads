-- Domain mutations are single database transactions so an operational record
-- and its audit/history cannot be only partially persisted.
create or replace function public.create_case_workflow(
  p_clinic_id uuid,
  p_patient_decision jsonb,
  p_source_id uuid,
  p_service_id uuid,
  p_source_received_at timestamptz,
  p_concern text,
  p_priority text,
  p_assigned_to uuid,
  p_plan_id uuid,
  p_plan_override_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_patient_id uuid; v_case public.cases; v_prefix text; v_number integer; v_step record;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['admin'::public.app_role, 'manager'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if p_patient_decision->>'kind' = 'link' then
    v_patient_id := (p_patient_decision->>'patientId')::uuid;
    if not exists(select 1 from public.patients where id = v_patient_id and clinic_id = p_clinic_id) then raise exception 'PATIENT_NOT_FOUND'; end if;
  else
    insert into public.patients (clinic_id, full_name, hn_normalized, phone_normalized, email, birth_date, preferred_contact_channel, do_not_contact, care_contact_consent_at, marketing_consent_at, consent_recorded_by)
    values (p_clinic_id, p_patient_decision->'patient'->>'fullName', nullif(p_patient_decision->'patient'->>'hn',''), nullif(p_patient_decision->'patient'->>'phone',''), nullif(p_patient_decision->'patient'->>'email',''), nullif(p_patient_decision->'patient'->>'birthDate','')::date, nullif(p_patient_decision->'patient'->>'preferredContactChannel',''), coalesce((p_patient_decision->'patient'->>'doNotContact')::boolean, false), nullif(p_patient_decision->'patient'->>'careContactConsentAt','')::timestamptz, nullif(p_patient_decision->'patient'->>'marketingConsentAt','')::timestamptz, auth.uid()) returning id into v_patient_id;
  end if;
  update public.clinics set case_number_next = case_number_next + 1 where id = p_clinic_id returning case_number_prefix, case_number_next - 1 into v_prefix, v_number;
  if v_number is null then raise exception 'CLINIC_CONTEXT_NOT_FOUND'; end if;
  insert into public.cases (clinic_id, patient_id, source_id, service_id, case_number, state, priority, source_received_at, concern, assigned_to, selected_plan_id, plan_override_reason, created_by)
  values (p_clinic_id, v_patient_id, p_source_id, p_service_id, v_prefix || '-' || lpad(v_number::text, 5, '0'), case when p_assigned_to is null then 'new'::public.case_state else 'awaiting_nurse_call'::public.case_state end, p_priority, p_source_received_at, p_concern, p_assigned_to, p_plan_id, p_plan_override_reason, auth.uid()) returning * into v_case;
  if p_plan_id is not null then
    for v_step in select id, sequence, day_offset, due_time, instruction from public.follow_up_plan_steps where clinic_id = p_clinic_id and plan_id = p_plan_id order by sequence loop
      insert into public.follow_up_tasks (clinic_id, case_id, plan_id, plan_step_id, step_snapshot, due_at, created_by)
      values (p_clinic_id, v_case.id, p_plan_id, v_step.id, jsonb_build_object('id', v_step.id, 'sequence', v_step.sequence, 'dayOffset', v_step.day_offset, 'dueTime', v_step.due_time, 'instruction', v_step.instruction), ((((p_source_received_at at time zone 'Asia/Bangkok')::date + v_step.day_offset) + v_step.due_time) at time zone 'Asia/Bangkok'), auth.uid());
    end loop;
  end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, reason, after_data) values (p_clinic_id, 'case', v_case.id, 'case.created', auth.uid(), p_patient_decision->>'duplicateReason', jsonb_build_object('caseNumber', v_case.case_number, 'patientId', v_patient_id, 'selectedPlanId', p_plan_id));
  return to_jsonb(v_case);
end $$;

grant execute on function public.create_case_workflow(uuid, jsonb, uuid, uuid, timestamptz, text, text, uuid, uuid, text) to authenticated;
