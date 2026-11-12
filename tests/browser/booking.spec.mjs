import { test, expect } from '@playwright/test';

const profile = { patientId: 42, patientNo: 'TEST-P42', fullName: 'ANA MARIA DELA CRUZ', firstName: 'ANA MARIA', lastName: 'DELA CRUZ', middleName: 'PEÑA', dateOfBirth: '1990-01-01', sex: 'FEMALE', email: 'patient@example.invalid', phone: '09120000000', streetAddress: '12 TEST STREET', province: 'TEST PROVINCE', municipality: 'TEST CITY', barangay: 'TEST BARANGAY', zipCode: '1000' };
const session = { token: 'mock-booking-token', mustChangePassword: false, patient: profile };
const items = Array.from({ length: 6 }, (_, i) => ({ id: i + 100, itemId: i + 1, itemDescription: `Test examination ${i + 1}`, amount: (i + 1) * 100, departmentId: 1, category: 'LAB', categoryDescription: 'Laboratory', chargesType: 'CHARGES' }));
const saved = { appointmentId: 1, appointmentNo: 'TEST-VISIT-42', invoiceNumber: 'TEST-INVOICE', emailSent: false };

async function setup(page, options = {}) {
  const calls = [];
  let confirmations = 0;
  let activeSession = options.session || session;
  await page.clock.install({ time: new Date('2026-11-12T04:00:00Z') });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:5194') return route.continue();
    if (url.origin !== 'http://127.0.0.1:5160') return route.abort();
    const body = request.postDataJSON();
    calls.push({ path: url.pathname, body, authorization: request.headers().authorization, method: request.method() });
    const path = url.pathname.replace('/api/appointments/', '');
    if (path === 'items') return route.fulfill({ json: items });
    if (path === 'portal-profile') return route.fulfill({ json: activeSession.patient });
    if (path === 'province') return route.fulfill({ json: ['TEST PROVINCE'] });
    if (path === 'province/city') return route.fulfill({ json: ['TEST CITY'] });
    if (path === 'province/city/brgy') return route.fulfill({ json: ['TEST BARANGAY'] });
    if (path === 'province/city/brgy/zipcode') return route.fulfill({ json: '1000' });
    if (path === 'confirm') {
      confirmations++;
      if (confirmations === 1 && options.expire) return route.fulfill({ status: 401, json: { message: 'Expired mock booking session' } });
      if (confirmations === 1 && options.uncertain) return route.abort();
      return route.fulfill({ json: saved });
    }
    if (path === 'confirm/email') return route.fulfill({ json: { ...saved, emailSent: true } });
    if (url.pathname.endsWith('/auth/login')) {
      activeSession = options.reconnectSession || { ...session, token: 'mock-reconnected-token' };
      return route.fulfill({ json: activeSession });
    }
    if (url.pathname.endsWith('/auth/change-password')) return route.fulfill({ json: { message: 'Mock password updated.' } });
    if (url.pathname.endsWith('/appointments')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: 'Unknown mock endpoint' } });
  });
  await page.addInitScript(stored => {
    if (stored) sessionStorage.setItem('patient-portal-session', JSON.stringify(stored));
  }, options.guest ? null : activeSession);
  return calls;
}

async function toDetails(page) {
  await page.goto('/#/book');
  await page.getByRole('button', { name: /Test examination 1/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[type="date"]').fill('2026-11-13');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Patient first name')).toHaveValue('ANA MARIA');
}

