import { expect, test, type Page } from '@playwright/test';

const password = 'IntegrationPass123!';
async function signIn(page: Page, email: string) { await page.goto('/login'); await page.getByLabel('อีเมล').fill(email); await page.getByLabel('รหัสผ่าน').fill(password); await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click(); await page.waitForURL((url) => url.pathname !== '/login'); }
async function signOut(page: Page) { await page.getByRole('button', { name: 'ออกจากระบบ' }).click(); await page.waitForURL(/\/login$/); }
type ApiInit = { method?: string; headers?: Record<string, string>; body?: string };
async function api(page: Page, url: string, init?: ApiInit) { return page.evaluate(async ({ url, init }) => { const response = await fetch(url, init); return { status: response.status, body: await response.json() }; }, { url, init }); }

test('System Admin redirects to Platform and cannot load clinical API', async ({ page }) => {
  await signIn(page, 'system@integration.local'); await expect(page).toHaveURL(/\/system$/);
  expect((await api(page, '/api/platform/clinics')).status).toBe(200);
  expect((await api(page, '/api/cases')).status).toBe(403);
});

test('role API boundaries and Clinic Admin configuration', async ({ page }) => {
  await signIn(page, 'coordinator-a@integration.local'); await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'คิวงานติดตาม' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เพิ่มเคส' })).toBeVisible();
  await expect(page.getByText('จัดการคลินิก')).toHaveCount(0);
  await page.goto('/admin'); await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'เพิ่มเคส' }).click();
  const modal = page.getByRole('dialog', { name: 'ลงทะเบียนเคสใหม่' });
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && Math.abs(box.x + box.width / 2 - viewport.width / 2) < 2).toBeTruthy();
  await page.getByRole('button', { name: 'ปิด' }).click();
  expect((await api(page, '/api/clinic/admin')).status).toBe(403);
  expect((await api(page, '/api/cases')).status).toBe(200);
  await signOut(page);
  await signIn(page, 'viewer-a@integration.local');
  await expect(page.getByRole('button', { name: 'เพิ่มเคส' })).toHaveCount(0);
  expect((await api(page, '/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientDecision: { kind: 'create', patient: { fullName: 'Viewer denied' } }, sourceReceivedAt: new Date().toISOString(), priority: 'normal' }) })).status).toBe(403);
  await signOut(page);
  await signIn(page, 'admin-a@integration.local');
  await expect(page.getByText('จัดการคลินิก')).toBeVisible();
  const before = await api(page, '/api/clinic/admin'); expect(before.status).toBe(200);
  expect((await api(page, '/api/clinic/memberships')).status).toBe(200);
  expect((await api(page, '/api/clinic/admin/config', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Care D Clinic · One Day Surgery (test)', caseNumberPrefix: 'CDS' }) })).status).toBe(200);
  expect((await api(page, '/api/clinic/admin/sources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', code: 'integration', label: 'Integration source' }) })).status).toBe(200);
  expect((await api(page, '/api/clinic/admin/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Integration Plan', steps: [{ sequence: 1, dayOffset: 1, dueTime: '10:00', instruction: 'Test' }] }) })).status).toBe(201);
  expect((await api(page, '/api/clinic/admin/audit')).status).toBe(200);
  await signOut(page);
  await signIn(page, 'admin-b@integration.local');
  const created = await api(page, '/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientDecision: { kind: 'create', patient: { fullName: 'CRUD Integration Patient', phone: '0890000000' } }, sourceReceivedAt: new Date().toISOString(), priority: 'normal' }) });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const caseId = created.body.id;
  const patientId = created.body.patient_id;
  expect((await api(page, `/api/cases/${caseId}`)).status).toBe(200);
  expect((await api(page, '/api/patients?query=CRUD%20Integration')).status).toBe(200);
  expect((await api(page, `/api/patients/${patientId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0890000001' }) })).status).toBe(200);
  const reference = await api(page, '/api/reference-data');
  expect((await api(page, `/api/cases/${caseId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priority: 'high' }) })).status).toBe(200);
  expect((await api(page, `/api/cases/${caseId}/assign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nurseId: reference.body.nurses[0].user_id, reason: 'Integration workflow' }) })).status).toBe(200);
  const manualTask = await api(page, `/api/cases/${caseId}/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'Integration retry', dueAt: new Date(Date.now() + 3600000).toISOString() }) });
  expect(manualTask.status).toBe(201);
  expect((await api(page, `/api/follow-up-tasks/${manualTask.body.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'paused', reason: 'Wait for patient' }) })).status).toBe(200);
  const result = await api(page, '/api/follow-up-results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId: manualTask.body.id, occurredAt: new Date().toISOString(), contactChannel: 'phone', contactStatus: 'contacted', outcome: 'Reached', summary: 'Integration result' }) });
  expect(result.status).toBe(201);
  expect((await api(page, '/api/follow-up-results', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resultId: result.body.id, reason: 'Clarified summary', summary: 'Corrected summary' }) })).status).toBe(201);
  const appointment = await api(page, '/api/appointments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId, startsAt: new Date(Date.now() + 86400000).toISOString(), appointmentType: 'Integration appointment' }) });
  expect(appointment.status).toBe(201);
  expect((await api(page, '/api/appointments', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appointmentId: appointment.body.id, status: 'rescheduled', reason: 'Patient request', startsAt: new Date(Date.now() + 172800000).toISOString() }) })).status).toBe(200);
  expect((await api(page, `/api/cases/${caseId}/lifecycle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'close', reason: 'Completed workflow' }) })).status).toBe(200);
  expect((await api(page, `/api/cases/${caseId}/lifecycle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reopen' }) })).status).toBe(200);
});
