import { createClient } from '@supabase/supabase-js';
import { assertContractTarget, insertMissingFixtures } from './contract-safety.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
assertContractTarget(url); // Before creating a client or making any network request.
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const password = 'IntegrationPass123!';
const users = [
  ['admin-a@integration.local', 'clinic_admin', 'Admin A'], ['coordinator-a@integration.local', 'care_coordinator', 'Coordinator A'],
  ['nurse-a@integration.local', 'nurse', 'Nurse A'], ['viewer-a@integration.local', 'viewer', 'Viewer A'],
  ['admin-b@integration.local', 'clinic_admin', 'Admin B'], ['nurse-b@integration.local', 'nurse', 'Nurse B'], ['system@integration.local', null, 'System Admin'],
];
async function userFor(email) {
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find((item) => item.email === email);
  if (!user) { const created = await client.auth.admin.createUser({ email, password, email_confirm: true }); if (created.error) throw created.error; user = created.data.user; }
  return user;
}
const clinicA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const clinicB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
for (const [id, name, prefix] of [[clinicA, 'Integration Clinic A · One Day Surgery', 'CDS'], [clinicB, 'Integration Clinic B', 'ITB']]) {
  await insertMissingFixtures(client, 'clinics', { id, name, timezone: 'Asia/Bangkok', case_number_prefix: prefix, case_number_next: 1, active: true });
}
for (const [email, role, displayName] of users) {
  const user = await userFor(email);
  if (role) { const clinicId = email.includes('-b@') ? clinicB : clinicA; await insertMissingFixtures(client, 'clinic_memberships', { clinic_id: clinicId, user_id: user.id, role, display_name: displayName, active: true }, 'clinic_id,user_id'); }
  else { await insertMissingFixtures(client, 'system_administrators', { user_id: user.id, active: true }, 'user_id'); }
}

