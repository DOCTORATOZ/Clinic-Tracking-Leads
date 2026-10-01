create table public.workflow_requests (
 clinic_id uuid not null references public.clinics(id), actor_id uuid not null references auth.users(id), operation text not null, request_id uuid not null,
 input_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(clinic_id,actor_id,operation,request_id)
);
alter table public.workflow_requests enable row level security;
revoke all on public.workflow_requests from anon,authenticated;
create function public.workflow_request_result(p_operation text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid:=public.current_clinic_id();v_request uuid:=(p_input->>'requestId')::uuid;v_previous public.workflow_requests;
begin
 if v_clinic is null then raise exception 'FORBIDDEN';end if;
 if v_request is null then raise exception 'VALIDATION_ERROR';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_clinic::text||auth.uid()::text||p_operation||v_request::text,0));
 select * into v_previous from public.workflow_requests where clinic_id=v_clinic and actor_id=auth.uid() and operation=p_operation and request_id=v_request;
 if found then
  if v_previous.input_hash<>md5(p_input::text) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return v_previous.result;
 end if;
 return null;
end $$;

create function public.create_appointment_workflow_v3(p_clinic_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_previous jsonb;v_case public.cases;v_appointment public.appointments;
begin
 if p_clinic_id is distinct from public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role]) then raise exception 'FORBIDDEN';end if;
 v_previous:=public.workflow_request_result('appointment',p_input);if v_previous is not null then return v_previous;end if;
 select * into v_case from public.cases where id=(p_input->>'caseId')::uuid and clinic_id=p_clinic_id for update;
 if v_case.id is null then raise exception 'CASE_NOT_FOUND';end if;
 if nullif(trim(p_input->>'appointmentType'),'') is null then raise exception 'VALIDATION_ERROR';end if;
 if p_input->>'sourceResultId' is not null and not exists(select 1 from public.follow_up_results r join public.follow_up_tasks t on t.id=r.task_id where r.id=(p_input->>'sourceResultId')::uuid and r.clinic_id=p_clinic_id and t.case_id=v_case.id) then raise exception 'INVALID_REFERENCE';end if;
 insert into public.appointments(clinic_id,case_id,source_result_id,starts_at,ends_at,appointment_type,branch,provider_name,lifecycle_reason,created_by)
 values(p_clinic_id,v_case.id,(p_input->>'sourceResultId')::uuid,(p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,trim(p_input->>'appointmentType'),nullif(trim(p_input->>'branch'),''),nullif(trim(p_input->>'providerName'),''),nullif(trim(p_input->>'reason'),''),auth.uid()) returning * into v_appointment;
 insert into public.appointment_history(clinic_id,appointment_id,next_status,reason,changed_by) values(p_clinic_id,v_appointment.id,'scheduled',p_input->>'reason',auth.uid());
 insert into public.operational_notifications(clinic_id,kind,title,case_id,appointment_id) values(p_clinic_id,'appointment_due','มีนัดหมายใหม่',v_case.id,v_appointment.id);
 insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason) values(p_clinic_id,'appointment',v_appointment.id,'appointment.created',auth.uid(),p_input->>'reason');
 insert into public.workflow_requests values(p_clinic_id,auth.uid(),'appointment',(p_input->>'requestId')::uuid,md5(p_input::text),to_jsonb(v_appointment),now());
 return to_jsonb(v_appointment);
end $$;

