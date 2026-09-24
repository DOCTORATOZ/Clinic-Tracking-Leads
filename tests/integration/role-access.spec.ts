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
  expect((await api(page, '/api/clinic/admin')).status).toBe(403);
  expect((await api(page, '/api/cases')).status).toBe(200);
  await signOut(page);
  await signIn(page, 'viewer-a@integration.local');
  expect((await api(page, '/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientDecision: { kind: 'create', patient: { fullName: 'Viewer denied' } }, sourceReceivedAt: new Date().toISOString(), priority: 'normal' }) })).status).toBe(403);
  await signOut(page);
  await signIn(page, 'admin-a@integration.local');
  const before = await api(page, '/api/clinic/admin'); expect(before.status).toBe(200);
  expect((await api(page, '/api/clinic/admin/config', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Integration Clinic A Updated', caseNumberPrefix: 'ITX' }) })).status).toBe(200);
  expect((await api(page, '/api/clinic/admin/sources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', code: 'integration', label: 'Integration source' }) })).status).toBe(200);
  expect((await api(page, '/api/clinic/admin/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Integration Plan', steps: [{ sequence: 1, dayOffset: 1, dueTime: '10:00', instruction: 'Test' }] }) })).status).toBe(201);
  expect((await api(page, '/api/clinic/admin/audit')).status).toBe(200);
});
