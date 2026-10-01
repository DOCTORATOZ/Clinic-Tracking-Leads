-- Replace (rather than accumulate) legacy permissive read/write policies.
do $$ declare t text; p record; begin
  foreach t in array array['patients','cases','case_assignments','follow_up_tasks','follow_up_results','appointments','appointment_history','case_clinical_details','follow_up_clinical_details'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
    execute format('revoke insert, update, delete on public.%I from authenticated, anon',t);
  end loop;
end $$;
create policy "case operational read" on public.cases for select to authenticated using (public.can_access_case(id));
create policy "patient operational read" on public.patients for select to authenticated using (
  clinic_id=public.current_clinic_id() and (public.has_clinic_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'viewer'::public.app_role])
    or exists(select 1 from public.cases c where c.patient_id=patients.id and c.assigned_to=auth.uid())));
create policy "case assignment read" on public.case_assignments for select to authenticated using (public.can_access_case(case_id));
create policy "task operational read" on public.follow_up_tasks for select to authenticated using (clinic_id=public.current_clinic_id() and public.can_access_case(case_id)
  and (not public.has_clinic_role(array['nurse'::public.app_role]) or assigned_to=auth.uid()));
create policy "result operational read" on public.follow_up_results for select to authenticated using (clinic_id=public.current_clinic_id()
  and exists(select 1 from public.follow_up_tasks t where t.id=task_id and public.can_access_case(t.case_id)));
create policy "appointment operational read" on public.appointments for select to authenticated using (clinic_id=public.current_clinic_id() and public.can_access_case(case_id));
create policy "appointment history read" on public.appointment_history for select to authenticated using (clinic_id=public.current_clinic_id()
  and exists(select 1 from public.appointments a where a.id=appointment_id and public.can_access_case(a.case_id)));
create policy "clinical case restricted read" on public.case_clinical_details for select to authenticated using (clinic_id=public.current_clinic_id()
  and public.has_clinic_role(array['clinic_admin'::public.app_role,'nurse'::public.app_role]) and public.can_access_case(case_id));
create policy "clinical result restricted read" on public.follow_up_clinical_details for select to authenticated using (clinic_id=public.current_clinic_id()
  and public.has_clinic_role(array['clinic_admin'::public.app_role,'nurse'::public.app_role])
  and exists(select 1 from public.follow_up_results r join public.follow_up_tasks t on t.id=r.task_id where r.id=result_id and public.can_access_case(t.case_id)));

-- Unique HN check without rewriting or deleting historical duplicates. Applies to all write paths.
create function public.guard_patient_hn() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.hn_normalized is not null then
    new.hn_normalized := nullif(upper(regexp_replace(trim(new.hn_normalized),'\s','','g')),'');
    perform pg_advisory_xact_lock(hashtextextended(new.clinic_id::text || ':' || coalesce(new.hn_normalized,''),0));
    if exists(select 1 from public.patients where clinic_id=new.clinic_id and hn_normalized=new.hn_normalized and id<>new.id) then raise exception 'HN_ALREADY_EXISTS'; end if;
  end if;
  return new;
end $$;
create trigger patient_hn_guard before insert or update of hn_normalized on public.patients for each row execute function public.guard_patient_hn();

create function public.touch_case_revision() returns trigger language plpgsql as $$
begin new.revision := old.revision+1; new.updated_at := clock_timestamp(); return new; end $$;
create trigger case_revision before update on public.cases for each row execute function public.touch_case_revision();

