# Development staff account setup

Public registration is disabled. Create development staff accounts in the
Supabase Dashboard: **Authentication → Users → Add user**, using email and a
development-only password.

Then run the following in the dev project's SQL editor, replacing
`AUTH_USER_UUID` with the UUID shown for that user:

```sql
insert into public.clinic_memberships (clinic_id, user_id, role, display_name)
values (
  '11111111-1111-1111-1111-111111111111',
  'AUTH_USER_UUID',
  'admin',
  'Development Admin'
)
on conflict (clinic_id, user_id)
do update set role = excluded.role, display_name = excluded.display_name, active = true;
```

Use only the linked development Supabase project. Do not place an admin password
or a service-role key in the repository, browser bundle, or Vercel Preview
logs.
