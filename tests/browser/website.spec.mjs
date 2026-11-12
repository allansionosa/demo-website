import { test, expect } from '@playwright/test';

async function isolateDemo(page) {
  const external = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-11-04T04:00:00Z') });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:5194') return route.continue();
    external.push(url.origin);
    return route.abort();
  });
  return external;
}

async function enterDemo(page) {
  await page.goto('/#/portal');
  await page.getByRole('button', { name: 'Explore demo portal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good day, Alex', exact: true })).toBeVisible();
}

test('public website has navigable pages, searchable services, and doctor profiles', async ({ page }) => {
  const external = await isolateDemo(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your care. Connected.' })).toBeVisible();
  await page.screenshot({ path: 'node_modules/.tmp/portal-screenshots/clinic-home-desktop.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Our services' }).click();
  await expect(page.locator('#clinic-content')).toBeFocused();
  expect(await page.evaluate(() => {
    const title = document.querySelector('h1').getBoundingClientRect();
    const header = document.querySelector('header').getBoundingClientRect();
    return title.top - header.bottom;
  })).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Laboratory', exact: true }).click();
  await expect(page.locator('.clinic-service-card')).toHaveCount(1);
  await page.getByLabel('Search services').fill('no such service');
  await expect(page.getByRole('heading', { name: 'No matching services' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.clinic-service-card')).toHaveCount(6);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Our doctors' }).click();
  await page.getByLabel('Specialty', { exact: true }).selectOption('Cardiology');
  await expect(page.locator('.clinic-doctor-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'View profile: Dr. Daniel Cruz' }).click();
  await expect(page.getByRole('dialog')).toContainText('FICTIONAL CLINICIAN');
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'About us' }).click();
  await expect(page.getByRole('heading', { name: 'Care that stays connected.' })).toBeVisible();
  await page.getByRole('link', { name: 'Questions & answers' }).click();
  await page.getByText('Does a demo booking reserve a real appointment?', { exact: true }).click();
  await expect(page.locator('details[open]')).toContainText('No. Demo bookings');
  await page.getByRole('link', { name: 'Privacy & demo information' }).click();
  await expect(page.getByRole('heading', { name: 'Your demo privacy.' })).toBeVisible();
  expect(external).toEqual([]);
});

test('homepage service picker shows the matching fee and opens the selected booking', async ({ page }) => {
  const external = await isolateDemo(page);
  await enterDemo(page);
  await page.goto('/');
  await page.getByLabel('What brings you in?').selectOption('106');
  await expect(page.locator('.clinic-finder-fee')).toContainText('1,200.00');
  await page.getByRole('button', { name: 'Book an appointment', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Service', { exact: true })).toHaveValue('106');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Book an appointment', exact: true })).toBeFocused();
  expect(external).toEqual([]);
});

test('self demo booking is reviewed, saved once, survives reload, and appears in the demo portal', async ({ page }) => {
  const external = await isolateDemo(page);
  await enterDemo(page);
  await page.goto('/#/services');
  await page.locator('.clinic-service-card').filter({ has: page.getByRole('heading', { name: 'Complete blood count', exact: true }) }).getByRole('button', { name: 'Book this service' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Service', { exact: true })).toHaveValue('102');
  await dialog.getByLabel('Visit date', { exact: true }).fill('2026-11-06');
  await dialog.getByLabel('Booking notes (optional)').fill('Fictional self notes');
  await dialog.getByRole('button', { name: 'Review demo visit' }).click();
  await expect(dialog).toContainText('Alex Santos · Demo patient');
  await expect(dialog).toContainText('No payment collected');
  await dialog.getByRole('button', { name: 'Confirm demo booking' }).click();
  const reference = await dialog.locator('.clinic-booking-reference').textContent();
  await dialog.getByRole('button', { name: 'View my demo appointments' }).click();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  const visits = await page.evaluate(() => JSON.parse(sessionStorage.getItem('patient-portal-demo-visits-v1')));
  expect(visits).toHaveLength(3);
  expect(visits.filter((visit) => visit.appointmentNo === reference)).toHaveLength(1);
  expect(external).toEqual([]);
});

test('demo Book new stays local and never sends a fictional session', async ({ page, context }) => {
  const external = await isolateDemo(page);
  await enterDemo(page);
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByRole('link', { name: 'Book new', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  await expect(page).toHaveURL(/#\/appointments$/);
  expect(external).toEqual([]);
});

test('other-person booking and notes stay separate from the patient’s record', async ({ page }) => {
  const external = await isolateDemo(page);
  await enterDemo(page);
  await page.getByRole('button', { name: 'Try demo booking', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Booking notes (optional)').fill('My fictional visit notes');
  await dialog.getByLabel('Who is this visit for?').selectOption('other');
  await expect(dialog.getByLabel('Booking notes (optional)')).toHaveValue('');
  await dialog.getByLabel('Other patient’s fictional name').fill('Other Sample Patient');
  await dialog.getByLabel('Booking notes (optional)').fill('Other fictional visit notes');
  await dialog.getByLabel('Who is this visit for?').selectOption('self');
  await expect(dialog.getByLabel('Booking notes (optional)')).toHaveValue('My fictional visit notes');
  await dialog.getByLabel('Who is this visit for?').selectOption('other');
  await expect(dialog.getByLabel('Booking notes (optional)')).toHaveValue('Other fictional visit notes');
  await dialog.getByRole('button', { name: 'Review demo visit' }).click();
  await expect(dialog).toContainText('Other Sample Patient · Separate sample patient');
  await dialog.getByRole('button', { name: 'Confirm demo booking' }).click();
  const reference = await dialog.locator('.clinic-booking-reference').textContent();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alex Santos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('patient-portal-demo-visits-v1'))).toBeNull();
  expect(external).toEqual([]);
});

test('demo reports download, bills expand, password checks work, and sign-out clears the session', async ({ page }) => {
  const external = await isolateDemo(page);
  await enterDemo(page);
  await page.getByRole('button', { name: 'Results', exact: true }).click();
  await page.getByRole('button', { name: 'View result: Complete blood count · sample report', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Fictional demonstration data. Not a medical report.', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download text copy' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('released-report.txt');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Billing', exact: true }).click();
  await page.getByRole('button', { name: /DEMO-SOA-001/ }).click();
  await expect(page.getByText('Hospital charges', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Security', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill('IncorrectDemo!1');
  await page.getByLabel('New password', { exact: true }).fill('ChangedDemo!2026');
  await page.getByLabel('Confirm new password', { exact: true }).fill('ChangedDemo!2026');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('current demo password is incorrect');
  await page.getByLabel('Current password', { exact: true }).fill('DemoCare!2026');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo password changed' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('patient-portal-session'))).toBeNull();
  expect(external).toEqual([]);
});

test('contact form validates and confirms locally without submitting data', async ({ page }) => {
  const external = await isolateDemo(page);
  await page.goto('/#/contact');
  await page.getByRole('button', { name: 'Submit demo message' }).click();
  await expect(page.getByRole('heading', { name: 'Your demo message is complete.' })).toHaveCount(0);
  await page.getByLabel('Your name', { exact: true }).fill('Fictional Visitor');
  await page.getByLabel('Email address', { exact: true }).fill('visitor@example.invalid');
  await page.getByLabel('I have a question about').selectOption('Appointments');
  await page.getByLabel('Your message', { exact: true }).fill('A fictional question for this demonstration.');
  await page.getByRole('button', { name: 'Submit demo message' }).click();
  await expect(page.getByRole('heading', { name: 'Your demo message is complete.' })).toBeVisible();
  await page.getByRole('button', { name: 'Try another message' }).click();
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('');
  expect(external).toEqual([]);
});

test('public pages, menus, and demo booking fit a mobile viewport', async ({ page }) => {
  const external = await isolateDemo(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.screenshot({ path: 'node_modules/.tmp/portal-screenshots/clinic-home-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Our services' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  for (const route of ['home', 'services', 'doctors', 'about', 'contact', 'faq', 'privacy', 'portal']) {
    await page.goto(`/#/${route}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
  }
  await page.goto('/#/book');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Plan a demo visit' })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(external).toEqual([]);
});
