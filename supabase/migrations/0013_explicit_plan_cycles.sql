-- Separate a selected plan from its activation; do not infer anchors for legacy tasks.
alter table public.cases add column lifecycle text not null default 'open' check (lifecycle in ('open','paused','closed')),
  add column care_stage text not null default 'assessment' check (care_stage in ('assessment','preparation','post_procedure')),
  add column revision integer not null default 1;
update public.cases set lifecycle = 'closed' where state = 'closed';
alter table public.follow_up_plan_steps alter column due_time set default '09:00';
create table public.case_plan_cycles (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id),
  case_id uuid not null references public.cases(id), plan_id uuid not null references public.follow_up_plans(id),
  anchor_date date not null, event_kind text not null check (event_kind in ('assessment','procedure','care_start')),
  reported_by uuid not null references auth.users(id), recorded_by uuid not null references auth.users(id),
  instruction_reason text not null, revision integer not null default 1,
  request_id uuid not null, input_hash text not null, created_at timestamptz not null default now(),
  unique (clinic_id, recorded_by, request_id)
);
alter table public.case_plan_cycles enable row level security;
alter table public.follow_up_tasks add column cycle_id uuid references public.case_plan_cycles(id);
create unique index task_cycle_step_unique on public.follow_up_tasks(cycle_id,plan_step_id) where cycle_id is not null;

create function public.can_access_case(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.cases c where c.id = p_id and c.clinic_id = public.current_clinic_id()
    and (public.has_clinic_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'viewer'::public.app_role])
      or (public.has_clinic_role(array['nurse'::public.app_role]) and c.assigned_to = auth.uid())))
$$;
create policy "read visible case plan cycles" on public.case_plan_cycles for select to authenticated using (clinic_id = public.current_clinic_id() and public.can_access_case(case_id));
grant select on public.case_plan_cycles to authenticated;
revoke all on function public.can_access_case(uuid) from public,anon;
grant execute on function public.can_access_case(uuid) to authenticated;

create function public.activate_case_plan(p_case_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]);
  v_case public.cases; v_cycle public.case_plan_cycles; v_step record;
  v_plan uuid := (p_input->>'planId')::uuid; v_request uuid := (p_input->>'requestId')::uuid;
  v_reporter uuid := (p_input->>'reportedBy')::uuid; v_anchor date := (p_input->>'anchorDate')::date;
begin
  select * into v_case from public.cases where id=p_case_id and clinic_id=v_clinic for update;
  if v_case.id is null or not public.can_access_case(p_case_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_cycle from public.case_plan_cycles where clinic_id=v_clinic and recorded_by=auth.uid() and request_id=v_request;
  if found then
    if v_cycle.case_id <> p_case_id or v_cycle.input_hash <> md5(p_input::text) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(v_cycle);
  end if;
  if v_case.lifecycle <> 'open' then raise exception 'CASE_NOT_OPEN'; end if;
  if v_request is null or v_plan is null or v_anchor is null or v_anchor > (now() at time zone 'Asia/Bangkok')::date
    or coalesce(p_input->>'eventKind','') not in ('assessment','procedure','care_start') or nullif(trim(p_input->>'reason'),'') is null then raise exception 'VALIDATION_ERROR'; end if;
  if public.has_clinic_role(array['nurse'::public.app_role]) then
    if v_reporter is not null and v_reporter <> auth.uid() then raise exception 'FORBIDDEN'; end if;
    v_reporter := auth.uid();
  end if;
  if not exists(select 1 from public.clinic_memberships where clinic_id=v_clinic and active and role='nurse' and user_id=v_reporter) then raise exception 'NURSE_REPORTER_REQUIRED'; end if;
  if not exists(select 1 from public.follow_up_plans where id=v_plan and clinic_id=v_clinic and active) then raise exception 'INVALID_REFERENCE'; end if;
  if not exists(select 1 from public.follow_up_plan_steps where plan_id=v_plan and clinic_id=v_clinic) then raise exception 'EMPTY_PLAN'; end if;
  if v_case.revision <> (p_input->>'expectedRevision')::integer or p_input->>'expectedRevision' is null then raise exception 'STALE_WRITE'; end if;
  insert into public.case_plan_cycles(clinic_id,case_id,plan_id,anchor_date,event_kind,reported_by,recorded_by,instruction_reason,request_id,input_hash)
  values(v_clinic,p_case_id,v_plan,v_anchor,p_input->>'eventKind',v_reporter,auth.uid(),trim(p_input->>'reason'),v_request,md5(p_input::text)) returning * into v_cycle;
  for v_step in select * from public.follow_up_plan_steps where clinic_id=v_clinic and plan_id=v_plan order by sequence loop
    insert into public.follow_up_tasks(clinic_id,case_id,cycle_id,plan_id,plan_step_id,step_snapshot,due_at,assigned_to,created_by)
    values(v_clinic,p_case_id,v_cycle.id,v_plan,v_step.id,jsonb_build_object('sequence',v_step.sequence,'dayOffset',v_step.day_offset,'dueTime',v_step.due_time,'instruction',v_step.instruction),
      ((v_anchor + v_step.day_offset + v_step.due_time) at time zone 'Asia/Bangkok'),v_case.assigned_to,auth.uid());
  end loop;
  update public.cases set selected_plan_id=v_plan,revision=revision+1,updated_at=now() where id=p_case_id;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason,after_data)
  values(v_clinic,'plan_cycle',v_cycle.id,'plan.activated',auth.uid(),p_input->>'reason',jsonb_build_object('caseId',p_case_id,'anchorDate',v_anchor,'reportedBy',v_reporter));
  return to_jsonb(v_cycle);
