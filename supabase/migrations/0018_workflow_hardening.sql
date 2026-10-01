-- All catalog changes must use audited RPCs; plan snapshots cannot be edited through REST.
revoke insert,update,delete on public.sources,public.service_catalog,public.follow_up_plans,public.follow_up_plan_steps,public.clinics,public.clinic_memberships,public.audit_events,public.calendar_sync_outbox,public.calendar_event_links from authenticated,anon;

create or replace function public.prevent_last_clinic_admin_removal()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.active and old.role='clinic_admin' and (tg_op='DELETE' or not new.active or new.role<>'clinic_admin') then
    -- Serialize concurrent removals in the same tenant before counting remaining admins.
    perform 1 from public.clinics where id=old.clinic_id for update;
    if (select count(*) from public.clinic_memberships where clinic_id=old.clinic_id and active and role='clinic_admin')<=1 then raise exception 'LAST_CLINIC_ADMIN_REQUIRED';end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create function public.workflow_staff_directory()
returns table(user_id uuid,display_name text,role public.app_role)
language sql stable security definer set search_path=public as $$
 select m.user_id,m.display_name,m.role from public.clinic_memberships m
 where m.clinic_id=public.current_clinic_id() and m.active
 order by m.display_name,m.user_id
$$;
revoke all on function public.workflow_staff_directory() from public,anon;
grant execute on function public.workflow_staff_directory() to authenticated;

-- Preserve the original profile update contract and add safe contact editing in the same transaction.
alter function public.update_patient_intake(uuid,jsonb) rename to update_patient_intake_base;
revoke all on function public.update_patient_intake_base(uuid,jsonb) from public,anon,authenticated;
create function public.update_patient_intake(p_patient_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid:=public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role]);v_patient public.patients;
begin
 select * into v_patient from public.patients where id=p_patient_id and clinic_id=v_clinic for update;
 if v_patient.id is null then raise exception 'PATIENT_NOT_FOUND';end if;
 if (p_input->>'expectedUpdatedAt')::timestamptz is distinct from v_patient.updated_at then raise exception 'STALE_WRITE';end if;
 if p_input ? 'socialPlatform' and nullif(p_input->>'socialPlatform','') is not null and p_input->>'socialPlatform' not in ('line_oa','facebook','tiktok','other') then raise exception 'VALIDATION_ERROR';end if;
 update public.patients set
  social_platform=case when p_input ? 'socialPlatform' then nullif(p_input->>'socialPlatform','') else social_platform end,
  social_account=case when p_input ? 'socialAccount' then nullif(trim(p_input->>'socialAccount'),'') else social_account end,
  representative_name=case when p_input ? 'representativeName' then nullif(trim(p_input->>'representativeName'),'') else representative_name end,
  representative_relationship=case when p_input ? 'representativeRelationship' then nullif(trim(p_input->>'representativeRelationship'),'') else representative_relationship end
 where id=p_patient_id returning * into v_patient;
 if (v_patient.social_account is null)<>(v_patient.social_platform is null) then raise exception 'VALIDATION_ERROR';end if;
 if v_patient.representative_name is not null and v_patient.representative_relationship is null then raise exception 'VALIDATION_ERROR';end if;
 if p_input->>'contactPermission'=v_patient.contact_permission then p_input:=p_input-'contactPermission';end if;
 return public.update_patient_intake_base(p_patient_id,p_input);
end $$;
revoke all on function public.update_patient_intake(uuid,jsonb) from public,anon;
grant execute on function public.update_patient_intake(uuid,jsonb) to authenticated;

-- Retry is explicit, attributed, and retains its reason. Never infer a retry date.
create or replace function public.record_follow_up_result_workflow_v2(p_clinic_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_task public.follow_up_tasks;v_result public.follow_up_results;v_retry public.follow_up_tasks;v_owner uuid;
begin
 if public.current_clinic_id() is distinct from p_clinic_id or not public.has_clinic_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]) then raise exception 'FORBIDDEN';end if;
 select * into v_task from public.follow_up_tasks where id=(p_input->>'taskId')::uuid and clinic_id=p_clinic_id for update;
 if v_task.id is null or (public.has_clinic_role(array['nurse'::public.app_role]) and v_task.assigned_to is distinct from auth.uid()) then raise exception 'FORBIDDEN';end if;
 if public.has_clinic_role(array['nurse'::public.app_role]) then
  if (p_input->>'reportedBy' is not null and (p_input->>'reportedBy')::uuid<>auth.uid()) or (p_input->>'performedBy' is not null and (p_input->>'performedBy')::uuid<>auth.uid()) then raise exception 'FORBIDDEN';end if;
  p_input:=p_input||jsonb_build_object('reportedBy',auth.uid(),'performedBy',auth.uid());
 end if;
 if not exists(select 1 from public.clinic_memberships where clinic_id=p_clinic_id and user_id=(p_input->>'reportedBy')::uuid and active and role='nurse') or (p_input->>'performedBy')::uuid is distinct from (p_input->>'reportedBy')::uuid then raise exception 'NURSE_REPORTER_REQUIRED';end if;
 insert into public.follow_up_results(clinic_id,task_id,occurred_at,contact_channel,contact_status,outcome,coordination_summary,next_action,performed_by,reported_by,recorded_by)
 values(p_clinic_id,v_task.id,(p_input->>'occurredAt')::timestamptz,p_input->>'contactChannel',p_input->>'contactStatus',p_input->>'outcome',p_input->>'summary',nullif(p_input->>'nextAction',''),nullif(p_input->>'performedBy','')::uuid,nullif(p_input->>'reportedBy','')::uuid,auth.uid()) returning * into v_result;
 if public.has_clinic_role(array['nurse'::public.app_role]) and nullif(p_input->>'clinicalSummary','') is not null then
  if p_input->>'contactStatus'<>'contacted' then raise exception 'VALIDATION_ERROR';end if;
  insert into public.follow_up_clinical_details(result_id,clinic_id,symptom_status,clinical_summary) values(v_result.id,p_clinic_id,p_input->>'symptomStatus',p_input->>'clinicalSummary');
 end if;
 if p_input->>'contactStatus'='contacted' then update public.follow_up_tasks set status='completed',completed_at=now() where id=v_task.id;end if;
 if nullif(p_input->>'retryDueAt','') is not null then
  if nullif(trim(p_input->>'retryReason'),'') is null then raise exception 'REASON_REQUIRED';end if;
  v_owner:=coalesce(nullif(p_input->>'retryAssignedTo','')::uuid,v_task.assigned_to);
  if v_owner is null then raise exception 'INVALID_REFERENCE';end if;
  insert into public.follow_up_tasks(clinic_id,case_id,due_at,assigned_to,step_snapshot,status,created_by)
  values(p_clinic_id,v_task.case_id,(p_input->>'retryDueAt')::timestamptz,v_owner,jsonb_build_object('kind','manual_retry','sourceTaskId',v_task.id,'reason',p_input->>'retryReason'),'pending',auth.uid()) returning * into v_retry;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason) values(p_clinic_id,'follow_up_task',v_retry.id,'follow_up_task.retry_created',auth.uid(),p_input->>'retryReason');
 end if;
 insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,after_data) values(p_clinic_id,'follow_up_result',v_result.id,'follow_up.result_recorded',auth.uid(),jsonb_build_object('taskId',v_task.id,'recordedBy',auth.uid()));
 return to_jsonb(v_result);
end $$;
revoke all on function public.record_follow_up_result_workflow_v2(uuid,jsonb) from public,anon,authenticated;