create function public.record_follow_up_result_workflow_v3(p_clinic_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_previous jsonb;v_result jsonb;v_task public.follow_up_tasks;v_appointment jsonb;
begin
 if p_clinic_id is distinct from public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]) then raise exception 'FORBIDDEN';end if;
 v_previous:=public.workflow_request_result('result',p_input);if v_previous is not null then return v_previous;end if;
 select * into v_task from public.follow_up_tasks where id=(p_input->>'taskId')::uuid and clinic_id=p_clinic_id;
 if v_task.id is null or not public.can_access_case(v_task.case_id) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.cases where id=v_task.case_id for update;
 if nullif(trim(p_input->>'summary'),'') is null or nullif(trim(p_input->>'outcome'),'') is null or p_input->>'contactStatus' not in ('contacted','no_answer','wrong_number','declined') then raise exception 'VALIDATION_ERROR';end if;
 if p_input ? 'clinicalSummary' and nullif(p_input->>'clinicalSummary','') is not null and not public.has_clinic_role(array['nurse'::public.app_role]) then raise exception 'FORBIDDEN';end if;
 if p_input->>'retryDueAt' is not null and nullif(trim(p_input->>'retryReason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 v_result:=public.record_follow_up_result_workflow_v2(p_clinic_id,p_input);
 -- Explicit optional appointment shares this transaction; any failure rolls back the report/task change.
 if p_input->'appointment' is not null and p_input->'appointment'<>'null'::jsonb then
  v_appointment:=public.create_appointment_workflow_v3(p_clinic_id,(p_input->'appointment')||jsonb_build_object('requestId',p_input->>'requestId','caseId',v_task.case_id,'sourceResultId',v_result->>'id'));
  v_result:=v_result||jsonb_build_object('appointment',v_appointment);
 end if;
 insert into public.workflow_requests values(p_clinic_id,auth.uid(),'result',(p_input->>'requestId')::uuid,md5(p_input::text),v_result,now());
 return v_result;
end $$;

create function public.transition_appointment_checked(p_appointment_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid:=public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role]);v_appt public.appointments;v_input jsonb:=p_input;v_case uuid;v_result jsonb;
begin
 select case_id into v_case from public.appointments where id=p_appointment_id and clinic_id=v_clinic;
 if v_case is null then raise exception 'FORBIDDEN';end if;
 perform 1 from public.cases where id=v_case for update;
 select * into v_appt from public.appointments where id=p_appointment_id and clinic_id=v_clinic for update;
 if (p_input->>'expectedUpdatedAt')::timestamptz is distinct from v_appt.updated_at then raise exception 'STALE_WRITE';end if;
 if p_input->>'status'='rescheduled' then
  if p_input->>'startsAt' is null or p_input->>'endsAt' is null then raise exception 'INVALID_APPOINTMENT_TIME';end if;
  v_input:=jsonb_set(p_input,'{status}','"scheduled"'::jsonb);
 end if;
 v_result:=public.transition_appointment_workflow_v2(p_appointment_id,v_input);
 insert into public.operational_notifications(clinic_id,kind,title,case_id,appointment_id) values(v_clinic,'needs_review','นัดหมายมีการเปลี่ยนแปลง',v_case,p_appointment_id);
 return v_result;
end $$;

create function public.record_disabled_calendar_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_type text:=case when tg_table_name='appointments' then 'appointment' else 'task' end;v_operation text;v_key text;
begin
 v_operation:=case when new.status::text='cancelled' then 'cancel' else 'upsert' end;
 v_key:=v_type||':'||new.id::text;
 insert into public.calendar_event_links(clinic_id,entity_type,entity_id,provider,idempotency_key,sync_status) values(new.clinic_id,v_type,new.id,'google',v_key,'disabled') on conflict(clinic_id,provider,idempotency_key) do nothing;
 -- needs_review is deliberately non-dispatchable: live sync remains disabled.
 insert into public.calendar_sync_outbox(clinic_id,entity_type,entity_id,operation,idempotency_key,status,last_error)
 values(new.clinic_id,v_type,new.id,v_operation,v_key||':'||md5(to_jsonb(new)::text),'needs_review','SYNC_DISABLED') on conflict(clinic_id,idempotency_key,operation) do nothing;
 return new;
end $$;
create trigger task_disabled_outbox after insert or update on public.follow_up_tasks for each row execute function public.record_disabled_calendar_change();
create trigger appointment_disabled_outbox after insert or update on public.appointments for each row execute function public.record_disabled_calendar_change();
revoke all on function public.workflow_request_result(text,jsonb),public.record_disabled_calendar_change() from public,anon,authenticated;
revoke all on function public.create_appointment_workflow_v3(uuid,jsonb),public.record_follow_up_result_workflow_v3(uuid,jsonb),public.transition_appointment_checked(uuid,jsonb) from public,anon;
grant execute on function public.create_appointment_workflow_v3(uuid,jsonb),public.record_follow_up_result_workflow_v3(uuid,jsonb),public.transition_appointment_checked(uuid,jsonb) to authenticated;
revoke execute on function public.create_appointment_workflow_v2(uuid,jsonb),public.record_follow_up_result_workflow_v2(uuid,jsonb),public.transition_appointment_workflow_v2(uuid,jsonb) from public,anon,authenticated;
