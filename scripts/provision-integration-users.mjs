import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const password = 'IntegrationPass123!';
const users = [
  ['admin-a@integration.local', 'clinic_admin', 'Admin A'], ['coordinator-a@integration.local', 'care_coordinator', 'Coordinator A'],
  ['nurse-a@integration.local', 'nurse', 'Nurse A'], ['viewer-a@integration.local', 'viewer', 'Viewer A'],
  ['admin-b@integration.local', 'clinic_admin', 'Admin B'], ['system@integration.local', null, 'System Admin'],
];
async function userFor(email) {
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = listed.data.users.find((item) => item.email === email);
  if (!user) { const created = await client.auth.admin.createUser({ email, password, email_confirm: true }); if (created.error) throw created.error; user = created.data.user; }
  return user;
}
const clinicA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const clinicB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
for (const [id, name, prefix] of [[clinicA, 'Integration Clinic A', 'ITA'], [clinicB, 'Integration Clinic B', 'ITB']]) {
  const { error } = await client.from('clinics').upsert({ id, name, timezone: 'Asia/Bangkok', case_number_prefix: prefix, case_number_next: 1, active: true }); if (error) throw error;
}
for (const [email, role, displayName] of users) {
  const user = await userFor(email);
  if (role) { const clinicId = email.includes('-b@') ? clinicB : clinicA; const { error } = await client.from('clinic_memberships').upsert({ clinic_id: clinicId, user_id: user.id, role, display_name: displayName, active: true }); if (error) throw error; }
  else { const { error } = await client.from('system_administrators').upsert({ user_id: user.id, active: true }); if (error) throw error; }
}
console.log('Provisioned local integration identities. Password: IntegrationPass123!');
