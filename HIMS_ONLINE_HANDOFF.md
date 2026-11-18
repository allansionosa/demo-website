# HIMS online results / portal integration handoff

Updated November 18, 2026 (Asia/Manila). Local verification is complete. Production deployment, live backfill, and authorized live access checks remain pending.

## Start here on the other computer

1. Read this file, then the AGENTS.md files in each project.
2. Pull/copy the latest versions of all three project repositories below. Remap local paths if the username or folder layout differs. Do not reconstruct missing projects or overwrite unrelated work.
3. Include the whole handoff/hims-online folder from the patient portal repository. Several necessary SQL, documentation and regression files are ignored by the HIMS API repository and do not travel with a normal push/pull there. The bundle contains safe copies; restore them to their original relative locations in that API project if absent.
4. Supply existing local/server configuration securely. This handoff and its bundle contain no database credentials or real patient records. Do not copy credentials into frontend environment variables.
5. Continue the remaining checklist below; inspect current source and current Git status before editing.

Prompt to paste into Codex:

> Read HIMS_ONLINE_HANDOFF.md, the relevant AGENTS.md files, and the bundled Docs/HimsOnline.md rollout guide. Verify all three projects and the ignored files transferred correctly. Follow the approved rollout order when deployment is authorized. Keep HIMS_WEB read-only and use mocked tests for verification. The real API hosts start background workers that can write data. Keep Patient Portal and Doctor Portal separate. The Doctor Portal currently has an entry page only.

## Project locations and last observed commits

| Project | Current computer path | Last observed commit |
| --- | --- | --- |
| Patient portal / public website | C:\Users\Trainee\patient portal | 1b3664c — demo website update |
| HIMS API (.NET 9) | C:\Users\Trainee\ncbsi\hims_web_api | c24bc5c — Add QR-coded wrist tag report |
| Appointment / patient portal API (.NET 10) | C:\Users\Trainee\online-appointment\online-appointment-api | 6de7169 — Add secure published patient results |

The original frontend workspace is C:\Users\Trainee\hims_web. This integration requires the patient portal and both API projects. The latest verification includes local edits to the portal browser fixture and the appointment API's published query model. Carry those edits and the handoff files with the source. The HIMS API rollout guide and mocked harness are also included in the portal bundle because those API files are ignored by Git.

## User decisions / requirements

- HIMS_ONLINE on SQL Server 103.55.11.15,8766; source data is HIMS_WEB on that same instance.
- Reference schema: MLMCV11_ONLINE on HOSTPC-SERVER\SQLEXPRESS2022. Reference server is read-only and is not a runtime dependency.
- Required original objects: dbo.RESULTS, dbo.vw_Doctors, dbo.vw_Patients. RESULTS must not contain COMPANYCODE.
- Save PDFs after validation; include existing validated results via automatic backfill.
- Independently stored exams publish individually. The user explicitly approved holding shared result records until every linked exam is validated, because existing laboratory templates and radiology findings are stored by shared main result ID and cannot safely be split by charged examination.
- Unvalidated, deleted, cancelled, returned or changed source results must not be served using an old PDF. Check current eligibility/revision and authenticated patient ownership on each read.
- Shared private PDF directory on the HIMS server: D:\WEB_HIMS\OnlineResults. HIMS API and appointment/portal API run on the same server. This directory does NOT exist on this development workstation.
- Patient Portal and Doctor Portal are separate. Public website navigation now has an Online Portal dropdown with both entries. The user asked for a separate Doctor Portal sign-in ENTRY PAGE for now, not a functioning doctor authentication backend. Its disabled sign-in and unavailable message are intentional; never reuse a patient's session as doctor authentication.
- Focus desktop/tablets/iPads. Keep existing styling and authentication/booking behavior.
- HIMS_WEB schema and data remain read-only. Changes to the requested HIMS_ONLINE schema/publication data are authorized by the task. No live patient account login, provisioning, email or source write tests were authorized.

## Database state already applied on the requested server

