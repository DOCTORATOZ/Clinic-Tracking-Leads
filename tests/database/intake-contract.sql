-- Deliberately synthetic; separate database, no fixture cleanup or hard deletes.
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','admin@contract.invalid'),
 ('10000000-0000-4000-8000-000000000002','nurse@contract.invalid'),
 ('10000000-0000-4000-8000-000000000003','co@contract.invalid'),
 ('10000000-0000-4000-8000-000000000004','viewer@contract.invalid'),
 ('10000000-0000-4000-8000-000000000005','system@contract.invalid');
insert into public.clinics(id,name) values ('20000000-0000-4000-8000-000000000001','Contract Clinic'),('20000000-0000-4000-8000-000000000002','Other Clinic');
insert into public.clinic_memberships(clinic_id,user_id,role,display_name) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','clinic_admin','Test Admin'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','nurse','Test Nurse'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','care_coordinator','Test Co'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','viewer','Test Viewer');
insert into public.follow_up_plans(id,clinic_id,name) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Contract plan');
insert into public.follow_up_plan_steps(clinic_id,plan_id,sequence,day_offset) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,1),
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2,3);
insert into public.service_catalog(id,clinic_id,code,name,default_follow_up_plan_id) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','contract','Contract service','30000000-0000-4000-8000-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ declare v_input jsonb; v_result jsonb; v_other jsonb; v_case uuid; v_cycle jsonb; v_directory jsonb;
begin
  v_input := jsonb_build_object('requestId',gen_random_uuid(),'mode','lead','nextContactAt','2026-09-30T02:00:00Z',
    'patientDecision',jsonb_build_object('kind','create','patient',jsonb_build_object('fullName','Social person','socialPlatform','line_oa','socialAccount','contract-social')));
  v_result := public.save_intake(v_input);
  if v_result->'case' <> 'null'::jsonb then raise exception 'Person-only created a case'; end if;
  if public.save_intake(v_input) <> v_result then raise exception 'Idempotency mismatch'; end if;
  v_directory := public.intake_patient_directory('Social');
  if jsonb_array_length(v_directory) <> 1 or v_directory->0->>'contactPermission' <> 'unknown' then raise exception 'Directory/consent failure'; end if;
  begin
    perform public.save_intake(jsonb_set(v_input,'{requestId}',to_jsonb(gen_random_uuid())));
    raise exception 'Duplicate was accepted';
  exception when others then if sqlerrm <> 'DUPLICATE_DECISION_REQUIRED' then raise; end if; end;
  v_input := jsonb_build_object('requestId',gen_random_uuid(),'mode','case',
    'patientDecision',jsonb_build_object('kind','link','patientId',v_result->>'patientId'),
    'case',jsonb_build_object('title','Assessment','serviceId','40000000-0000-4000-8000-000000000001','assignedTo','10000000-0000-4000-8000-000000000002'));
  v_other := public.save_intake(v_input); v_case := (v_other->'case'->>'id')::uuid;
  if exists(select 1 from public.coordination_follow_up_tasks where case_id=v_case) then raise exception 'Intake generated tasks'; end if;
  v_input := jsonb_build_object('requestId',gen_random_uuid(),'planId','30000000-0000-4000-8000-000000000001','anchorDate','2026-09-20','eventKind','procedure','reportedBy','10000000-0000-4000-8000-000000000002','reason','Nurse instruction','expectedRevision',1);
  v_cycle := public.activate_case_plan(v_case,v_input);
  if public.activate_case_plan(v_case,v_input) <> v_cycle then raise exception 'Activation idempotency failed'; end if;
  if (select count(*) from public.coordination_follow_up_tasks where case_id=v_case) <> 2 then raise exception 'Expected exactly two tasks'; end if;
  if (select min(due_at) from public.coordination_follow_up_tasks where case_id=v_case) <> '2026-09-21T02:00:00Z'::timestamptz then raise exception 'Bangkok schedule failed'; end if;
  v_input := public.preview_plan_anchor((v_cycle->>'id')::uuid,'2026-09-21');
  perform public.revise_plan_anchor((v_cycle->>'id')::uuid,jsonb_build_object('anchorDate','2026-09-21','reason','Correct actual event date','preview',v_input));
  begin
    perform public.revise_plan_anchor((v_cycle->>'id')::uuid,jsonb_build_object('anchorDate','2026-09-21','reason','Stale','preview',v_input));
    raise exception 'Stale preview accepted';
  exception when others then if sqlerrm <> 'STALE_PREVIEW' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $$ begin
  begin
    perform public.save_intake('{}'); raise exception 'Viewer write allowed';
  exception when others then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
do $$ begin
  begin
    perform public.intake_patient_directory(); raise exception 'Platform clinical read allowed';
  exception when others then if sqlerrm <> 'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
