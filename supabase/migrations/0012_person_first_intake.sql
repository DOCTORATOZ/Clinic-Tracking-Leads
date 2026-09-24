-- Person-first intake. Existing identities/history and unknown consent are preserved.
alter table public.patients
  add column contact_permission text not null default 'unknown' check (contact_permission in ('unknown','granted','declined')),
  add column social_platform text,
  add column social_account text,
  add column representative_name text,
  add column representative_relationship text;
alter table public.cases
  add column intake_title text,
  add column coordination_note text,
  add column coordinator_id uuid references auth.users(id),
  add column anchor_review_required boolean not null default true;

create table public.patient_intakes (
  patient_id uuid primary key references public.patients(id),
  clinic_id uuid not null references public.clinics(id),
  owner_id uuid not null references auth.users(id),
  next_contact_at timestamptz,
  status text not null default 'new' check (status in ('new','in_progress','awaiting_callback','linked_to_case','closed')),
  updated_at timestamptz not null default now()
);
alter table public.patient_intakes enable row level security;
-- RPC-only writes: there is no broad tenant-wide write policy on these tables.
create table public.intake_requests (
  clinic_id uuid not null references public.clinics(id),
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  input_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (clinic_id, actor_id, request_id)
);
alter table public.intake_requests enable row level security;
revoke all on public.patient_intakes, public.intake_requests from anon, authenticated;

