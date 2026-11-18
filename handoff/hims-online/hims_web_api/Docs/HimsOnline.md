# HIMS_ONLINE publishing and rollout

Verified locally on November 18, 2026 (Asia/Manila). The HIMS_ONLINE schema was previously applied to the intended SQL Server. Application deployment and live backfill remain pending.

## Database and publication

- `Database/HimsOnline.sql` provisions HIMS_ONLINE on the same SQL Server instance as HIMS_WEB. `dbo.RESULTS` retains its seven-column contract and reference indexes. `dbo.vw_Doctors` and `dbo.vw_Patients` read active source records. The patient TIN column returns NULL because the source has no patient TIN.
- `Database/HimsOnlinePublishing.sql` adds `dbo.ResultPublications` and `dbo.vw_ResultCandidates`. The publication row maps the source and examination IDs to `RESULTS.ID` and keeps the SHA-256 source revision. HIMS_WEB remains read-only.
- The HIMS API background worker publishes eligible Laboratory, Radiology, and EchocardiographicStudy PDFs. It uses the same bounded process for existing results and new validations. Reports stored independently can publish individually. A shared result becomes eligible once all linked examinations satisfy the validation rules.
- PDFs use opaque filenames and are written to a private folder before metadata is committed. Reconciliation removes stale metadata and regenerates missing files. A file is retained when the metadata commit outcome is uncertain.

## Portal access

The appointment API uses the authenticated patient's identity and the current eligible source revision on every read. The list returns bounded pages of 50. Omitted or blank filters default to an unfiltered, newest-first first page. Invalid filters return HTTP 400.

- `GET /api/patient-portal/results/published` lists results.
- `GET /api/patient-portal/results/published/{resultId}/pdf` returns the private PDF. Withdrawn and other patients' results return HTTP 404. A missing PDF copy returns a retryable HTTP 503.
- A temporary-password session must change its password before using clinical records. The password-change endpoint accepts that session.
- The Patient Portal supports preview, Open / Print PDF, and Download PDF. The separate Doctor Portal is an entry page with sign-in disabled.

## Approved rollout order

1. Verify the two SQL scripts' objects on the target instance and check aggregate baseline counts. Use the existing schema on the target. If an approved environment is missing the schema, apply `HimsOnline.sql` followed by `HimsOnlinePublishing.sql` through the normal database change process.
2. Create `D:\WEB_HIMS\OnlineResults` on the server that hosts both APIs. Keep it outside both static site roots. Give the HIMS API identity read/write access for publication and the appointment API identity read access. Verify the SQL identities can read the necessary source objects. The HIMS API identity also needs to maintain the publication metadata in HIMS_ONLINE.
3. Deploy the HIMS API using the normal approval process. Set `OnlineResults:StoragePath` to the private folder and enable `OnlineResults:Enabled` only when ready to start publication. The worker automatically processes eligible historical and new results. The initial settings are `PollSeconds` 15 and `BatchSize` 20.
4. Deploy the appointment API with `OnlineResults:Enabled` and the same `StoragePath`, then deploy the patient portal frontend configured to use that API. Verify the published results and PDF routes before releasing the frontend.
5. Monitor eligible, published, and pending counts. Watch the worker logs for storage and rendering failures. With an explicitly authorized test account, open and download a released report and confirm that a withdrawn or other patient's report is unavailable. Use an approved test environment for any action that changes clinical data.

## Read-only publication counts

Run this in HIMS_ONLINE after verifying the target database. It returns counts by source and includes only metadata for the current source revision. A file may still need regeneration if the stored copy is missing.

~~~sql
SELECT v.SourceTable,
       COUNT_BIG(*) AS Eligible,
       COUNT_BIG(r.ID) AS Published,
       COUNT_BIG(*) - COUNT_BIG(r.ID) AS Pending
FROM dbo.vw_ResultCandidates AS v
LEFT JOIN dbo.ResultPublications AS p
    ON p.SourceTable = v.SourceTable
   AND p.ExaminationId = v.ExaminationId
   AND p.Revision = v.Revision
LEFT JOIN dbo.RESULTS AS r
    ON r.ID = p.ResultId
   AND r.PATIENTNO = v.PatientNo
GROUP BY v.SourceTable
ORDER BY v.SourceTable;
~~~

## Verification and transfer

- Both APIs built through the isolated console harness. Its 20 mocked tests passed, including optional query binding, temporary-password access, authenticated PDF ownership, withdrawal, missing-file recovery, and cancellation.
- The portal build and lint passed, along with 21 unit tests and 28 selected Playwright tests against mocks. Desktop and tablet screenshots were reviewed using synthetic data.
- The earlier handoff records read-only render checks for one eligible report from each of the three diagnostic sources. The current verification used mocks. Live publication counts and live access checks are rollout tasks.
- The SQL scripts, this document, and the API harness are in the patient portal transfer bundle under `handoff/hims-online/`. Preserve their paths when moving between workstations because the HIMS API checkout ignores these files.