- Created HIMS_ONLINE, dbo.RESULTS and both requested cross-database views.
- RESULTS retains exactly seven columns: ID identity PK, CODE nvarchar(50), PATIENTNO nvarchar(50), PATIENTNAME nvarchar(250), EXAMINATION nvarchar(250), FILENAME nvarchar(50), RESULTDATE smalldatetime default GETDATE. Five lookup indexes mirror the reference.
- vw_Doctors maps CODE to the HIMS doctor Id as text and excludes deleted doctors.
- vw_Patients reads structured names/patient number from PatientInformation and excludes deleted patients. TINNO is a typed NULL because HIMS_WEB has no patient TIN column; never substitute PIN.
- Applied Database/HimsOnlinePublishing.sql: dbo.ResultPublications maps (SourceTable, ExaminationId) to RESULTS.ID plus a SHA-256 source Revision. dbo.vw_ResultCandidates provides the current eligible source results, patient ownership and revision. Original RESULTS columns were not changed.
- Candidate view covers Laboratory, Radiology and EchocardiographicStudy. It rejects partially validated groups, cancelled/fully returned linked exams, deleted source/case/patient and case mismatches. Source content, laboratory/cardiology child content and validation state contribute to the revision.
- Last read-only inspection found 11 eligible laboratory reports, 8 radiology reports, 2 cardiology reports. Counts can change; query metadata again rather than assuming them.
- No PDFs were published and no clinical result rows were backfilled during verification. Do not claim live backfill is complete. Verify RESULTS/publication counts read-only before rollout in case another operator has activated it since.

## Implemented source

### HIMS API

- Services/OnlineResults/Contracts.cs, OnlineResultRepository.cs, OnlineResultPublisher.cs, OnlineResultFiles.cs, OnlineResultRenderer.cs.
- Background publisher: bounded batches (20 default), periodic polling (15 seconds default), cursor rotation to avoid a failing result starving all later work, same path for historical backfill and new validations, idempotent publication with transactional application locking.
- Saves opaque GUID PDF filenames using a staged atomic file move. Rechecks source eligibility/revision before and after rendering and again inside metadata publication.
- Reconciles withdrawn/revised metadata. Checks saved files in bounded batches and republishes missing files. Leaves files intact if the publication acknowledgement could have been lost after commit; never delete a potentially committed PDF blindly.
- Missing private directory prevents publishing. It does not create D: or write to a fallback/public directory.
- DiagnosticResultPdf.cs extracts the existing three RDL renderers; GenerateReportController retains wrappers for existing print/email flows. Datasets, parameters and report headers were preserved.
- Publisher renderer holds serializable source locks while legacy procedures containing NOLOCK execute, using a transaction-bound connection, to prevent concurrent edits from contaminating the saved snapshot.
- Program.cs registers options, repository, renderer, file store and worker.

### Appointment / portal API

- Services/OnlineResults contains Contracts.cs, SqlOnlineResultCatalog.cs and OnlineResultReader.cs.
- GET /api/patient-portal/results/published: authenticated, server-side filters and bounded 50-row pages, current source revision join.
- The published list accepts omitted or blank optional filters and defaults to page one, newest first. Malformed page values and other invalid filters remain HTTP 400 errors.
- GET /api/patient-portal/results/published/{resultId}/pdf: authenticated patient ownership, current revision, filename validation, second eligibility check after file open, no-store/private and no token in URLs. Missing files yield a recoverable 503; withdrawn/other-patient results yield 404.
- PatientPortalController.Results.cs adds these endpoints. CurrentAccount now blocks temporary-password sessions from records while allowing the password-change action to continue.
- Existing GetResultsAsync/dashboard/notifications read published metadata when OnlineResults is enabled. Dashboard reuses one published-page query and reports the total count. Existing JSON details are disabled in online mode so the PDF path is authoritative.
- PatientPortalDiagnosticResult has additive OnlineResultId.

### Patient portal / public website

- src/api.ts: paged metadata and authenticated PDF blob fetch; existing session-expiry handling reused. No credentials/tokens in blob URLs.
- src/pages/published-results.tsx: persistent filter controls, server pagination, PDF modal, fresh authorized fetch on Open/Print and Download, error/retry and cancellation/blob URL cleanup.
- src/pages/results.tsx preserves legacy/demo report rendering and routes published records to the PDF modal. Dashboard reuses the same modal.
- Scoped CSS fixes table overflow at tablet sizes; no broad global compact-filter changes.
- src/components/online-portal-menu.tsx adds accessible Online Portal dropdown and separate DoctorPortalEntry. src/pages/website.tsx, src/website-routes.ts and website.css wire the public route #/doctor-portal. Patient entry remains #/portal or #/dashboard when signed in.
- Existing .env and booking implementation were not changed.

## Configuration (non-secret)

Both API appsettings.json files currently have:

~~~json
"OnlineResults": {
  "Enabled": true,
  "StoragePath": "D:\\WEB_HIMS\\OnlineResults",
  "PollSeconds": 15,
  "BatchSize": 20
}
~~~

Portal API uses Enabled and StoragePath; polling settings apply to HIMS API. Existing database access is reused server-side with the online catalog on the same instance. Never dump connection strings or MainContext credential literals into logs/chat. Preserve other settings.

## Verification completed