-- Explicit operational projection, with assignment scope for Nurses. No clinical fields.
create function public.intake_patient_directory(p_query text default '', p_hn text default null,
  p_phone text default null, p_social_platform text default null, p_social_account text default null,
  p_matches_only boolean default false, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_clinic uuid := public.current_clinic_id(); v_nurse boolean;
begin
  if v_clinic is null then raise exception 'FORBIDDEN'; end if;
  v_nurse := public.has_clinic_role(array['nurse'::public.app_role]);
  return coalesce((select jsonb_agg(x.payload) from (
    select jsonb_build_object('id', p.id, 'fullName', p.full_name, 'hn', p.hn_normalized,
      'phone', p.phone_normalized, 'socialPlatform', p.social_platform, 'socialAccount', p.social_account,
      'contactPermission', p.contact_permission, 'ownerId', i.owner_id, 'nextContactAt', i.next_contact_at,
      'intakeStatus', i.status, 'caseIds', coalesce((select jsonb_agg(c.id order by c.created_at desc)
        from public.cases c where c.patient_id = p.id and c.clinic_id = v_clinic
        and (not v_nurse or c.assigned_to = auth.uid())), '[]'::jsonb)) as payload
    from public.patients p left join public.patient_intakes i on i.patient_id = p.id and i.clinic_id = v_clinic
    where p.clinic_id = v_clinic
      and (not v_nurse or exists(select 1 from public.cases c where c.patient_id = p.id and c.clinic_id = v_clinic and c.assigned_to = auth.uid()))
      and (not p_matches_only or
        (nullif(p_hn,'') is not null and p.hn_normalized = p_hn) or
        (nullif(p_phone,'') is not null and p.phone_normalized = p_phone) or
        (nullif(p_social_account,'') is not null and p.social_platform = p_social_platform and lower(p.social_account) = lower(trim(p_social_account))))
      and (p_query = '' or position(lower(p_query) in lower(concat_ws(' ',p.full_name,p.hn_normalized,p.phone_normalized,p.social_account))) > 0)
    order by p.created_at desc, p.id limit 100 offset greatest(0, p_offset)
  ) x), '[]'::jsonb);
end $$;

create function public.save_intake(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid := public.current_clinic_id(); v_request uuid := (p_input->>'requestId')::uuid;
  v_hash text := md5(p_input::text); v_previous public.intake_requests;
  v_decision jsonb := p_input->'patientDecision'; v_patient jsonb := v_decision->'patient';
  v_details jsonb := p_input->'case'; v_patient_id uuid; v_case public.cases;
  v_owner uuid := coalesce((p_input->>'ownerId')::uuid,auth.uid());
  v_source uuid := (v_details->>'sourceId')::uuid; v_service uuid := (v_details->>'serviceId')::uuid;
  v_plan uuid := (v_details->>'planId')::uuid; v_default uuid; v_nurse uuid := (v_details->>'assignedTo')::uuid;
  v_hn text; v_phone text; v_social text; v_permission text; v_prefix text; v_number integer; v_result jsonb;
begin
  if v_clinic is null or not public.has_clinic_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role]) then raise exception 'FORBIDDEN'; end if;
  if v_request is null or coalesce(p_input->>'mode','') not in ('lead','case') then raise exception 'VALIDATION_ERROR'; end if;
  -- Serialize intake per clinic: duplicate and sequence checks remain correct across concurrent requests.
  perform 1 from public.clinics where id = v_clinic and active for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into v_previous from public.intake_requests where clinic_id = v_clinic and actor_id = auth.uid() and request_id = v_request;
  if found then
    if v_previous.input_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_previous.result;
  end if;
  if not exists(select 1 from public.clinic_memberships where clinic_id = v_clinic and user_id = v_owner and active and role in ('clinic_admin','care_coordinator')) then raise exception 'INVALID_REFERENCE'; end if;
  if p_input->>'mode' = 'lead' and (nullif(p_input->>'nextContactAt','') is null or v_details is not null) then raise exception 'VALIDATION_ERROR'; end if;
  if p_input->>'mode' = 'case' then
    if nullif(trim(v_details->>'title'),'') is null or length(v_details->>'title') > 200 then raise exception 'VALIDATION_ERROR'; end if;
    if v_source is not null and not exists(select 1 from public.sources where id = v_source and clinic_id = v_clinic and active) then raise exception 'INVALID_REFERENCE'; end if;
    if v_service is not null then
      select default_follow_up_plan_id into v_default from public.service_catalog where id = v_service and clinic_id = v_clinic and active;
      if not found then raise exception 'INVALID_REFERENCE'; end if;
    end if;
    v_plan := coalesce(v_plan, v_default);
    if v_plan is not null and not exists(select 1 from public.follow_up_plans where id = v_plan and clinic_id = v_clinic and active) then raise exception 'INVALID_REFERENCE'; end if;
    if v_plan is not null and v_plan is distinct from v_default and nullif(trim(v_details->>'planOverrideReason'),'') is null then raise exception 'PLAN_OVERRIDE_REASON_REQUIRED'; end if;
    if v_nurse is not null and not exists(select 1 from public.clinic_memberships where clinic_id = v_clinic and user_id = v_nurse and active and role = 'nurse') then raise exception 'INVALID_REFERENCE'; end if;
  end if;
  if v_decision->>'kind' = 'link' then
    v_patient_id := (v_decision->>'patientId')::uuid;
    if not exists(select 1 from public.patients where id = v_patient_id and clinic_id = v_clinic) then raise exception 'PATIENT_NOT_FOUND'; end if;
    -- Linking never overwrites identity, consent, owner, or callback date.
  elsif v_decision->>'kind' = 'create' then
    v_hn := nullif(upper(regexp_replace(v_patient->>'hn','\s','','g')),'');
    v_phone := nullif(regexp_replace(v_patient->>'phone','[^0-9+]','','g'),'');
    if left(v_phone,3) = '+66' then v_phone := '0' || substr(v_phone,4); end if;
    v_social := nullif(trim(v_patient->>'socialAccount'),'');
    v_permission := coalesce(v_patient->>'contactPermission','unknown');
    if nullif(trim(v_patient->>'fullName'),'') is null or length(v_patient->>'fullName') > 200
      or (v_phone is null and v_social is null) or v_permission not in ('unknown','granted','declined')
      or (v_phone is not null and v_phone !~ '^(0[0-9]{8,9}|\+[1-9][0-9]{6,14})$')
      or (v_social is not null and coalesce(v_patient->>'socialPlatform','') not in ('line_oa','facebook','tiktok','other')) then raise exception 'VALIDATION_ERROR'; end if;
    if v_hn is not null and exists(select 1 from public.patients where clinic_id = v_clinic and hn_normalized = v_hn) then raise exception 'HN_ALREADY_EXISTS'; end if;
    if exists(select 1 from public.patients where clinic_id = v_clinic and
      ((v_phone is not null and phone_normalized = v_phone) or
       (v_social is not null and social_platform = v_patient->>'socialPlatform' and lower(social_account) = lower(v_social))))
      and nullif(trim(v_decision->>'duplicateReason'),'') is null then raise exception 'DUPLICATE_DECISION_REQUIRED'; end if;
    insert into public.patients(clinic_id,full_name,hn_normalized,phone_normalized,social_platform,social_account,
      representative_name,representative_relationship,preferred_contact_channel,contact_permission,do_not_contact,care_contact_consent_at,consent_recorded_by)
    values(v_clinic,trim(v_patient->>'fullName'),v_hn,v_phone,v_patient->>'socialPlatform',v_social,
      nullif(trim(v_patient->>'representativeName'),''),nullif(trim(v_patient->>'representativeRelationship'),''),
      v_patient->>'preferredContactChannel',v_permission,v_permission = 'declined',case when v_permission = 'granted' then now() else null end,auth.uid()) returning id into v_patient_id;
    insert into public.patient_intakes(patient_id,clinic_id,owner_id,next_contact_at,status)
    values(v_patient_id,v_clinic,v_owner,(p_input->>'nextContactAt')::timestamptz,case when p_input->>'mode' = 'case' then 'linked_to_case' else 'new' end);
    insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,after_data)
    values(v_clinic,'patient',v_patient_id,'patient.intake_created',auth.uid(),jsonb_build_object('contactPermission',v_permission,'duplicateReason',v_decision->>'duplicateReason','ownerId',v_owner));
  else raise exception 'VALIDATION_ERROR'; end if;
  if p_input->>'mode' = 'case' then
    -- Existing demonstration numbers may be ahead of the counter. Never overwrite one.
    loop
      update public.clinics set case_number_next = case_number_next + 1, updated_at = now() where id = v_clinic returning case_number_prefix,case_number_next - 1 into v_prefix,v_number;
      exit when not exists(select 1 from public.cases where clinic_id = v_clinic and case_number = v_prefix || '-' || lpad(v_number::text,greatest(5,length(v_number::text)),'0'));
    end loop;
    insert into public.cases(clinic_id,patient_id,source_id,service_id,case_number,state,priority,assigned_to,selected_plan_id,plan_override_reason,intake_title,coordination_note,coordinator_id,created_by,anchor_review_required)
    values(v_clinic,v_patient_id,v_source,v_service,v_prefix || '-' || lpad(v_number::text,greatest(5,length(v_number::text)),'0'),
      case when v_nurse is null then 'new'::public.case_state else 'awaiting_nurse_call'::public.case_state end,
      coalesce(v_details->>'priority','normal'),v_nurse,v_plan,v_details->>'planOverrideReason',trim(v_details->>'title'),v_details->>'coordinationNote',v_owner,auth.uid(),false) returning * into v_case;
    if v_nurse is not null then
      insert into public.case_assignments(clinic_id,case_id,assigned_to,assigned_by,reason) values(v_clinic,v_case.id,v_nurse,auth.uid(),'intake');
    end if;
    update public.patient_intakes set status = 'linked_to_case',updated_at = now() where patient_id = v_patient_id and clinic_id = v_clinic;
    insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,after_data)
    values(v_clinic,'case',v_case.id,'case.created',auth.uid(),jsonb_build_object('patientId',v_patient_id,'selectedPlanId',v_plan,'planStatus','awaiting_anchor'));
    -- Deliberately no task generation, clinical note, or contact-consent overwrite.
  end if;
  v_result := jsonb_build_object('patientId',v_patient_id,'case',case when v_case.id is null then null else jsonb_build_object('id',v_case.id,'case_number',v_case.case_number) end);
  insert into public.intake_requests(clinic_id,actor_id,request_id,input_hash,result) values(v_clinic,auth.uid(),v_request,v_hash,v_result);
  return v_result;
end $$;

revoke all on function public.save_intake(jsonb), public.intake_patient_directory(text,text,text,text,text,boolean,integer) from public, anon;
grant execute on function public.save_intake(jsonb), public.intake_patient_directory(text,text,text,text,text,boolean,integer) to authenticated;
