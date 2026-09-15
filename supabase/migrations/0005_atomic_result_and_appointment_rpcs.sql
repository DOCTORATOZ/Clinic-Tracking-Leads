create or replace function public.record_follow_up_result_workflow(p_clinic_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_task public.follow_up_tasks; v_result public.follow_up_results;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['admin'::public.app_role, 'manager'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  select * into v_task from public.follow_up_tasks where id = (p_input->>'taskId')::uuid and clinic_id = p_clinic_id for update;
  if v_task.id is null then raise exception 'TASK_NOT_FOUND'; end if;
  insert into public.follow_up_results (clinic_id, task_id, occurred_at, contact_channel, contact_status, outcome, symptom_status, summary, next_action, performed_by, reported_by, recorded_by)
  values (p_clinic_id, v_task.id, (p_input->>'occurredAt')::timestamptz, p_input->>'contactChannel', p_input->>'contactStatus', p_input->>'outcome', nullif(p_input->>'symptomStatus',''), p_input->>'summary', nullif(p_input->>'nextAction',''), nullif(p_input->>'performedBy','')::uuid, nullif(p_input->>'reportedBy','')::uuid, auth.uid()) returning * into v_result;
  if p_input->>'contactStatus' = 'contacted' then update public.follow_up_tasks set status = 'completed', completed_at = now() where id = v_task.id; end if;
  if nullif(p_input->>'retryDueAt','') is not null then insert into public.follow_up_tasks (clinic_id, case_id, due_at, step_snapshot, status, created_by) values (p_clinic_id, v_task.case_id, (p_input->>'retryDueAt')::timestamptz, jsonb_build_object('kind','manual_retry','sourceTaskId',v_task.id), 'pending', auth.uid()); end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (p_clinic_id, 'follow_up_result', v_result.id, 'follow_up.result_recorded', auth.uid(), jsonb_build_object('taskId', v_task.id, 'performedBy', p_input->>'performedBy', 'reportedBy', p_input->>'reportedBy', 'recordedBy', auth.uid()));
  return to_jsonb(v_result);
end $$;

create or replace function public.create_appointment_workflow(p_clinic_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_appointment public.appointments;
begin
  if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['admin'::public.app_role, 'manager'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.cases where id = (p_input->>'caseId')::uuid and clinic_id = p_clinic_id) then raise exception 'CASE_NOT_FOUND'; end if;
  insert into public.appointments (clinic_id, case_id, source_result_id, starts_at, ends_at, appointment_type, branch, provider_name, created_by)
  values (p_clinic_id, (p_input->>'caseId')::uuid, nullif(p_input->>'sourceResultId','')::uuid, (p_input->>'startsAt')::timestamptz, nullif(p_input->>'endsAt','')::timestamptz, p_input->>'appointmentType', nullif(p_input->>'branch',''), nullif(p_input->>'providerName',''), auth.uid()) returning * into v_appointment;
  update public.cases set state = 'appointment_scheduled', updated_at = now() where id = v_appointment.case_id;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (p_clinic_id, 'appointment', v_appointment.id, 'appointment.created', auth.uid(), jsonb_build_object('caseId', v_appointment.case_id, 'sourceResultId', v_appointment.source_result_id));
  insert into public.operational_notifications (clinic_id, recipient_user_id, kind, title, body, case_id, appointment_id) values (p_clinic_id, auth.uid(), 'appointment_due', 'สร้างนัดหมายใหม่', 'นัด ' || v_appointment.appointment_type || ' ถูกบันทึกแล้ว', v_appointment.case_id, v_appointment.id);
  return to_jsonb(v_appointment);
end $$;

grant execute on function public.record_follow_up_result_workflow(uuid, jsonb) to authenticated;
grant execute on function public.create_appointment_workflow(uuid, jsonb) to authenticated;