-- Direct RLS, no-hard-delete permissions, clinical denial, cross-clinic boundaries.
insert into public.patients(id,clinic_id,full_name,phone_normalized) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','Other clinic person','0999999999');
insert into public.cases(id,clinic_id,patient_id,case_number) values('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','OTHER-1');
insert into public.case_clinical_details(case_id,clinic_id,concern) select id,clinic_id,'SENSITIVE TEST' from public.cases;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ declare v_case public.cases;v_patient public.patients;v_task public.follow_up_tasks;v_input jsonb;v_result jsonb;v_appt jsonb;v_before integer;
begin
 if exists(select 1 from public.patients where id='50000000-0000-4000-8000-000000000001') or exists(select 1 from public.case_clinical_details) then raise exception 'RLS leak';end if;
 if has_table_privilege('authenticated','public.patients','DELETE') or has_table_privilege('authenticated','public.follow_up_results','UPDATE') then raise exception 'Clinical write bypass';end if;
 select * into v_case from public.cases limit 1;select * into v_patient from public.patients where id=v_case.patient_id;
 begin
  perform public.transition_case_checked(v_case.id,jsonb_build_object('action','close','reason','other: test','expectedRevision',v_case.revision));raise exception 'Unresolved closure allowed';
 exception when others then if sqlerrm<>'UNRESOLVED_WORK' then raise;end if;end;
 begin
  perform public.amend_case(v_case.id,jsonb_build_object('title','Stale','reason','test','expectedRevision',999));raise exception 'Stale case write allowed';
 exception when others then if sqlerrm<>'STALE_WRITE' then raise;end if;end;
 select * into v_task from public.follow_up_tasks where case_id=v_case.id order by due_at limit 1;
 v_input:=jsonb_build_object('requestId',gen_random_uuid(),'taskId',v_task.id,'occurredAt',now(),'contactChannel','phone','contactStatus','contacted','outcome','test','summary','Safe summary','performedBy','10000000-0000-4000-8000-000000000002','reportedBy','10000000-0000-4000-8000-000000000002');
 begin
  perform public.record_follow_up_result_workflow_v3(v_case.clinic_id,v_input);raise exception 'Unknown consent allowed outgoing result';
 exception when others then if sqlerrm<>'CONTACT_NOT_PERMITTED' then raise;end if;end;
 perform public.update_patient_intake(v_patient.id,jsonb_build_object('contactPermission','granted','reason','Test permission confirmed','expectedUpdatedAt',v_patient.updated_at));
 -- Invalid appointment must roll back report, task completion and audit together.
 begin
  perform public.record_follow_up_result_workflow_v3(v_case.clinic_id,v_input||jsonb_build_object('appointment',jsonb_build_object('startsAt',now(),'endsAt',now()-interval '1 hour','appointmentType','test')));raise exception 'Invalid appointment accepted';
 exception when others then if sqlerrm<>'INVALID_APPOINTMENT_TIME' then raise;end if;end;
 if exists(select 1 from public.follow_up_results where task_id=v_task.id) or (select status from public.follow_up_tasks where id=v_task.id)<>'pending' then raise exception 'Atomic rollback failed';end if;
 v_result:=public.record_follow_up_result_workflow_v3(v_case.clinic_id,v_input);
 if public.record_follow_up_result_workflow_v3(v_case.clinic_id,v_input)<>v_result then raise exception 'Report idempotency failed';end if;
 select count(*) into v_before from public.follow_up_tasks where case_id=v_case.id;
 perform public.add_follow_up_result_correction((v_result->>'id')::uuid,jsonb_build_object('reason','Test addendum','summary','Corrected summary'));
 if (select count(*) from public.follow_up_tasks where case_id=v_case.id)<>v_before or (select status from public.follow_up_tasks where id=v_task.id)<>'completed' then raise exception 'Correction changed task state';end if;
 v_input:=jsonb_build_object('requestId',gen_random_uuid(),'caseId',v_case.id,'startsAt',now()+interval '1 day','endsAt',now()+interval '1 day 1 hour','appointmentType','test');
 v_appt:=public.create_appointment_workflow_v3(v_case.clinic_id,v_input);
 if public.create_appointment_workflow_v3(v_case.clinic_id,v_input)<>v_appt then raise exception 'Appointment idempotency failed';end if;
 perform public.transition_appointment_checked((v_appt->>'id')::uuid,jsonb_build_object('status','cancelled','reason','Test cancelled','expectedUpdatedAt',v_appt->>'updated_at'));
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.cases where assigned_to is distinct from auth.uid()) then raise exception 'Nurse case assignment leak';end if;
 if exists(select 1 from public.case_clinical_details d where not exists(select 1 from public.cases c where c.id=d.case_id and c.assigned_to=auth.uid())) then raise exception 'Nurse clinical assignment leak';end if;
end $$;
reset role;
update public.clinics set active=false where id='20000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $$ begin if exists(select 1 from public.cases) or public.current_clinic_id() is not null then raise exception 'Suspension bypass';end if;end $$;
reset role;
select 'PASS: person intake, duplicate denial, idempotency, deferred plan, Bangkok activation, anchor preview, role boundary' as result;
