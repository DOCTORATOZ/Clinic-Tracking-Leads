-- Grants permit the query; the role- and assignment-scoped RLS policies enforce
-- row visibility. No INSERT/UPDATE/DELETE grant is made.
grant select on public.case_clinical_details,public.follow_up_clinical_details to authenticated;
do $$ declare t text;begin
 foreach t in array array['sources','service_catalog','follow_up_plans','follow_up_plan_steps'] loop
  execute format('create policy "active clinic reference read" on public.%I for select to authenticated using (clinic_id=public.current_clinic_id())',t);
 end loop;
end $$;
