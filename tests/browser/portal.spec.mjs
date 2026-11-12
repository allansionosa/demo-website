import { test, expect } from '@playwright/test';

const patient = { patientId: 900001, patientNo: 'TEST-ONLY-001', fullName: 'Synthetic Test Patient', firstName: 'Synthetic', email: 'synthetic@example.invalid' };
const session = { token: 'mock-session-only', mustChangePassword: false, patient };
const appointments = [
  { id: 1, appointmentNo: 'TEST-VISIT-1', invoiceNumber: 'TEST-INVOICE-1', appointmentDate: '2026-10-07T00:00:00', branch: 'Synthetic Clinic', status: 'Confirmed', caseId: null, totalAmount: 100, amountPaid: 0, services: [{ id: 1, itemId: 11, description: 'Synthetic test service', quantity: 1, price: 100 }] },
  { id: 2, appointmentNo: 'TEST-VISIT-2', invoiceNumber: 'TEST-INVOICE-2', appointmentDate: '2026-09-01T00:00:00', branch: 'Synthetic Clinic', status: 'Completed', caseId: 2, totalAmount: 100, amountPaid: 100, services: [] },
  { id: 3, appointmentNo: 'TEST-VISIT-3', invoiceNumber: 'TEST-INVOICE-3', appointmentDate: '2026-10-08T00:00:00', branch: 'Synthetic Clinic', status: 'Cancelled', caseId: null, totalAmount: 100, amountPaid: 0, services: [] },
];
const results = [
  { examinationId: 10, departmentCode: 'LAB', department: 'Laboratory', description: 'Synthetic laboratory report', examinationNo: 'TEST-LAB', examinationDate: '2026-10-05T00:00:00', validatedDate: '2026-10-06T08:00:00' },
  { examinationId: 20, departmentCode: 'XRA', department: 'Radiology', description: 'Synthetic imaging report', examinationNo: 'TEST-XRA', examinationDate: '2026-10-04T00:00:00', validatedDate: '2026-10-05T08:00:00' },
];
const laboratory = { departmentCode: 'LAB', header: { Name: patient.fullName, ExamTitle: 'Synthetic laboratory report', PatientId: 999999, Id: 888888 }, details: [
  { Test: 'Zero reading', Result: 0, Unit: 'mg/dL', Reference: '0–5', SIResult: 0, SIUnit: 'mmol/L', SIReference: '0–1', PrintRow: true },
  { Test: 'Hidden template row', Result: 5, PrintRow: false },
] };
const imaging = { departmentCode: 'XRA', header: { Name: patient.fullName, Findings: '<p>Synthetic first paragraph</p><p>Second paragraph<br>New line</p><script>window.reportInjected = true</script>', Impression: 'Synthetic impression' }, details: [{ Findings: 'Synthetic continuation' }] };
const dashboard = { profile: patient, upcomingAppointments: 1, availableResults: 2, outstandingBalance: 0, nextAppointment: appointments[0], recentResults: results };

async function setup(page, options = {}) {
  await page.clock.install({ time: new Date('2026-10-06T04:00:00Z') });
  const calls = [];
  let expired = Boolean(options.expired);
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:5194') return route.continue();
    // Abort every external request except our fully mocked API. No live writes.
    if (url.origin !== 'http://127.0.0.1:5160' || !url.pathname.startsWith('/api/patient-portal/')) return route.abort();
    calls.push({ path: url.pathname, method: request.method(), body: request.postData(), authorization: request.headers().authorization });
    const path = url.pathname.replace('/api/patient-portal/', '');
    if (path === 'auth/login') {
      if (options.badLogin) return route.fulfill({ status: 401, json: { message: 'The patient number or password is incorrect.' } });
      expired = false;
      return route.fulfill({ json: options.loginSession || session });
    }
    if (expired && request.headers().authorization) return route.fulfill({ status: 401, json: { message: 'Expired mock session' } });
    if (path === 'auth/change-password') return route.fulfill({ json: { message: 'Mock password changed.' } });
    if (path === 'auth/logout') return route.fulfill({ status: 204 });
    if (path === 'auth/forgot-password') return route.fulfill({ json: { message: 'Mock reset response.' } });
    if (path === 'appointments') return route.fulfill({ json: options.appointments || appointments });
    if (path === 'results') return route.fulfill({ json: options.results || results });
    if (path === 'results/LAB/10') return route.fulfill({ json: laboratory });
    if (path === 'results/XRA/20') return route.fulfill({ json: imaging });
    if (path === 'dashboard') return route.fulfill({ json: dashboard });
    if (path === 'profile') return route.fulfill({ json: patient });
    if (path === 'bills') return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: 'Unknown mock endpoint' } });
  });
  await page.addInitScript(({ stored }) => {
    if (stored) sessionStorage.setItem('patient-portal-session', JSON.stringify(stored));
  }, { stored: options.signedOut ? null : options.storedSession || session });
  return calls;
}

