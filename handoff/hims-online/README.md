# Files that normal API Git checkout omits

Read ../../HIMS_ONLINE_HANDOFF.md at the patient portal project root.

Copy the contents of this directory's hims_web_api folder into the actual HIMS API repository, preserving relative paths, if missing. Do not overwrite newer files without reviewing the diff. The SQL schema was already applied to the requested HIMS_ONLINE server; do not recreate or drop it blindly.

No secrets, appsettings.json, .env, patient rows or live PDFs are included.
