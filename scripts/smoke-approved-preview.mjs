// Explicitly approved, synthetic remote smoke. Never reset or seed an existing clinic.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const ref = 'gispylnpqiwxqbqnvmya';
const baseURL = 'https://clinic-tracking-leads-qy1l9ii9n-doctor-a-to-z.vercel.app';
const artifactDir = process.env.PREVIEW_SMOKE_DIR;
assert.equal(process.env.CONFIRM_PREVIEW_SMOKE_PROJECT, ref);
assert.match(artifactDir ?? '', /^\/Users\/thiti\.ch\/\.yarn_tmp\/clinic-preview-smoke\.[A-Za-z0-9]+$/);
const keys = JSON.parse(execFileSync('./node_modules/.bin/supabase', ['projects', 'api-keys', '--project-ref', ref, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const publicKey = keys.find(key => key.type === 'publishable').api_key;
const admin = createClient(`https://${ref}.supabase.co`, keys.find(key => key.name === 'service_role').api_key, { auth: { persistSession: false } });
const cookies = readFileSync(`${artifactDir}/protection.cookies`, 'utf8').split('\n').filter(line => line.includes('\t') && (!line.startsWith('#') || line.startsWith('#HttpOnly_'))).map(line => {
  const [domain, , path, secure, expiry, name, value] = line.replace(/^#HttpOnly_/, '').split('\t');
  return { domain, path, secure: secure === 'TRUE', expires: Number(expiry) || -1, name, value, httpOnly: line.startsWith('#HttpOnly_'), sameSite: 'Lax' };
});
assert.ok(cookies.some(cookie => cookie.name === '_vercel_jwt'));
const clinicId = randomUUID();
const roles = ['clinic_admin', 'care_coordinator', 'nurse', 'viewer', 'system_admin'];
const users = [];
const contexts = [];
const clients = [];
const outcomes = [];
const manifest = { clinicId, createdUserIds: [], outcomes, cleanup: [] };
const save = () => writeFileSync(`${artifactDir}/manifest.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const browser = await chromium.launch();
try {
  checked(await admin.from('clinics').insert({ id: clinicId, name: `Preview smoke ${new Date().toISOString()}`, timezone: 'Asia/Bangkok', case_number_prefix: 'PVTEST' }));
  save();
  for (const role of roles) {
    const email = `preview-${role}-${randomUUID()}@example.invalid`;
    const password = randomBytes(30).toString('base64url');
    const { user } = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    users.push({ id: user.id, email, password, role });
    manifest.createdUserIds.push(user.id); save();
    if (role === 'system_admin') checked(await admin.from('system_administrators').insert({ user_id: user.id, active: true }));
    else checked(await admin.from('clinic_memberships').insert({ clinic_id: clinicId, user_id: user.id, role, display_name: `Synthetic ${role}`, active: true }));
  }
  const pages = {};
  for (const user of users) {
    const context = await browser.newContext({ baseURL }); contexts.push(context);
    await context.addCookies(cookies);
    const page = await context.newPage(); pages[user.role] = page;
    const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel('รหัสผ่าน').fill(user.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
    await page.waitForURL(url => user.role === 'system_admin' ? url.pathname === '/system' : url.pathname === '/', { timeout: 30000 });
    await page.reload();
    const session = await page.request.get('/api/session'); assert.equal(session.status(), 200);
    const body = await session.json(); assert.equal(body.user.id, user.id);
    const cases = await page.request.get('/api/cases'); assert.equal(cases.status(), user.role === 'system_admin' ? 403 : 200);
    if (user.role === 'clinic_admin') {
      await page.goto('/admin');
      await page.getByText(/Preview รอบนี้ยังไม่เปิดส่งคำเชิญ/).waitFor();
      assert.equal(await page.getByRole('button', { name: 'ส่งคำเชิญ', exact: true }).count(), 0);
      assert.equal((await page.request.get('/api/clinic/admin')).status(), 200);
      assert.equal((await page.request.post('/api/clinic/memberships', { data: { email: 'not-sent@example.invalid', role: 'viewer' } })).status(), 503);
      await page.screenshot({ path: `${artifactDir}/admin.png`, fullPage: true });
    } else if (user.role === 'system_admin') {
      assert.equal((await page.request.get('/api/platform/clinics')).status(), 200);
    } else {
      assert.equal((await page.request.get('/api/clinic/admin')).status(), 403);
    }
    if (user.role === 'viewer') {
      assert.equal(await page.getByRole('button', { name: 'เพิ่มลีด / สร้างเคส', exact: true }).count(), 0);
      assert.equal((await page.request.post('/api/cases', { data: {} })).status(), 403);
    }
    const client = createClient(`https://${ref}.supabase.co`, publicKey, { auth: { persistSession: false } }); clients.push(client);
    checked(await client.auth.signInWithPassword({ email: user.email, password: user.password }));
    const foreign = await client.from('patients').select('id').neq('clinic_id', clinicId);
    assert.ok(foreign.error || foreign.data.length === 0);
    assert.deepEqual(pageErrors, []);
    outcomes.push(`PASS login/session/role boundary: ${user.role}`); save();
  }
  const coordinator = pages.care_coordinator;
  const nurse = users.find(user => user.role === 'nurse');
  const api = async (page, path, data, status = 201) => {
    const r = await page.request.post(path, { data });
    assert.equal(r.status(), status, `${path}: ${await r.text()}`);
    return r.json();
  };
  const intake = await api(coordinator, '/api/intake', { requestId: randomUUID(), mode: 'case', patientDecision: { kind: 'create', patient: { fullName: 'Synthetic Preview Person', socialPlatform: 'line_oa', socialAccount: `preview-${randomUUID()}`, contactPermission: 'granted' } }, case: { title: 'Synthetic deployment verification', assignedTo: nurse.id } });
  const caseId = intake.case.id;
  const task = await api(coordinator, `/api/cases/${caseId}/tasks`, { label: 'Synthetic follow-up', assignedTo: nurse.id, dueAt: new Date().toISOString(), reason: 'Preview verification' });
  await api(pages.nurse, '/api/follow-up-results', { requestId: randomUUID(), taskId: task.id, occurredAt: new Date().toISOString(), contactChannel: 'line_oa', contactStatus: 'contacted', outcome: 'Synthetic success', summary: 'Safe coordination summary', clinicalSummary: 'SYNTHETIC_PRIVATE_PREVIEW_DETAIL' });
  for (const role of ['care_coordinator', 'viewer']) {
    const r = await pages[role].request.get(`/api/cases/${caseId}`); assert.equal(r.status(), 200);
    assert.ok(!(await r.text()).includes('SYNTHETIC_PRIVATE_PREVIEW_DETAIL'));
    const direct = await clients[roles.indexOf(role)].from('follow_up_clinical_details').select('*');
    assert.ok(direct.error || direct.data.length === 0);
  }
  const start = new Date(Date.now() + 86400000);
  await api(coordinator, '/api/appointments', { requestId: randomUUID(), caseId, startsAt: start.toISOString(), endsAt: new Date(+start + 1800000).toISOString(), appointmentType: 'Synthetic preview appointment', reason: 'Preview verification' });
  const calendar = await coordinator.request.get(`/api/calendar?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 172800000).toISOString())}`);
  assert.equal(calendar.status(), 200);
  assert.ok((await calendar.text()).includes(caseId));
  await coordinator.screenshot({ path: `${artifactDir}/coordinator.png`, fullPage: true });
  outcomes.push('PASS remote intake → assigned task → Nurse report → clinical projection denial → appointment → calendar'); save();
  for (const page of Object.values(pages)) {
    // Platform page has no sign-out control; invalidate its session with Auth during cleanup.
    const signOut = page.getByRole('button', { name: 'ออกจากระบบ', exact: true });
    if (await signOut.count()) { await signOut.click(); await page.waitForURL('**/login'); }
  }
} finally {
  const cleanup = async (label, work) => { try { checked(await work()); manifest.cleanup.push(`OK ${label}`); } catch { manifest.cleanup.push(`FAILED ${label}`); } save(); };
  for (const client of clients) await cleanup('Auth sign-out', () => client.auth.signOut({ scope: 'global' }));
  // Keep the final-admin invariant. Its Auth account is banned below and tenant suspended.
  await cleanup('disable synthetic non-admin memberships', () => admin.from('clinic_memberships').update({ active: false }).eq('clinic_id', clinicId).neq('role', 'clinic_admin'));
  for (const user of users) {
    if (user.role === 'system_admin') await cleanup('revoke synthetic platform access', () => admin.from('system_administrators').update({ active: false, revoked_at: new Date().toISOString(), revocation_reason: 'Preview smoke complete' }).eq('user_id', user.id));
    await cleanup(`ban synthetic ${user.role}`, () => admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' }));
  }
  await cleanup('suspend synthetic clinic', () => admin.from('clinics').update({ active: false, suspended_at: new Date().toISOString(), suspension_reason: 'Preview smoke complete' }).eq('id', clinicId));
  for (const context of contexts) await context.close();
  await browser.close();
  console.log(JSON.stringify({ clinicId, outcomes, cleanup: manifest.cleanup, artifacts: artifactDir }));
  if (manifest.cleanup.some(line => line.startsWith('FAILED'))) throw new Error('Smoke cleanup requires attention; see manifest.');
}
