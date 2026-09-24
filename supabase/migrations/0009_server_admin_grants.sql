-- Server-only operations using the Supabase service role need table privileges
-- in addition to bypassing RLS. Browser roles receive no privileges here.
grant select, insert, update on public.system_administrators to service_role;
grant select, insert, update on public.clinic_memberships to service_role;
grant select, insert, update on public.membership_invitations to service_role;
grant select, insert on public.audit_events to service_role;
