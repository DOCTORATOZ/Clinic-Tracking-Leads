-- The project is created with “Automatically expose new tables” disabled.
-- Make Data API access an explicit, reviewed part of the schema instead.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public;

grant usage on schema public to authenticated, service_role;
grant select on public.clinics, public.clinic_memberships to authenticated;
grant select, insert, update, delete on public.patients, public.sources,
  public.follow_up_plans, public.follow_up_plan_steps, public.service_catalog,
  public.cases, public.case_assignments, public.follow_up_tasks,
  public.follow_up_results, public.appointments, public.appointment_history,
  public.calendar_connections, public.calendar_event_links,
  public.calendar_sync_outbox, public.calendar_sync_logs, public.audit_events,
  public.operational_notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Only the case-number RPC is intentionally callable from the Data API.
grant execute on function public.next_case_number(uuid) to authenticated;
-- These helpers are evaluated by RLS policies for every authenticated request.
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.has_clinic_role(public.app_role[]) to authenticated;

-- Server-only workers use service_role. This grant does not make its key safe
-- for the browser; never expose SUPABASE_SERVICE_ROLE_KEY to client code.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