end $$;

create function public.preview_plan_anchor(p_cycle_id uuid,p_anchor date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cycle public.case_plan_cycles;
begin
  select * into v_cycle from public.case_plan_cycles where id=p_cycle_id and clinic_id=public.current_clinic_id();
  if v_cycle.id is null or not public.can_access_case(v_cycle.case_id) or not public.has_clinic_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if p_anchor is null or p_anchor > (now() at time zone 'Asia/Bangkok')::date then raise exception 'VALIDATION_ERROR'; end if;
  return jsonb_build_object('cycleId',v_cycle.id,'expectedRevision',v_cycle.revision,'anchorDate',p_anchor,
    'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'previousDueAt',due_at,'willChange',status='pending',
      'nextDueAt',case when status='pending' then ((p_anchor + (step_snapshot->>'dayOffset')::integer + (step_snapshot->>'dueTime')::time) at time zone 'Asia/Bangkok') else due_at end) order by id)
      from public.follow_up_tasks where cycle_id=p_cycle_id and clinic_id=v_cycle.clinic_id),'[]'::jsonb));
end $$;

create function public.revise_plan_anchor(p_cycle_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cycle public.case_plan_cycles; v_preview jsonb; v_case public.cases;
begin
  select * into v_cycle from public.case_plan_cycles where id=p_cycle_id and clinic_id=public.current_clinic_id();
  if v_cycle.id is null then raise exception 'FORBIDDEN'; end if;
  select * into v_case from public.cases where id=v_cycle.case_id for update;
  perform 1 from public.case_plan_cycles where id=p_cycle_id for update;
  perform 1 from public.follow_up_tasks where cycle_id=p_cycle_id order by id for update;
  v_preview := public.preview_plan_anchor(p_cycle_id,(p_input->>'anchorDate')::date);
  if v_case.lifecycle <> 'open' then raise exception 'CASE_NOT_OPEN'; end if;
  if nullif(trim(p_input->>'reason'),'') is null then raise exception 'VALIDATION_ERROR'; end if;
  if (p_input->'preview') is distinct from v_preview then raise exception 'STALE_PREVIEW'; end if;
  update public.follow_up_tasks set due_at=(( (p_input->>'anchorDate')::date + (step_snapshot->>'dayOffset')::integer + (step_snapshot->>'dueTime')::time) at time zone 'Asia/Bangkok')
    where cycle_id=p_cycle_id and status='pending';
  update public.case_plan_cycles set anchor_date=(p_input->>'anchorDate')::date,revision=revision+1 where id=p_cycle_id;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason,before_data,after_data)
  values(v_cycle.clinic_id,'plan_cycle',p_cycle_id,'plan.anchor_revised',auth.uid(),p_input->>'reason',jsonb_build_object('anchorDate',v_cycle.anchor_date),v_preview);
  return v_preview;
end $$;
revoke all on function public.activate_case_plan(uuid,jsonb),public.preview_plan_anchor(uuid,date),public.revise_plan_anchor(uuid,jsonb) from public,anon;
grant execute on function public.activate_case_plan(uuid,jsonb),public.preview_plan_anchor(uuid,date),public.revise_plan_anchor(uuid,jsonb) to authenticated;

-- Legacy create endpoints cannot continue generating tasks from the intake date.
revoke execute on function public.create_case_workflow(uuid,jsonb,uuid,uuid,timestamptz,text,text,uuid,uuid,text),
  public.create_case_workflow_v2(uuid,jsonb,uuid,uuid,timestamptz,text,text,uuid,uuid,text) from public,anon,authenticated;
