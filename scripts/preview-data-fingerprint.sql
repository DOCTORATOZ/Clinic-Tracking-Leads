-- Read-only aggregate fingerprints: no names, contacts or clinical content in output.
select 'patients' as resource, count(*) as records, md5(coalesce(string_agg(id::text, ',' order by id), '')) as fingerprint from public.patients
union all
select 'cases', count(*), md5(coalesce(string_agg(concat_ws('|',id,patient_id,case_number,state), ',' order by id), '')) from public.cases
union all
select 'tasks', count(*), md5(coalesce(string_agg(concat_ws('|',id,case_id,due_at,status), ',' order by id), '')) from public.follow_up_tasks
union all
select 'appointments', count(*), md5(coalesce(string_agg(concat_ws('|',id,case_id,starts_at,ends_at,status), ',' order by id), '')) from public.appointments
union all
select 'results', count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.follow_up_results;
