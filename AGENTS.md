# Patient portal project guidance

## Scope and related projects

This project is the patient-facing portal for appointments, released diagnostic
results, bills, registered patient profiles, and account security. It uses
React 19, strict TypeScript, Vite, plain CSS, and Lucide icons. Node.js 22.14 or
newer is required by `package.json`.

The user authorizes access to these related codebases when needed for the
current task. Read each project's own `AGENTS.md` before working there.
Filesystem sandbox permissions still apply.

| Project | Local path | Relationship |
| --- | --- | --- |
| Patient portal | `C:\Users\Trainee\patient portal` | This frontend. |
| Appointment API | `C:\Users\Trainee\online-appointment\online-appointment-api` | Shared portal authentication, patient data, and booking backend. |
| Appointment web app | `C:\Users\Trainee\online-appointment\web` | Booking flow and portal profile handoff. |
| HIMS web app | `C:\Users\Trainee\hims_web` | Appointment registration integration at `/rad/registration`. |

Inspect relevant API handlers and consuming screens before changing shared
contracts. Preserve compatibility between the portal, appointment app, and HIMS.

## Database access and credentials

- The user permits database access for **read-only inspection only**. Database
  credentials are available in the appointment API project's configuration.
- Use a read-only database account or database-enforced read-only session where
  supported. Keep queries bounded and retrieve only necessary fields.
- Do not insert, update, delete, alter schemas or permissions, run migrations,
  seed data, or invoke database routines that write data. Database writes require
  separate explicit user authorization.
- Read-only permission does not authorize live login, logout, password changes,
  password resets, appointment creation, email delivery, or account provisioning
  merely to test an integration. These operations can write data or send email;
  use mocks or an explicitly authorized test environment.
- The appointment API includes a provisioning background worker. Do not start
  the real API host for tests against a live database under read-only permission.
  Use fake services and isolated checks instead.
- Keep credentials, session tokens, passwords, and real patient information out
  of source code, logs, command output, commits, and reports. Never copy database
  credentials into frontend configuration. `VITE_*` variables are browser-visible.

## Project structure and configuration

- `src/App.tsx` contains the login/password-change flows, hash-based navigation,
  portal layout, pages, and shared presentation/loading helpers.
- `src/api.ts` owns API requests, bearer headers, API errors, and session storage.
  Keep network access in this layer rather than duplicating fetch logic in pages.
- `src/types.ts` defines session, patient profile, appointment, diagnostic result,
  bill, and dashboard contracts. Keep them aligned with backend DTOs.
- `src/booking-bridge.ts` manages the appointment window and sign-in handoff.
- `src/index.css` contains the design tokens, responsive layouts, and reusable
  classes. Reuse existing styles and Lucide icons before adding dependencies.
- `src/main.tsx` initializes React and the stylesheet. `vite.config.ts` configures
  the Vite React plugin.
- `VITE_API_URL` points to the shared appointment API; the development default
  is `http://localhost:5160`.
- `VITE_APPOINTMENT_URL` points to the appointment frontend; the development
  default is `http://localhost:5173`. This portal runs on port 5174 by default.
- The appointment frontend's `window.RUNTIME_CONFIG.PATIENT_PORTAL_URL` must
  point back to this portal. Both frontends must use the same API. Keep configured
  origins and backend CORS settings consistent; restart Vite after env changes.
- Preserve `.env` and unrelated local configuration. Do not overwrite them or
  expose their contents while diagnosing an issue.

## Authentication, patient identity, and booking

- Patient number is the portal username. Account provisioning follows HIMS
  patient/case assignment, and temporary-password sessions require a password
  change before entering the portal or connecting a booking.
- This portal currently stores its session under `patient-portal-session` in
  `sessionStorage`. Preserve the existing session lifecycle and clear the local
  session on logout or an expired-session handoff. Do not expand token storage
  to URLs, logs, or `localStorage`.
