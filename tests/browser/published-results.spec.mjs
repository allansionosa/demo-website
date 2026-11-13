import { test, expect } from '@playwright/test';

const patient = { patientId: 7001, patientNo: 'SYN-7001', fullName: 'Synthetic Patient', email: 'synthetic@example.invalid' };
const session = { token: 'synthetic-session', mustChangePassword: false, patient };
const result = { onlineResultId: 1, examinationId: 11, departmentCode: 'LAB', department: 'Laboratory', description: 'Synthetic released examination', examinationNo: 'SYN-LAB', examinationDate: '2026-11-12T10:00:00', validatedDate: '2026-11-13T10:00:00' };
function pdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream'];
  let text = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((value, i) => { offsets.push(Buffer.byteLength(text)); text += `${i + 1} 0 obj\n${value}\nendobj\n`; });
  const offset = Buffer.byteLength(text); text += 'xref\n0 5\n0000000000 65535 f \n' + offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('');
  return text + `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
}
async function setup(page, options = {}) {
  const calls = [], control = { status: 200, firstFailure: false };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:5194' || url.protocol === 'blob:') return route.continue();
    if (url.origin !== 'http://127.0.0.1:5160') return route.abort();
    calls.push({ path: url.pathname, search: url.search, authorization: request.headers().authorization, method: request.method() });
    const path = url.pathname.replace('/api/patient-portal/', '');
    if (path === 'results/published') {
      let items = Array.from({ length: options.many ? 61 : 1 }, (_, i) => ({ ...result, onlineResultId: i + 1, examinationId: i + 11, description: i ? 'Synthetic earlier examination ' + i : result.description }));
      const search = url.searchParams.get('search') || '';
      if (search) items = items.filter(r => r.description.toLowerCase().includes(search.toLowerCase()));
      if (url.searchParams.get('department') && url.searchParams.get('department') !== 'LAB') items = [];
      const pageNumber = Number(url.searchParams.get('page') || 1);
      return route.fulfill({ json: { items: items.slice((pageNumber - 1) * 50, pageNumber * 50), totalCount: items.length, page: pageNumber, pageSize: 50 } });
    }
    if (/results\/published\/\d+\/pdf/.test(path)) {
      if (control.status !== 200) return route.fulfill({ status: control.status, json: { message: control.status === 404 ? 'This report is no longer available.' : control.status === 401 ? 'Expired session' : 'The report copy is temporarily unavailable. Please try again.' } });
      return route.fulfill({ contentType: 'application/pdf', body: pdf(), headers: { 'Cache-Control': 'no-store, private' } });
    }
    if (path === 'profile') return route.fulfill({ json: patient });
    if (path === 'results') return route.fulfill({ json: [result] });
    if (path === 'appointments' || path === 'bills') return route.fulfill({ json: [] });
    if (path === 'dashboard') return route.fulfill({ json: { profile: patient, upcomingAppointments: 0, availableResults: 1, outstandingBalance: 0, nextAppointment: null, recentResults: [result] } });
    return route.fulfill({ status: 404, json: { message: 'Unknown synthetic route' } });
  });
  if (!options.signedOut) await page.addInitScript(stored => sessionStorage.setItem('patient-portal-session', JSON.stringify(stored)), session);
  return { calls, control };
}

test('published PDF preview open and download use bearer requests without token URLs', async ({ page }) => {
  const { calls } = await setup(page);
  await page.goto('/#/results');
  await page.getByRole('button', { name: 'View result: ' + result.description, exact: true }).click();
  await expect(page.getByTitle('Released report PDF')).toHaveAttribute('src', /^blob:/);
  const beforeOpen = calls.filter(c => c.path.endsWith('/pdf')).length;
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open / Print PDF', exact: true }).click();
  const popup = await popupPromise; expect(popup.url()).toMatch(/^blob:/); expect(popup.url()).not.toContain(session.token); await popup.close(); expect(calls.filter(c => c.path.endsWith('/pdf')).length).toBe(beforeOpen + 1);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Result-1.pdf');
  const pdfCalls = calls.filter(c => c.path.endsWith('/pdf'));
  expect(pdfCalls).toHaveLength(beforeOpen + 2); expect(pdfCalls.every(c => c.authorization === 'Bearer ' + session.token && c.search === '' && c.method === 'GET')).toBe(true);
  await page.screenshot({ path: 'node_modules/.tmp/portal-screenshots/published-pdf-desktop.png' });
});

test('withdrawn PDF is removed from the viewer and cannot be downloaded again', async ({ page }) => {
  const { control } = await setup(page); await page.goto('/#/results');
  await page.getByRole('button', { name: 'View result: ' + result.description, exact: true }).click(); await expect(page.getByTitle('Released report PDF')).toBeVisible();
  control.status = 404; await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('no longer available'); await expect(page.getByTitle('Released report PDF')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled();
});

test('missing PDF can retry and expired PDF requests clear the patient session', async ({ page }) => {
  const { control } = await setup(page); control.status = 503; await page.goto('/#/results');
  await page.getByRole('button', { name: 'View result: ' + result.description, exact: true }).click(); await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  control.status = 200; await page.getByRole('button', { name: /try again/i }).click(); await expect(page.getByTitle('Released report PDF')).toBeVisible();
  control.status = 401; await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  await expect(page.getByText('Your session has expired.', { exact: false })).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('patient-portal-session'))).toBeNull();
});

test('published result filters reset bounded pagination and preserve input focus', async ({ page }) => {
  const { calls } = await setup(page, { many: true }); await page.goto('/#/results');
  await expect(page.getByText('61 results', { exact: true })).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(11); await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  const search = page.getByLabel('Search diagnostic results'); await search.fill('released'); await expect(search).toBeFocused(); await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible();
  expect(calls.some(c => c.search.includes('page=2'))).toBe(true);
  for (const [width, height] of [[1366, 768], [1024, 768], [768, 1024]]) { await page.setViewportSize({ width, height }); await page.screenshot({ path: `node_modules/.tmp/portal-screenshots/published-results-${width}.png` }); const metrics = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width}))})); expect(metrics.scroll,JSON.stringify(metrics)).toBeLessThanOrEqual(width+1); }
});

test('online portal dropdown keeps doctor entry separate from patient sign in', async ({ page }) => {
  const { calls } = await setup(page, { signedOut: true }); await page.goto('/#/home');
  await page.locator('.online-portal-toggle').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Online portals' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Online portals' }).getByRole('link', { name: /Doctor Portal/ }).click();
  await expect(page).toHaveURL(/#\/doctor-portal$/); await expect(page.getByRole('heading', { name: 'Doctor Portal', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled(); await expect(page.getByRole('status')).toContainText('not available yet');
  expect(calls.filter(c => c.path.includes('/auth/'))).toEqual([]);
  for (const [width, height] of [[1366, 768], [1024, 768], [768, 1024]]) { await page.setViewportSize({ width, height }); await page.locator('.online-portal-toggle').click(); await expect(page.getByRole('navigation', { name: 'Online portals' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: `node_modules/.tmp/portal-screenshots/online-portal-${width}.png` }); await page.keyboard.press('Escape'); await expect(page.locator('.online-portal-toggle')).toBeFocused(); }
  await page.locator('.online-portal-toggle').click(); await page.getByRole('navigation', { name: 'Online portals' }).getByRole('link', { name: /Patient Portal/ }).click(); await expect(page).toHaveURL(/#\/portal$/);
});