- Both API projects compiled with zero errors through the isolated harness build. Existing compiler warnings and an unavailable NuGet vulnerability feed were reported. Use `UseAppHost=false` and isolated artifacts when verifying on a machine with a running API.
- Patient portal `npm run build`, `npm run lint`, and `npm test` passed. The unit suite passed 21 tests.
- Tests/OnlineResults/OnlineResults.Tests.csproj is a console-style net10.0 regression harness, referencing the net9 HIMS API and net10 appointment API. All 20 tests passed using fakes and synthetic PDF data. The project is ignored in the API repo and is included in this handoff bundle.
- Exact regression names include:
  - Publisher backfills eligible reports once without duplicates
  - Publisher recreates a missing saved PDF through the same backfill path
  - Publisher rejects withdrawal before rendering
  - Publisher rejects source changes during rendering
  - Publisher isolates render failures and retries failed reports
  - Publisher never advertises failed storage or invalid PDF bytes
  - Publisher preserves files after an ambiguous committed acknowledgement
  - Publisher removes only definitely unpublished files
  - Publisher requires the configured private directory and honors cancellation
  - Portal filters enforce bounded pages dates and literal search
  - Portal query binding defaults omitted and blank filters
  - Portal query binding rejects a malformed page
  - Portal PDF denies other patients unknown results and withdrawn copies
  - Portal PDF rechecks authorization after opening and disposes withdrawn streams
  - Portal PDF rejects unsafe filenames and surfaces missing files
  - Portal PDF uses the authenticated patient and returns a private response
  - Portal endpoints require sign in and changed temporary passwords
  - Temporary-password sessions can change their password
  - Portal list passes patient identity and filters and returns recoverable storage errors
  - Private PDF storage is atomic rejects traversal and never overwrites
- Eligibility SQL regression ran against synthetic ephemeral table variables only (not source records): shared partial/full validation, content revision, unvalidation, cancellation, return, source/patient deletion, case mismatch and independent exam. Its generated SQL is included at handoff/hims-online/verification/eligibility-regression.sql. It uses the actual candidate-view query with source names mechanically replaced by synthetic table variables.
- Read-only live RDL rendering verified one eligible result for each of Laboratory, Radiology and EchocardiographicStudy. Actual PDF bytes were checked in memory and cleared, not written/copied to the server or portal. All three renders passed. The --verify-live-render harness flag contains a development-computer path: remap before use elsewhere. Source procedures were inspected first; udp_GetReportHeader dynamically reads the existing PNG and only inserts into a local table variable.
- All 28 selected Playwright tests passed against mocked services. The mobile website test now opens the demo booking dialog through the homepage button and retains its width and keyboard assertions. The published-results cases cover authenticated PDF preview/open/download, withdrawal, missing-file retry/expiry, paged filters, focus, tablet overflow, and separate portal navigation. Synthetic desktop and tablet screenshots were reviewed.

## Remaining rollout

1. Carry the three project trees and the complete `handoff/hims-online/` bundle to the release environment. The updated `Docs/HimsOnline.md` includes the deployment sequence and a read-only aggregate query.
2. Verify the target schema, private `D:\WEB_HIMS\OnlineResults` folder, and service account permissions through the approved deployment process. Deploy the HIMS publisher, the appointment API, and then the patient portal frontend. The HIMS worker starts automatic backfill when its publication setting is enabled.
3. After rollout, verify aggregate eligible, published, and pending counts. Use an explicitly authorized test account to check report access, clinical PDF display, and download. Production deployment and live backfill have not been performed in this verification.

## Useful verification commands

Run from the appropriate project and remap paths. Do not paste credentials.

~~~powershell
# Patient portal
npm run build
npm run lint
npm test
npx playwright test tests/browser/published-results.spec.mjs tests/browser/portal.spec.mjs tests/browser/website.spec.mjs

# API regression harness, from the HIMS API repository
$artifacts = Join-Path $env:TEMP 'hims-online-verification'
dotnet build Tests/OnlineResults/OnlineResults.Tests.csproj -p:UseAppHost=false --artifacts-path $artifacts --nologo -v:q
dotnet (Join-Path $artifacts 'bin/OnlineResults.Tests/debug/OnlineResults.Tests.dll')
~~~

Local logs/screenshots were in C:\Users\Trainee\hims_web\.tmp\hims-online and patient portal/node_modules/.tmp/portal-screenshots. They are local scratch artifacts and need not be transferred. Synthetic test source and this handoff are the durable evidence; rerun checks on the next computer.

## Earlier completed work

Reports Index consistency and scroll containment across Billing, Files, Cashier, Financials, AR Guarantors/PN and Purchasing were completed before this task. Cashier/Financials use Print opening a PDF in a new tab. Do not redo or revert those UI changes while finishing the portal work.