- Backend authentication is authoritative. Clinical records, bills, results,
  and appointments must be scoped to the authenticated account's patient identity.
  Do not trust browser-supplied patient IDs or patient numbers as authorization.
- Return only released/validated diagnostic results through the portal. Preserve
  backend release checks and avoid presenting unreleased records in the UI.
- Patient profiles use structured fields from the registered HIMS patient record.
  Do not guess first/last names or address fields by splitting display strings.
- Portal Book buttons open a connected appointment tab. Standalone booking can
  open a portal sign-in window and then use Continue to appointment. Preserve
  exact-origin, expected-window, and random-nonce checks in both directions.
  Never send session tokens to a wildcard origin or place them in booking payloads.
- The appointment app verifies the transferred session through
  `GET /api/appointments/portal-profile`. On an expired session, the handoff
  returns the portal window to sign-in so the same account can reconnect.
- Self bookings reuse the verified patient identity and save the backend-resolved
  `PatientId`. Someone else's booking must remain separate from the booker's
  patient record and personal portal appointment list. Keep self/other drafts
  separate, including identity, address, notes, and relationship.
- Booking contact/address edits apply to that booking; they must not silently
  update the registered HIMS profile. Contact the clinic for identity corrections.
- Backend booking saves uppercase patient text for HIMS compatibility. Preserve
  email, dates, request IDs, and service/payment contract values as appropriate.
- Preserve appointment duplicate protection: uncertain responses and expired
  sessions must retry the original payload and request ID. The email retry endpoint
  only looks up an existing booking and retries its notification; it never creates
  another appointment. Consult the appointment app's `AGENTS.md` for details.

## Coding style and user experience

- Follow nearby code: two-space indentation, single-quoted strings, functional
  components, React hooks, and relative imports. Preserve the local semicolon
  style; do not reformat unrelated code just to make the whole project uniform.
- Keep TypeScript strict. Use explicit contracts and type-only imports where
  appropriate; avoid `any`, unchecked assertions, and lint suppression.
- Follow the existing `useLoad` pattern for page data, including loading, error,
  empty, and retry states. Keep form and interaction state local to React.
- Extract focused components/helpers when it improves a growing screen. Avoid
  introducing routers, query libraries, styling frameworks, or other dependencies
  without a concrete need.
- Use existing CSS variables such as `--primary`, `--muted`, `--line`, and
  `--surface`. Preserve responsive navigation, readable tables/cards, and mobile
  layouts without horizontal page overflow.
- Use labeled inputs, semantic buttons/links, visible keyboard focus, accessible
  icon labels, and clear validation. Prevent repeated submissions while pending.
- Explain whose details and records the patient is viewing. Keep implementation
  details and sensitive identifiers out of ordinary patient-facing copy.
- Do not imply a payment was collected without a functioning payment integration.
  Preserve accurate booking, billing, and notification status messages.

## Working and validation

- Inspect existing files and changes before editing. Preserve user work and avoid
  generated `dist`/`node_modules` changes. Do not assume Git is initialized here;
  this directory currently has no Git metadata.
- Use `rg` for searches and quote Windows paths containing spaces. Prefer
  PowerShell `-LiteralPath` for filesystem operations.
- For frontend code changes, run `npm run build` and `npm run lint` in this
  directory. The build includes TypeScript checks and a Vite production build.
- For cross-project changes, run the affected project's documented checks too.
  In the appointment app, `npm run test:patient-details` checks profile mapping,
  separate drafts, and handoff validation; `npm run test:confirmation:api` checks
  backend authentication and confirmation behavior with fake services.
- Use mocked browser/API data for sign-in, password-change, reset, booking,
  email, and provisioning checks. Verify affected flows, expired sessions, patient
  separation, error recovery, and mobile/desktop behavior without live writes.
- For documentation-only changes, review content and whitespace. Builds are not
  necessary. Use `git diff --check` when Git is available; otherwise inspect the
  changed files directly.
- Report what changed, which checks passed, and material validation limits.
  Do not claim live integration or database behavior was tested when using mocks.
