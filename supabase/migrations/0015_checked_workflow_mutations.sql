create function public.amend_case(p_case_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role]); v_case public.cases;
begin
  select * into v_case from public.cases where id=p_case_id and clinic_id=v_clinic for update;
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  if v_case.lifecycle='closed' then raise exception 'CASE_NOT_OPEN'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from v_case.revision then raise exception 'STALE_WRITE'; end if;
  if nullif(trim(p_input->>'reason'),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_input ? 'title' and nullif(trim(p_input->>'title'),'') is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_input ? 'sourceId' and not exists(select 1 from public.sources where id=(p_input->>'sourceId')::uuid and clinic_id=v_clinic and active) then raise exception 'INVALID_REFERENCE'; end if;
  if p_input ? 'serviceId' and not exists(select 1 from public.service_catalog where id=(p_input->>'serviceId')::uuid and clinic_id=v_clinic and active) then raise exception 'INVALID_REFERENCE'; end if;
  if p_input ? 'ownerId' and not exists(select 1 from public.clinic_memberships where clinic_id=v_clinic and user_id=(p_input->>'ownerId')::uuid and active and role in ('clinic_admin','care_coordinator')) then raise exception 'INVALID_REFERENCE'; end if;
  update public.cases set intake_title=coalesce(p_input->>'title',intake_title),coordination_note=coalesce(p_input->>'coordinationNote',coordination_note),
    care_stage=coalesce(p_input->>'careStage',care_stage),priority=coalesce(p_input->>'priority',priority),
    coordinator_id=coalesce((p_input->>'ownerId')::uuid,coordinator_id),source_id=coalesce((p_input->>'sourceId')::uuid,source_id),service_id=coalesce((p_input->>'serviceId')::uuid,service_id)
    where id=p_case_id;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason) values(v_clinic,'case',p_case_id,'case.updated',auth.uid(),p_input->>'reason');
  return (select to_jsonb(c) from public.cases c where id=p_case_id);
end $$;

create function public.transition_case_checked(p_case_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]); v_case public.cases; v_reporter uuid;
begin
  select * into v_case from public.cases where id=p_case_id and clinic_id=v_clinic for update;
  if v_case.id is null or not public.can_access_case(p_case_id) then raise exception 'FORBIDDEN'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from v_case.revision then raise exception 'STALE_WRITE'; end if;
  if p_input->>'action'='close' and split_part(p_input->>'reason',':',1)='care_completed' then
    v_reporter := case when public.has_clinic_role(array['nurse'::public.app_role]) then auth.uid() else (p_input->>'reportedBy')::uuid end;
    if not exists(select 1 from public.clinic_memberships where clinic_id=v_clinic and user_id=v_reporter and active and role='nurse') then raise exception 'NURSE_REPORTER_REQUIRED'; end if;
    insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason,after_data)
    values(v_clinic,'case',p_case_id,'case.care_completion_confirmed',auth.uid(),p_input->>'reason',jsonb_build_object('reportedBy',v_reporter,'revision',v_case.revision));
  end if;
  return public.transition_case_lifecycle(p_case_id,p_input->>'action',p_input->>'reason');
end $$;

create function public.update_patient_intake(p_patient_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role]); v_patient public.patients; v_owner uuid;
begin
  select * into v_patient from public.patients where id=p_patient_id and clinic_id=v_clinic for update;
  if v_patient.id is null then raise exception 'PATIENT_NOT_FOUND'; end if;
  if (p_input->>'expectedUpdatedAt')::timestamptz is distinct from v_patient.updated_at then raise exception 'STALE_WRITE'; end if;
  if nullif(trim(p_input->>'reason'),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_input ? 'contactPermission' and p_input->>'contactPermission' not in ('unknown','granted','declined') then raise exception 'VALIDATION_ERROR'; end if;
  if p_input ? 'phone' and nullif(p_input->>'phone','') is not null and p_input->>'phone' !~ '^(0[0-9]{8,9}|\+[1-9][0-9]{6,14})$' then raise exception 'VALIDATION_ERROR'; end if;
  v_owner := coalesce((p_input->>'ownerId')::uuid,auth.uid());
  if not exists(select 1 from public.clinic_memberships where clinic_id=v_clinic and user_id=v_owner and active and role in ('clinic_admin','care_coordinator')) then raise exception 'INVALID_REFERENCE'; end if;
  update public.patients set full_name=coalesce(nullif(trim(p_input->>'fullName'),''),full_name),
    phone_normalized=case when p_input ? 'phone' then nullif(p_input->>'phone','') else phone_normalized end,
    hn_normalized=case when p_input ? 'hn' then nullif(p_input->>'hn','') else hn_normalized end,
    contact_permission=coalesce(p_input->>'contactPermission',contact_permission),
    do_not_contact=case when p_input ? 'contactPermission' then p_input->>'contactPermission'='declined' else do_not_contact end,
    care_contact_consent_at=case when p_input->>'contactPermission'='granted' then now() when p_input ? 'contactPermission' then null else care_contact_consent_at end,
    consent_recorded_by=case when p_input ? 'contactPermission' then auth.uid() else consent_recorded_by end, updated_at=clock_timestamp()
    where id=p_patient_id returning * into v_patient;
  if v_patient.phone_normalized is null and nullif(v_patient.social_account,'') is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_input ? 'ownerId' or p_input ? 'nextContactAt' or p_input ? 'intakeStatus' then
    insert into public.patient_intakes(patient_id,clinic_id,owner_id,next_contact_at,status) values(p_patient_id,v_clinic,v_owner,(p_input->>'nextContactAt')::timestamptz,coalesce(p_input->>'intakeStatus','new'))
    on conflict(patient_id) do update set owner_id=case when p_input ? 'ownerId' then excluded.owner_id else patient_intakes.owner_id end,
      next_contact_at=case when p_input ? 'nextContactAt' then excluded.next_contact_at else patient_intakes.next_contact_at end,
      status=coalesce(p_input->>'intakeStatus',patient_intakes.status),updated_at=now();
  end if;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id,reason,after_data) values(v_clinic,'patient',p_patient_id,'patient.intake_updated',auth.uid(),p_input->>'reason',jsonb_build_object('contactPermission',v_patient.contact_permission));
  return jsonb_build_object('id',v_patient.id,'updatedAt',v_patient.updated_at);