create or replace function public.transition_case_lifecycle(p_case_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]); v_case public.cases;
begin
  select * into v_case from public.cases where id=p_case_id and clinic_id=v_clinic for update;
  if v_case.id is null or not public.can_access_case(p_case_id) then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_action='close' then
    if v_case.lifecycle='closed' then raise exception 'INVALID_TRANSITION'; end if;
    -- The caller must resolve each remaining task/appointment first; never cancel silently.
    if exists(select 1 from public.follow_up_tasks where case_id=p_case_id and status in ('pending','in_progress','paused'))
      or exists(select 1 from public.appointments where case_id=p_case_id and status in ('scheduled','rescheduled')) then raise exception 'UNRESOLVED_WORK'; end if;
    if split_part(p_reason,':',1) not in ('care_completed','not_interested','unreachable','referred','cancelled','other') then raise exception 'VALIDATION_ERROR'; end if;
    if public.has_clinic_role(array['nurse'::public.app_role]) and split_part(p_reason,':',1)<>'care_completed' then raise exception 'FORBIDDEN'; end if;
    if split_part(p_reason,':',1)='care_completed' and not public.has_clinic_role(array['nurse'::public.app_role]) then
      if not exists(select 1 from public.audit_events where clinic_id=v_clinic and entity_id=p_case_id and action='case.care_completion_confirmed') then raise exception 'NURSE_CONFIRMATION_REQUIRED'; end if;
    end if;
    update public.cases set lifecycle='closed',state='closed',closed_reason=p_reason,closed_at=now() where id=p_case_id;
  elsif p_action='reopen' then
    if not public.has_clinic_role(array['clinic_admin'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
    if v_case.lifecycle<>'closed' then raise exception 'INVALID_TRANSITION'; end if;
    update public.cases set lifecycle='open',state='new',closed_reason=null,closed_at=null where id=p_case_id;
  elsif p_action='pause' then
    if v_case.lifecycle<>'open' then raise exception 'INVALID_TRANSITION'; end if;
    update public.cases set lifecycle='paused' where id=p_case_id;
    update public.follow_up_tasks set status='paused',closure_reason=p_reason where case_id=p_case_id and status='pending';
  elsif p_action='resume' then
    if v_case.lifecycle<>'paused' then raise exception 'INVALID_TRANSITION'; end if;
    update public.cases set lifecycle='open' where id=p_case_id;
    -- Tasks remain paused until individually reviewed. No implicit rescheduling.
  else raise exception 'INVALID_TRANSITION'; end if;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason) values(v_clinic,'case',p_case_id,'case.'||p_action,auth.uid(),p_reason);
  return (select to_jsonb(c) from public.cases c where id=p_case_id);
end $$;

create function public.guard_task_transition() returns trigger language plpgsql security definer set search_path=public as $$
declare v_case public.cases;
begin
  select * into v_case from public.cases where id=new.case_id for update;
  if v_case.clinic_id is distinct from new.clinic_id then raise exception 'INVALID_REFERENCE'; end if;
  if auth.uid() is null then return new; end if;
  if v_case.lifecycle='closed' or (v_case.lifecycle='paused' and new.status in ('pending','in_progress')) then raise exception 'CASE_NOT_OPEN'; end if;
  if tg_op='UPDATE' and old.status in ('completed','skipped','cancelled') and new is distinct from old then raise exception 'TERMINAL_TASK'; end if;
  if new.assigned_to is not null and not exists(select 1 from public.clinic_memberships where clinic_id=new.clinic_id and user_id=new.assigned_to and active and role in ('nurse','care_coordinator','clinic_admin')) then raise exception 'INVALID_REFERENCE'; end if;
  if new.status='in_progress' and exists(select 1 from public.patients where id=v_case.patient_id and (contact_permission<>'granted' or do_not_contact)) then raise exception 'CONTACT_NOT_PERMITTED'; end if;
  return new;
end $$;
create trigger task_transition_guard before insert or update on public.follow_up_tasks for each row execute function public.guard_task_transition();

create function public.guard_result_insert() returns trigger language plpgsql security definer set search_path=public as $$
declare v_case public.cases; v_task public.follow_up_tasks;
begin
  select * into v_task from public.follow_up_tasks where id=new.task_id;
  select * into v_case from public.cases where id=v_task.case_id for update;
  if new.clinic_id is distinct from v_task.clinic_id or new.clinic_id is distinct from v_case.clinic_id then raise exception 'INVALID_REFERENCE'; end if;
  if auth.uid() is null then return new; end if;
  if not public.can_access_case(v_case.id) or new.recorded_by is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if new.corrects_result_id is not null then
    if not exists(select 1 from public.follow_up_results r where r.id=new.corrects_result_id and r.task_id=new.task_id and r.clinic_id=new.clinic_id) then raise exception 'INVALID_REFERENCE'; end if;
    if public.has_clinic_role(array['nurse'::public.app_role]) and new.reported_by is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
    if nullif(trim(new.correction_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
    return new;
  end if;
  if v_case.lifecycle<>'open' or v_task.status in ('completed','skipped','cancelled') then raise exception 'INVALID_TRANSITION'; end if;
  if exists(select 1 from public.patients where id=v_case.patient_id and (contact_permission<>'granted' or do_not_contact)) then raise exception 'CONTACT_NOT_PERMITTED'; end if;
  if new.reported_by is null or new.performed_by is null then raise exception 'NURSE_REPORTER_REQUIRED'; end if;
  return new;
end $$;
create trigger result_insert_guard before insert on public.follow_up_results for each row execute function public.guard_result_insert();

create function public.guard_appointment_write() returns trigger language plpgsql security definer set search_path=public as $$
declare v_case public.cases;
begin
  select * into v_case from public.cases where id=new.case_id for update;
  if v_case.clinic_id is distinct from new.clinic_id then raise exception 'INVALID_REFERENCE'; end if;
  if auth.uid() is null then return new; end if;
  if v_case.lifecycle='closed' then raise exception 'CASE_NOT_OPEN'; end if;
  if new.ends_at is null or new.ends_at<=new.starts_at then raise exception 'INVALID_APPOINTMENT_TIME'; end if;
  if tg_op='UPDATE' then
    if old.status in ('completed','cancelled','no_show') and not public.has_clinic_role(array['clinic_admin'::public.app_role]) then raise exception 'TERMINAL_APPOINTMENT'; end if;
    if nullif(trim(new.lifecycle_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  end if;
  if new.provider_name is not null and new.status in ('scheduled','rescheduled') and exists(select 1 from public.appointments a
    where a.id<>new.id and a.clinic_id=new.clinic_id and a.provider_name=new.provider_name and a.status in ('scheduled','rescheduled')
    and a.starts_at<new.ends_at and coalesce(a.ends_at,a.starts_at+interval '30 minutes')>new.starts_at)
    and nullif(trim(new.lifecycle_reason),'') is null then raise exception 'APPOINTMENT_COLLISION'; end if;
  return new;
end $$;
create trigger appointment_write_guard before insert or update on public.appointments for each row execute function public.guard_appointment_write();

-- Older role-era mutation RPCs are no longer legitimate entrypoints.
revoke execute on function public.create_case_workflow(uuid,jsonb,uuid,uuid,timestamptz,text,text,uuid,uuid,text), public.record_follow_up_result_workflow(uuid,jsonb),public.create_appointment_workflow(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.guard_patient_hn(),public.touch_case_revision(),public.guard_task_transition(),public.guard_result_insert(),public.guard_appointment_write() from public,anon,authenticated;