test('expired authenticated requests clear the session and return to the prior page after sign-in', async ({ page }) => {
  const calls = await setup(page, { expired: true });
  await page.goto('/#/results');
  await expect(page.getByText('Your session has expired.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('patient-portal-session'))).toBeNull();
  await page.getByLabel('Patient number', { exact: true }).fill('TEST-ONLY-001');
  await page.getByLabel('Password', { exact: true }).fill('MockPassword1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Diagnostic results', exact: true })).toBeVisible();
  expect(page.url()).toContain('#/results');
  expect(calls.filter((call) => call.path.endsWith('auth/login'))).toHaveLength(1);
});

test('incorrect login stays on sign-in and does not show an expired-session notice', async ({ page }) => {
  await setup(page, { signedOut: true, badLogin: true });
  await page.goto('/#/dashboard');
  await page.getByLabel('Patient number', { exact: true }).fill('TEST-ONLY-001');
  await page.getByLabel('Password', { exact: true }).fill('MockWrong1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await expect(page.getByText('Your session has expired.', { exact: false })).toHaveCount(0);
});

test('results preserve zero and SI values, filter accurately, and distinguish no matches', async ({ page }) => {
  await setup(page);
  await page.goto('/#/results');
  await page.getByRole('button', { name: 'View result: Synthetic laboratory report', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Zero reading', exact: true })).toBeVisible();
  await expect(dialog.locator('dd', { hasText: /^0$/ })).toHaveCount(2);
  await expect(dialog.getByText('SI reference range', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Hidden template row', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('999999', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByLabel('Department', { exact: true }).selectOption('XRA');
  await expect(page.getByRole('button', { name: 'View result: Synthetic laboratory report', exact: true })).toHaveCount(0);
  await page.getByLabel('Search diagnostic results').fill('nothing matches');
  await expect(page.getByRole('heading', { name: 'No matching results', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'View result:', exact: false })).toHaveCount(2);
  await page.getByLabel('Released from', { exact: true }).fill('2026-10-06');
  await expect(page.getByRole('button', { name: 'View result:', exact: false })).toHaveCount(1);
});

test('imaging narratives are inert, preserve paragraphs, and dialogs contain and restore keyboard focus', async ({ page }) => {
  await setup(page);
  await page.goto('/#/results');
  const opener = page.getByRole('button', { name: 'View result: Synthetic imaging report', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Synthetic continuation', { exact: true })).toBeVisible();
  expect(await dialog.locator('.report-narrative p').first().textContent()).toBe('Synthetic first paragraph\nSecond paragraph\nNew line');
  expect(await page.evaluate(() => window.reportInjected)).toBeUndefined();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});

test('released report text download and print output contain only the selected report', async ({ page }) => {
  await setup(page);
  await page.goto('/#/results');
  await page.getByRole('button', { name: 'View result: Synthetic laboratory report', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Download text copy' })).toBeEnabled();
  const pendingDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download text copy' }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('released-report.txt');
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk.toString();
  expect(content).toContain('Result: 0');
  expect(content).toContain('SI result: 0');
  expect(content).not.toContain('mock-session-only');
  expect(content).not.toContain('Synthetic imaging report');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(dialog.locator('.printable-report')).toBeVisible();
  await expect(dialog.locator('.report-actions')).toBeHidden();
  await page.screenshot({ path: 'node_modules/.tmp/portal-screenshots/report-print.png', fullPage: true });
});

test('appointment periods exclude cancelled visits from upcoming and export an all-day calendar', async ({ page }) => {
  await setup(page);
  await page.goto('/#/appointments');
  await expect(page.getByText('TEST-VISIT-1', { exact: true })).toBeVisible();
  await expect(page.getByText('TEST-VISIT-3', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show booked services' }).click();
  await expect(page.getByRole('button', { name: 'Hide booked services' })).toHaveAttribute('aria-expanded', 'true');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add to calendar' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) content += chunk.toString();
  expect(content).toContain('DTSTART;VALUE=DATE:20261007');
  expect(content).not.toContain('Synthetic Test Patient');
  await page.getByRole('button', { name: 'Past and closed', exact: true }).click();
  await expect(page.getByText('TEST-VISIT-2', { exact: true })).toBeVisible();
  await expect(page.getByText('TEST-VISIT-3', { exact: true })).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('Cancelled');
  await expect(page.getByText('TEST-VISIT-2', { exact: true })).toHaveCount(0);
});

test('notification read state survives reload, preferences work, and logout clears tab state', async ({ page }) => {
  await setup(page);
  await page.goto('/#/dashboard');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Mark all read' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Mark all read' }).click();
  await dialog.getByRole('button', { name: 'Unread (0)', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  await dialog.getByLabel('Released results', { exact: true }).uncheck();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(dialog.getByLabel('Released results', { exact: true })).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Unread (0)', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('patient-portal-notifications'))).toBeNull();
});

test('mobile navigation is keyboard accessible and records do not overflow the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await page.goto('/#/results');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const navigation = page.getByRole('dialog', { name: 'Portal navigation' });
  await expect(navigation.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(navigation.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'View result: Synthetic laboratory report', exact: true }).click();
  expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'node_modules/.tmp/portal-screenshots/results-mobile.png', animations: 'disabled' });
});

test('dashboard attention actions open released reports directly', async ({ page }) => {
  await setup(page);
  await page.goto('/#/dashboard');
  await expect(page.getByRole('heading', { name: 'Good day, Synthetic' })).toBeVisible();
  await page.screenshot({ path: 'node_modules/.tmp/portal-screenshots/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Review your latest released report/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Zero reading' })).toBeVisible();
});

test('new sign-in as another patient resets notification state and uses only their authenticated records', async ({ page }) => {
  const otherSession = { token: 'mock-other-session', mustChangePassword: false, patient: { ...patient, patientId: 900002, patientNo: 'TEST-ONLY-002', fullName: 'Other Synthetic Patient' } };
  const calls = await setup(page, { signedOut: true, loginSession: otherSession, appointments: [], results: [] });
  await page.goto('/#/dashboard');
  await page.evaluate(() => sessionStorage.setItem('patient-portal-notifications', JSON.stringify({ read: ['old-patient-record'], preferences: { appointments: false, results: false } })));
  await page.getByLabel('Patient number', { exact: true }).fill('TEST-ONLY-002');
  await page.getByLabel('Password', { exact: true }).fill('MockPassword1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Released results', { exact: true })).toBeChecked();
  await expect(dialog.getByRole('heading', { name: 'No updates to show' })).toBeVisible();
  expect(calls.filter((call) => !call.path.includes('/auth/')).every((call) => call.authorization === 'Bearer mock-other-session')).toBe(true);
  expect(calls.every((call) => !call.body?.includes('patientId'))).toBe(true);
});

test('first sign-in completes the mandatory password change before loading patient records', async ({ page }) => {
  const calls = await setup(page, { storedSession: { ...session, mustChangePassword: true } });
  await page.goto('/#/results');
  await expect(page.getByRole('heading', { name: 'Create your private password' })).toBeVisible();
  expect(calls).toHaveLength(0);
  await page.getByLabel('Temporary password', { exact: true }).fill('MockTemporary1!');
  await page.getByLabel('New password', { exact: true }).fill('MockNewPassword1!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('MockNewPassword1!');
  await page.getByRole('button', { name: 'Update password and continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Diagnostic results', exact: true })).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith('auth/change-password'))).toHaveLength(1);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('patient-portal-session')).mustChangePassword)).toBe(false);
});

test('password reset uses a mocked request and returns focus to its opening control', async ({ page }) => {
  const calls = await setup(page, { signedOut: true });
  await page.goto('/#/dashboard');
  const opener = page.getByRole('button', { name: 'Forgot your password?' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Patient number', { exact: true }).fill('TEST-ONLY-001');
  await dialog.getByLabel('Booking email', { exact: true }).fill('synthetic@example.invalid');
  await dialog.getByRole('button', { name: 'Send temporary password', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith('auth/forgot-password'))).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Back to sign in', exact: true }).click();
  await expect(opener).toBeFocused();
});

test('a previous token’s unauthorized response cannot clear the current session', async ({ page }) => {
  await setup(page);
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'My profile', exact: true })).toBeVisible();
  await page.route('**/api/patient-portal/profile', (route) => route.fulfill({ status: 401, json: { message: 'Old mock token expired' } }));
  await page.evaluate(async () => {
    const { portalApi } = await import('/src/api.ts');
    try { await portalApi.getProfile('old-mock-token'); } catch { /* Expected old-token failure. */ }
  });
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('patient-portal-session')).token)).toBe('mock-session-only');
  await expect(page.getByRole('heading', { name: 'My profile', exact: true })).toBeVisible();
});

test('failed results can retry and genuine empty records are distinguished from search misses', async ({ page }) => {
  await setup(page, { results: [] });
  let failed = true;
  await page.route('**/api/patient-portal/results', (route) => route.fulfill(failed ? { status: 503, json: { message: 'Mock service unavailable' } } : { json: [] }));
  await page.goto('/#/results');
  await expect(page.getByRole('heading', { name: 'We couldn’t load this information' })).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No released results yet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No matching results' })).toHaveCount(0);
});

test('portal Book opens an internal page without exposing the session or opening another tab', async ({ page, context }) => {
  await setup(page);
  await page.goto('/#/dashboard');
  await page.getByRole('link', { name: 'Book an appointment', exact: true }).click();
  await expect(page).toHaveURL(/#\/book$/);
  await expect(page.getByRole('heading', { name: 'Examination and procedure booking' })).toBeVisible();
  await page.evaluate(() => window.postMessage({ type: 'appointment:connect', nonce: 'wrong-window' }, window.location.origin));
  expect(context.pages()).toHaveLength(1);
  expect(page.url()).not.toContain('mock-session-only');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('patient-portal-session')).token)).toBe('mock-session-only');
});
