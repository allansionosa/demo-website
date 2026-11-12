# HIMS Demo Clinic & Patient Portal

A complete public clinic demo website and patient-facing React portal for appointments, released diagnostic results, billing, profile, and account security.

## Try the website demo

Run `npm run dev` and open `http://localhost:5174`. The root now opens the public clinic website, with Home, Services, Doctors, About, Contact, FAQs, and a demo privacy notice. The service directory supports search/category filters; fictional doctor profiles support specialty filtering and related booking links. Layouts work on mobile and desktop with keyboard navigation and accessible dialogs.

Choose **Patient portal → Explore demo portal** to enter as fictional patient Alex Santos without running the API or signing up. The demo includes upcoming and previous visits, released sample laboratory/imaging reports with downloads and printing, billing breakdowns, notifications, a structured profile, and a sample password-change flow. The starting demo password is `DemoCare!2026`; changes are held only in page memory and reset on reload or sign-out.

**Book a visit** opens a local, reviewed demo booking. Self bookings appear in Alex’s appointment list and persist across reloads in this tab’s session storage. Bookings for someone else keep separate notes and identity, do not enter Alex’s record, and are discarded when the form closes. Only fictional details should be used. Demo bookings never reach the appointment API, reserve a real appointment/time slot, send email, or collect payment. Contact form validation and confirmation run locally without sending or storing a message.

The demo uses `src/demo.ts` behind the existing API layer. Its browser-only marker is never sent to the API or appointment handoff. Clinical sample dates are relative to Philippine time. Closing the tab clears demo session storage; report/calendar downloads remain on the device. Self bookings are limited to 200 records in a tab.

Public pages use hash URLs (for example `/#/services`). `/#/portal` opens the demo/clinic access chooser; `/#/login` opens the original clinic sign-in. Authenticated portal pages remain at `/#/dashboard`, `/#/appointments`, `/#/results`, `/#/billing`, `/#/profile`, and `/#/security`. `/#/book` opens a demo booking directly. Existing connected booking sign-in and expired-session routes continue to use clinic authentication.

All public clinic branding, services, fees, hours, and clinician profiles are illustrative. Replace these with approved clinic content before a real launch. The local demo requires no new dependencies or environment changes. The existing API integration remains available through **Clinic patient sign in**.

## Setup

1. Copy `.env.example` to `.env` and set `VITE_API_URL` to the online appointment API.
2. Run `npm install`.
3. Run `npm run dev`.

The API provisions an account after an online appointment receives both a HIMS Patient ID and Case ID. The patient number is the username and a temporary password is emailed to the booking email address. The first authenticated session requires a password change.

Only validated diagnostic results are returned by the portal API. All records are scoped from the authenticated account's Patient ID/Patient No.; clients cannot submit another patient's identifier.

## Booking with a portal profile

Set VITE_APPOINTMENT_URL to the appointment frontend's full URL (development: http://localhost:5173). The appointment frontend's PATIENT_PORTAL_URL must point back to this portal (development: http://localhost:5174). Both frontends must use the same appointment API. Restart Vite after changing environment variables.

Book buttons open a connected appointment tab. The appointment app can also open a sign-in window; after signing in and completing any required password change, choose Continue to appointment. The handoff checks the configured origin, the expected browser window, and a random nonce. Session tokens never appear in URLs or appointment storage.

Self bookings reuse the authenticated HIMS patient identity and appear in that patient's portal appointments immediately. Bookings for someone else keep a separate patient identity and are not listed under the booker's patient record. Address/contact edits apply to the booking, not the registered HIMS profile.

## Patient record tools

- Authenticated API requests that return HTTP 401 clear the local session and show sign-in. The hash route stays in place so a successful sign-in returns to the previous page. Incorrect login credentials do not trigger session-expiry handling. Responses from a previous token cannot clear a newly signed-in session.
- Appointments support upcoming, past/closed, and all-visit views, status and date filters, and calendar downloads. Cancelled, completed, and admitted visits are excluded from upcoming visits. Calendar files use an all-day visit date, omit patient names, services, notes and tokens, and reserve no time slot. The upcoming boundary uses Philippine time.
- Results support department/release-date filters, sorting, and distinct empty/search states. Report mapping follows the API's released laboratory and imaging fields, preserves numeric zero and SI readings, honors hidden laboratory rows, and renders clinical text without inserting HTML into the page. Cardiology continues to show the API's report-availability note.
- Released reports can be printed, saved as PDF through the browser's print dialog, or downloaded as text copies. They are identified as portal copies rather than signed originals. Printing includes only the selected report.
- Notifications derive up to 200 updates from authenticated appointment/result endpoints. They refresh every minute while visible and on returning to the tab; no email is sent. Read state and category display preferences contain only record keys/preferences in sessionStorage and clear on sign-out, expiry, or an account change. This is a record feed, not a persistent server-side event history; cross-device read state and email/SMS delivery preferences require backend support.
- The overview highlights the next visit, latest released report, and outstanding balance. Recent reports open directly from the overview.

Billing remains a summary of recorded charges and payments; online payment is not connected.

## Approved clinic information

`src/clinic-information.ts` accepts clinic-approved public branch addresses, HTTPS directions URLs, and preparation instructions keyed by booked service item ID. Match branch names exactly to the appointment API. The configuration starts empty because approved addresses and instructions were not supplied; directions and instructions appear only when configured. Never infer fasting or other medical preparation from a service name.

Cancellation and rescheduling remain unavailable: the shared API has no patient mutation endpoints and clinic-approved eligibility, cutoff, refund, and notification rules have not been supplied. Enabling them requires an authenticated, patient-scoped backend implementation and the approved rules. A new booking must never be used as a rescheduling substitute.

## Validation

Run `npm run build`, `npm run lint`, `npm test`, and `npm run test:browser`. Browser checks use installed Microsoft Edge, a separate Vite port (5194), synthetic records, and intercepted API requests. They cover the public pages, search/filters, doctor profiles, local contact form, self/other demo bookings, report downloads, billing, passwords, and mobile layouts, alongside existing clinic authentication and booking-handoff regressions. All external requests are blocked or mocked; no live sign-in, password reset/change, booking, email, or provisioning is tested. Browser artifacts are kept under `node_modules/.tmp/`.

The source is organized into `src/pages/`, `src/components/`, a shared load hook, and focused formatting/report/notification/calendar helpers. React is updated within version 19, TypeScript within version 5, and Vite within version 6 for compatibility with the current Node minimum. The dependency lockfile includes refreshed transitive fixes; major tooling migrations can be reviewed separately.