end $$;

create table public.patient_contacts (
 id uuid primary key default gen_random_uuid(),clinic_id uuid not null references public.clinics(id),patient_id uuid not null references public.patients(id),case_id uuid references public.cases(id),
 direction text not null check(direction in ('incoming','outgoing')),channel text not null check(channel in ('phone','line_oa','facebook','tiktok','other')),
 summary text not null,occurred_at timestamptz not null,recorded_by uuid not null references auth.users(id),recorded_at timestamptz not null default now(),request_id uuid not null,
 unique(clinic_id,recorded_by,request_id)
);
alter table public.patient_contacts enable row level security;
create policy "contact operational read" on public.patient_contacts for select to authenticated using(clinic_id=public.current_clinic_id() and
 (public.has_clinic_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'viewer'::public.app_role]) or public.can_access_case(case_id)));
grant select on public.patient_contacts to authenticated;
create function public.record_patient_contact(p_patient_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_clinic uuid := public.require_workflow_role(array['clinic_admin'::public.app_role,'care_coordinator'::public.app_role,'nurse'::public.app_role]); v_patient public.patients; v_contact public.patient_contacts; v_case uuid := (p_input->>'caseId')::uuid;
begin
  select * into v_patient from public.patients where id=p_patient_id and clinic_id=v_clinic for update;
  if v_patient.id is null then raise exception 'PATIENT_NOT_FOUND'; end if;
  if v_case is not null and not exists(select 1 from public.cases where id=v_case and clinic_id=v_clinic and patient_id=p_patient_id and public.can_access_case(id)) then raise exception 'FORBIDDEN'; end if;
  if public.has_clinic_role(array['nurse'::public.app_role]) and (v_case is null or not public.can_access_case(v_case)) then raise exception 'FORBIDDEN'; end if;
  select * into v_contact from public.patient_contacts where clinic_id=v_clinic and recorded_by=auth.uid() and request_id=(p_input->>'requestId')::uuid;
  if found then
    if v_contact.patient_id<>p_patient_id or v_contact.case_id is distinct from v_case or v_contact.summary<>p_input->>'summary' or v_contact.direction<>p_input->>'direction' or v_contact.channel<>p_input->>'channel' or v_contact.occurred_at<>(p_input->>'occurredAt')::timestamptz then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(v_contact);
  end if;
  if p_input->>'direction'='outgoing' and (v_patient.contact_permission<>'granted' or v_patient.do_not_contact) then raise exception 'CONTACT_NOT_PERMITTED'; end if;
  if nullif(trim(p_input->>'summary'),'') is null or length(p_input->>'summary')>5000 then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.patient_contacts(clinic_id,patient_id,case_id,direction,channel,summary,occurred_at,recorded_by,request_id)
  values(v_clinic,p_patient_id,v_case,p_input->>'direction',p_input->>'channel',p_input->>'summary',(p_input->>'occurredAt')::timestamptz,auth.uid(),(p_input->>'requestId')::uuid) returning * into v_contact;
  insert into public.audit_events(clinic_id,entity_type,entity_id,action,actor_id) values(v_clinic,'patient_contact',v_contact.id,'contact.recorded',auth.uid());
  return to_jsonb(v_contact);
end $$;
revoke all on function public.amend_case(uuid,jsonb),public.transition_case_checked(uuid,jsonb),public.update_patient_intake(uuid,jsonb),public.record_patient_contact(uuid,jsonb) from public,anon;
grant execute on function public.amend_case(uuid,jsonb),public.transition_case_checked(uuid,jsonb),public.update_patient_intake(uuid,jsonb),public.record_patient_contact(uuid,jsonb) to authenticated;
revoke execute on function public.update_case_operational(uuid,jsonb),public.transition_case_lifecycle(uuid,text,text),public.update_patient_profile(uuid,jsonb) from public,anon,authenticated;