async function toReview(page) {
  await toDetails(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('No payment is collected online.', { exact: false })).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test('Book new stays inside the website and service selection survives search and pagination', async ({ page, context }) => {
  const calls = await setup(page);
  await page.goto('/#/appointments');
  await page.getByRole('link', { name: 'Book new', exact: true }).click();
  await expect(page).toHaveURL(/#\/book$/);
  await page.getByRole('button', { name: /Test examination 1/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Test examination 5/ }).click();
  await page.getByLabel('Search services').fill('examination 1');
  await expect(page.getByRole('button', { name: /Test examination 1/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Showing 1–1 of 1')).toBeVisible();
  await page.getByLabel('Search services').fill('no matching examination');
  await expect(page.getByText('No services found.')).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  expect(calls.find(call => call.path.endsWith('portal-profile')).authorization).toBe('Bearer mock-booking-token');
  expect(page.url()).not.toContain('mock-booking-token');
});

test('verified identity and self or other drafts stay separate on desktop and mobile', async ({ page }) => {
  await setup(page);
  await toDetails(page);
  await expect(page.getByLabel('Patient first name')).toBeDisabled();
  await expect(page.getByLabel('Patient last name')).toHaveValue('DELA CRUZ');
  await page.getByLabel('Notes', { exact: true }).fill('Self notes');
  await page.getByRole('button', { name: 'Someone else', exact: true }).click();
  await expect(page.getByLabel('Patient first name')).toHaveValue('');
  await expect(page.getByLabel('Date of birth')).toHaveValue('');
  await page.getByLabel('Patient first name').fill('OTHER');
  await page.getByLabel('Date of birth').fill('2000-02-03');
  await page.getByLabel('Notes', { exact: true }).fill('Other notes');
  await page.getByLabel('Relationship').fill('Child');
  await page.getByRole('button', { name: 'Myself', exact: true }).click();
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Self notes');
  await expect(page.getByLabel('Date of birth')).toHaveValue('1990-01-01');
  await page.getByRole('button', { name: 'Someone else', exact: true }).click();
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Other notes');
  await expect(page.getByLabel('Patient first name')).toHaveValue('OTHER');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `node_modules/.tmp/portal-screenshots/integrated-booking-${width}.png`, fullPage: true });
  }
});

test('uncertain confirmation reuses the exact payload and email retry never creates another booking', async ({ page }) => {
  const calls = await setup(page, { uncertain: true });
  await toReview(page);
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByText('Failed to fetch', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TEST-VISIT-42' })).toBeVisible();
  const confirmations = calls.filter(call => call.path.endsWith('/confirm'));
  expect(confirmations).toHaveLength(2);
  expect(confirmations[1].body).toEqual(confirmations[0].body);
  expect(confirmations[0].body).toMatchObject({ amountPaid: 0, paymentMethod: 'Pay at clinic', usePortalProfile: true, portalPatientNo: 'TEST-P42', totalAmount: 100, isForSomeoneElse: false });
  expect(confirmations[0].body).not.toHaveProperty('token');
  expect(confirmations[0].body).not.toHaveProperty('patientId');
  await page.getByRole('button', { name: 'Resend confirmation email' }).click();
  await expect(page.getByText('were sent to', { exact: false })).toBeVisible();
  expect(calls.filter(call => call.path.endsWith('/confirm'))).toHaveLength(2);
  expect(calls.find(call => call.path.endsWith('/confirm/email')).body).toEqual(confirmations[0].body);
  const retryStorage = await page.evaluate(() => sessionStorage.getItem('appointment-confirmation-attempt'));
  expect(Object.keys(JSON.parse(retryStorage)).sort()).toEqual(['fingerprint', 'requestId']);
});

test('expired confirmation keeps the pending booking through same-page sign-in', async ({ page }) => {
  const calls = await setup(page, { expire: true });
  await toReview(page);
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('patient-portal-session'))).toBeNull();
  await page.getByLabel('Patient number', { exact: true }).fill('TEST-P42');
  await page.getByLabel('Password', { exact: true }).fill('MockPassword1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TEST-VISIT-42' })).toBeVisible();
  const confirmations = calls.filter(call => call.path.endsWith('/confirm'));
  expect(confirmations[1].body).toEqual(confirmations[0].body);
  expect(confirmations[1].authorization).toBe('Bearer mock-reconnected-token');
});

test('another account cannot resume a pending patient booking', async ({ page }) => {
  const calls = await setup(page, { expire: true, reconnectSession: { ...session, token: 'mock-other-token', patient: { ...profile, patientNo: 'TEST-OTHER' } } });
  await toReview(page);
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await page.getByLabel('Patient number', { exact: true }).fill('TEST-OTHER');
  await page.getByLabel('Password', { exact: true }).fill('MockPassword1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Sign in with the same patient account to continue this booking.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm appointment', exact: true })).toBeDisabled();
  expect(calls.filter(call => call.path.endsWith('/confirm'))).toHaveLength(1);
});

test('public booking enters the integrated flow and optional sign-in completes password change first', async ({ page, context }) => {
  const calls = await setup(page, { guest: true, reconnectSession: { ...session, mustChangePassword: true } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Book an appointment', exact: true }).click();
  await expect(page).toHaveURL(/#\/book$/);
  await page.getByRole('button', { name: 'Sign in to patient portal' }).click();
  await page.getByLabel('Patient number', { exact: true }).fill('TEST-P42');
  await page.getByLabel('Password', { exact: true }).fill('MockPassword1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your private password' })).toBeVisible();
  expect(calls.filter(call => call.path.endsWith('portal-profile'))).toHaveLength(0);
  expect(context.pages()).toHaveLength(1);
});