const sample = {
  plan: 'a2000000-0000-4000-8000-000000000001',
  service: 'a3000000-0000-4000-8000-000000000001',
  patients: ['a4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000003'],
  cases: ['a5000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000003'],
  tasks: ['a6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000003'],
  appointments: ['a7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002'],
};
const integrationUsers = new Map();
for (const [email] of users) integrationUsers.set(email, await userFor(email));
const atBangkokHour = (dayOffset, hour) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour - 7, 0, 0, 0);
  return date.toISOString();
};
const sourceRows = [
  ['a1000000-0000-4000-8000-000000000001', 'facebook', 'Facebook'],
  ['a1000000-0000-4000-8000-000000000002', 'line_oa', 'LINE OA'],
  ['a1000000-0000-4000-8000-000000000003', 'phone', 'โทรศัพท์'],
  ['a1000000-0000-4000-8000-000000000004', 'referral', 'ส่งต่อจากโรงพยาบาล'],
  ['a1000000-0000-4000-8000-000000000005', 'walk_in', 'Walk-in'],
].map(([id, code, label]) => ({ id, clinic_id: clinicA, code, label }));
// Insert missing synthetic fixtures only. Re-runs must preserve test evidence,
// role changes, archived plan versions, service defaults and clinical history.
await insertMissingFixtures(client, 'sources', sourceRows, 'clinic_id,code');
await insertMissingFixtures(client, 'follow_up_plans', { id: sample.plan, clinic_id: clinicA, name: 'ติดตามหลัง One Day Surgery 1/3/7/14/30 วัน', active: true, version: 1 });
await insertMissingFixtures(client, 'follow_up_plan_steps', [
  [1, 1, '10:00', 'ประเมินอาการและแผลหลังทำหัตถการ'], [2, 3, '10:00', 'ติดตามการฟื้นตัว'], [3, 7, '10:00', 'ยืนยันผลและคำแนะนำ'], [4, 14, '10:00', 'ติดตามต่อเนื่อง'], [5, 30, '10:00', 'สรุปผลการดูแล'],
].map(([sequence, day_offset, due_time, instruction]) => ({ clinic_id: clinicA, plan_id: sample.plan, sequence, day_offset, due_time, instruction })), 'plan_id,sequence');
await insertMissingFixtures(client, 'service_catalog', { id: sample.service, clinic_id: clinicA, code: 'one_day_vascular_procedure', name: 'One Day Surgery · หัตถการหลอดเลือด', default_follow_up_plan_id: sample.plan, active: true }, 'clinic_id,code');
await insertMissingFixtures(client, 'patients', [
  { id: sample.patients[0], clinic_id: clinicA, full_name: 'สมฤดี มณี', hn_normalized: 'HN-24082', phone_normalized: '0812345678' },
  { id: sample.patients[1], clinic_id: clinicA, full_name: 'นลินี ศรีสุข', hn_normalized: 'HN-24091', phone_normalized: '0823456789' },
  { id: sample.patients[2], clinic_id: clinicA, full_name: 'ธนวัฒน์ วงศ์ดี', hn_normalized: 'HN-24093', phone_normalized: '0834567890' },
]);
await insertMissingFixtures(client, 'cases', [
  { id: sample.cases[0], clinic_id: clinicA, patient_id: sample.patients[0], source_id: sourceRows[2].id, service_id: sample.service, selected_plan_id: sample.plan, case_number: 'CDS-00001', state: 'follow_up_active', priority: 'normal', source_received_at: atBangkokHour(-8, 9), assigned_to: integrationUsers.get('nurse-a@integration.local').id },
  { id: sample.cases[1], clinic_id: clinicA, patient_id: sample.patients[1], source_id: sourceRows[1].id, service_id: sample.service, selected_plan_id: sample.plan, case_number: 'CDS-00002', state: 'appointment_scheduled', priority: 'normal', source_received_at: atBangkokHour(-3, 10), assigned_to: integrationUsers.get('nurse-a@integration.local').id },
  { id: sample.cases[2], clinic_id: clinicA, patient_id: sample.patients[2], source_id: sourceRows[0].id, service_id: sample.service, selected_plan_id: sample.plan, case_number: 'CDS-00003', state: 'awaiting_nurse_call', priority: 'high', source_received_at: atBangkokHour(-1, 14), assigned_to: integrationUsers.get('nurse-a@integration.local').id },
]);
await insertMissingFixtures(client, 'follow_up_tasks', [
  { id: sample.tasks[0], clinic_id: clinicA, case_id: sample.cases[0], plan_id: sample.plan, step_snapshot: { label: 'ประเมินอาการและแผลหลังทำหัตถการ', sequence: 1 }, due_at: atBangkokHour(-1, 10), status: 'pending', assigned_to: integrationUsers.get('nurse-a@integration.local').id },
  { id: sample.tasks[1], clinic_id: clinicA, case_id: sample.cases[1], plan_id: sample.plan, step_snapshot: { label: 'ยืนยันนัดเพื่อทำหัตถการ', sequence: 0 }, due_at: atBangkokHour(0, 13), status: 'pending', assigned_to: integrationUsers.get('nurse-a@integration.local').id },
  { id: sample.tasks[2], clinic_id: clinicA, case_id: sample.cases[2], plan_id: sample.plan, step_snapshot: { label: 'โทรคัดกรองและให้คำแนะนำก่อนหัตถการ', sequence: 0 }, due_at: atBangkokHour(3, 10), status: 'pending', assigned_to: integrationUsers.get('nurse-a@integration.local').id },
]);
await insertMissingFixtures(client, 'appointments', [
  { id: sample.appointments[0], clinic_id: clinicA, case_id: sample.cases[1], starts_at: atBangkokHour(1, 10), ends_at: atBangkokHour(1, 11), appointment_type: 'ประเมินก่อนทำหัตถการ', provider_name: 'พยาบาลณิชา', status: 'scheduled' },
  { id: sample.appointments[1], clinic_id: clinicA, case_id: sample.cases[0], starts_at: atBangkokHour(5, 14), ends_at: atBangkokHour(5, 15), appointment_type: 'ตรวจติดตามหลังหัตถการ', provider_name: 'พยาบาลณิชา', status: 'scheduled' },
]);
console.log('Provisioned missing local integration fixtures; existing records preserved.');
