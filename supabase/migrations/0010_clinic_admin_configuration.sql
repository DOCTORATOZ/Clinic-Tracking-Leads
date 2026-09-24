-- Clinic Admin configuration uses auditable RPCs. Plan versions are immutable
-- once replaced so existing cases and task snapshots keep their original plan.
alter table public.follow_up_plans
  add column if not exists supersedes_plan_id uuid references public.follow_up_plans(id),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

create or replace function public.require_clinic_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_clinic uuid := public.current_clinic_id();
begin
  if v_clinic is null or not public.has_clinic_role(array['clinic_admin'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  return v_clinic;
end $$;

create or replace function public.update_clinic_configuration(p_name text, p_case_number_prefix text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_clinic_admin(); v_before jsonb; v_after jsonb;
begin
  if nullif(trim(p_name), '') is null or nullif(trim(p_case_number_prefix), '') is null or p_case_number_prefix !~ '^[A-Z0-9]{1,12}$' then raise exception 'INVALID_CLINIC_CONFIGURATION'; end if;
  select jsonb_build_object('name', name, 'caseNumberPrefix', case_number_prefix, 'timezone', timezone) into v_before from public.clinics where id = v_clinic;
  update public.clinics set name = trim(p_name), case_number_prefix = p_case_number_prefix, updated_at = now() where id = v_clinic;
  select jsonb_build_object('name', name, 'caseNumberPrefix', case_number_prefix, 'timezone', timezone) into v_after from public.clinics where id = v_clinic;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, before_data, after_data) values (v_clinic, 'clinic', v_clinic, 'clinic.configuration_updated', auth.uid(), v_before, v_after);
  return v_after;
end $$;

create or replace function public.manage_clinic_source(p_action text, p_source_id uuid, p_code text default null, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_clinic_admin(); v_source public.sources; v_action text;
begin
  v_action := lower(p_action);
  if v_action = 'create' then
    if nullif(trim(p_code), '') is null or nullif(trim(p_label), '') is null then raise exception 'INVALID_SOURCE'; end if;
    insert into public.sources (clinic_id, code, label) values (v_clinic, lower(trim(p_code)), trim(p_label)) returning * into v_source;
  else
    select * into v_source from public.sources where id = p_source_id and clinic_id = v_clinic for update;
    if v_source.id is null then raise exception 'SOURCE_NOT_FOUND'; end if;
    if v_action = 'update' then update public.sources set code = lower(trim(p_code)), label = trim(p_label) where id = v_source.id returning * into v_source;
    elsif v_action = 'archive' then update public.sources set active = false where id = v_source.id returning * into v_source;
    elsif v_action = 'reactivate' then update public.sources set active = true where id = v_source.id returning * into v_source;
    else raise exception 'INVALID_SOURCE_ACTION'; end if;
  end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (v_clinic, 'source', v_source.id, 'source.' || v_action, auth.uid(), jsonb_build_object('code', v_source.code, 'label', v_source.label, 'active', v_source.active));
  return to_jsonb(v_source);
end $$;

create or replace function public.manage_clinic_service(p_action text, p_service_id uuid, p_code text default null, p_name text default null, p_plan_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_clinic_admin(); v_service public.service_catalog; v_action text;
begin
  v_action := lower(p_action);
  if p_plan_id is not null and not exists(select 1 from public.follow_up_plans where id = p_plan_id and clinic_id = v_clinic and active) then raise exception 'PLAN_NOT_FOUND'; end if;
  if v_action = 'create' then
    if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then raise exception 'INVALID_SERVICE'; end if;
    insert into public.service_catalog (clinic_id, code, name, default_follow_up_plan_id) values (v_clinic, lower(trim(p_code)), trim(p_name), p_plan_id) returning * into v_service;
  else
    select * into v_service from public.service_catalog where id = p_service_id and clinic_id = v_clinic for update;
    if v_service.id is null then raise exception 'SERVICE_NOT_FOUND'; end if;
    if v_action = 'update' then update public.service_catalog set code = lower(trim(p_code)), name = trim(p_name), default_follow_up_plan_id = p_plan_id where id = v_service.id returning * into v_service;
    elsif v_action = 'archive' then update public.service_catalog set active = false where id = v_service.id returning * into v_service;
    elsif v_action = 'reactivate' then update public.service_catalog set active = true where id = v_service.id returning * into v_service;
    else raise exception 'INVALID_SERVICE_ACTION'; end if;
  end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (v_clinic, 'service', v_service.id, 'service.' || v_action, auth.uid(), jsonb_build_object('code', v_service.code, 'name', v_service.name, 'active', v_service.active, 'defaultPlanId', v_service.default_follow_up_plan_id));
  return to_jsonb(v_service);
end $$;

create or replace function public.create_follow_up_plan_version(p_previous_plan_id uuid, p_name text, p_steps jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.require_clinic_admin(); v_previous public.follow_up_plans; v_new public.follow_up_plans; v_step record;
begin
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 or nullif(trim(p_name), '') is null then raise exception 'INVALID_PLAN'; end if;
  if p_previous_plan_id is not null then select * into v_previous from public.follow_up_plans where id = p_previous_plan_id and clinic_id = v_clinic and active for update; if v_previous.id is null then raise exception 'PLAN_NOT_FOUND'; end if; end if;
  insert into public.follow_up_plans (clinic_id, name, active, version, supersedes_plan_id) values (v_clinic, trim(p_name), true, coalesce(v_previous.version, 0) + 1, v_previous.id) returning * into v_new;
  for v_step in select * from jsonb_to_recordset(p_steps) as x(sequence integer, day_offset integer, due_time time, instruction text) order by sequence loop
    if v_step.sequence is null or v_step.sequence < 1 or v_step.day_offset is null or v_step.day_offset < 0 or v_step.due_time is null then raise exception 'INVALID_PLAN_STEP'; end if;
    insert into public.follow_up_plan_steps (clinic_id, plan_id, sequence, day_offset, due_time, instruction) values (v_clinic, v_new.id, v_step.sequence, v_step.day_offset, v_step.due_time, nullif(trim(v_step.instruction), ''));
  end loop;
  if v_previous.id is not null then
    update public.service_catalog set default_follow_up_plan_id = v_new.id where clinic_id = v_clinic and default_follow_up_plan_id = v_previous.id;
    update public.follow_up_plans set active = false, archived_at = now(), archived_by = auth.uid() where id = v_previous.id;
  end if;
  insert into public.audit_events (clinic_id, entity_type, entity_id, action, actor_id, after_data) values (v_clinic, 'follow_up_plan', v_new.id, case when v_previous.id is null then 'follow_up_plan.created' else 'follow_up_plan.version_created' end, auth.uid(), jsonb_build_object('name', v_new.name, 'version', v_new.version, 'supersedesPlanId', v_previous.id));
  return to_jsonb(v_new);
end $$;

create or replace view public.clinic_audit_timeline with (security_barrier = true) as
select a.id, a.clinic_id, a.entity_type, a.entity_id, a.action, a.reason, a.occurred_at,
  coalesce(m.display_name, 'System') as actor_name
from public.audit_events a
left join public.clinic_memberships m on m.clinic_id = a.clinic_id and m.user_id = a.actor_id
where a.clinic_id = public.current_clinic_id() and public.has_clinic_role(array['clinic_admin'::public.app_role]);

grant select on public.clinic_audit_timeline to authenticated;
grant execute on function public.update_clinic_configuration(text, text), public.manage_clinic_source(text, uuid, text, text), public.manage_clinic_service(text, uuid, text, text, uuid), public.create_follow_up_plan_version(uuid, text, jsonb) to authenticated;
