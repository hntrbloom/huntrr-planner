# Huntrr Organizer: safe preview and migration

Branch: `codex/huntrr-organizer-supabase-light`. Base: original Organizer `909319183600ca1ebd782e3b03b98f1b136a210a`. Supabase integration source: `f0c5db69fb18393382f61f4a21c6efb96cb1ccf7`. Its header/frame restructuring was excluded. No production cutover is authorized.

## Existing Vercel project only

Open https://vercel.com/huntrr1/huntrr-organizer/settings/general using the account that can access Organizer. Confirm name `huntrr-organizer`, ID `prj_2nfaBbZY92RtdiyuDU5Mm1EhVd6O`. The connected Vercel account returned 404 during implementation; no hosted preview or live settings could be inspected. Do not choose the portfolio or create another project.

1. **Settings → Environment Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the **existing Supabase project's** API settings. Choose **Preview** only; scope to this development branch if available. Enter values directly in Vercel, never in chat or GitHub. These values are public browser configuration; database policies enforce privacy.
2. **Settings → Git**: confirm `hntrbloom/huntrr-planner`. Leave the production branch `main` and current production deployment unchanged.
3. Check against `vercel.json`: Node **24.x**, framework **Other**, repository root, install **npm ci**, build **npm run build**, output **dist/public**. API function bundles include `dist/**`. Server bundles stay outside the public directory. Drive, Sheets and other API routes require Express; do not use static-only hosting. Global settings may affect future builds, so do not change production connections or redeploy production while setting up Preview.
4. In the existing project's **Deployments → Create Deployment**, choose this branch and target **Preview**. If a branch preview already exists, redeploy it after saving variables. Confirm project, branch, commit and environment on the result. Do not select Production or Promote.
5. Add that preview's exact origin/path, normally `https://<preview-host>/`, to the existing Supabase project's **Authentication → URL Configuration → Redirect URLs**. Leave the production Site URL unchanged. Add `http://localhost:3000/` only for local testing.

Vite embeds public variables during build: saving variables requires rebuilding Preview. Without both variables, the app clearly offers a device workspace and does not fall back to Google login. That mode does not verify cloud accounts.

`SUPABASE_SECRET_KEY` is optional and server-only for the inherited account-deletion endpoint. Never prefix it with `VITE_` or put it in browser code. Saving, registration and recovery do not need it. Without it, account deletion returns a configuration error. Do not test deletion of an existing account.

## Inspect the existing Supabase project before SQL

No live Supabase credentials were available, and no live SQL or Auth settings were changed. First run this read-only SQL in the existing project's SQL Editor:

```sql
select to_regclass('public.planner_documents') as documents,
       to_regclass('public.planner_write_receipts') as receipts,
       to_regprocedure('public.planner_apply(uuid,uuid,jsonb)') as write_function;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where tablename in ('planner_documents','planner_write_receipts','objects');
select id, public from storage.buckets where id = 'planner-files';
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('planner_documents','planner_write_receipts');
select schemaname, tablename from pg_publication_tables
where pubname='supabase_realtime' and tablename='planner_documents';
```

If all Organizer objects are absent, apply `supabase/migrations/202611040001_planner_accounts.sql` inside a transaction (`BEGIN;`, file contents, `COMMIT;`). It adds Organizer tables, policies, a checked write function, publication entry and private bucket; it does not replace Firebase/Drive data. If any objects exist, **do not rerun or drop them**. Compare their definitions and policies with the migration first. This is not an overwrite script.

Enable the Email provider, email confirmation, and password minimum 10. Configure email delivery to inboxes you own. Do not change settings used by other apps sharing this Supabase project. Organizer uses email/password; optional Google authorization remains for Drive and Sheets only.

Authenticated reads are owner-only; anonymous document access and direct writes are revoked. `planner_apply` verifies `auth.uid()`, record versions, atomic batches and retry receipts. Files are private under `planner-files/<user-id>/<file-id>` with owner policies. IndexedDB records, queued edits/files, timer state and Drive folder caches are separated by account. Conflicts retain pending edits and the newer cloud copy.

## Preserve originals and import copies

1. Keep original production running and retain its JSON backups. Firebase/Drive information and browser IndexedDB are not automatically available at a different Preview address.
2. On an origin with an existing Firebase session, **Settings → Original Organizer recovery** exports a portable backup with readable files. It only reads the original Firebase workspace and does not introduce Google login. If no session is available, export from the original Organizer. A migration-enabled build must run on the original origin to read that origin's browser storage; do not change production just for this step.
3. Backups containing only Drive IDs or local file references need a portable export from the original workspace/device. Connect the original Drive account for Drive-only files. Missing or temporary files stop export/import rather than silently discarding data. Failed photo repairs retain references for later recovery.
4. In the destination email account, **Settings → Your account → Your planner data**: review browser data or choose portable JSON, check the record count and destination email, then confirm. New records are read back and verified; identical records are recognized, differing IDs are skipped. Retrying an interrupted import is safe. Keep originals.
5. Open another device and verify every module, image and STL. Do not remove originals or legacy storage until testing and production approval.

Settings retains the original backup/recovery and photo scan panels. Email-account exports and Drive backups use portable account copies; restores use the conflict-preserving import. Drive/Sheets features remain optional. The active focus timer is device-specific; preferences and completed sessions belong to the account. Private files remain when records are removed because other records or offline edits may reference them.

## Verification and release gate

- `npm test`: actual SQL migration in embedded PostgreSQL (PGlite), owner/file policies, retry/atomicity, offline queue, safe import, local workspace, and failed-photo-repair preservation.
- `npm run lint`: TypeScript. `npm run build`: frontend and server. `npm run verify:vercel`: function entry after build.
- With `npm start` running, `npm run verify:production`: assets, API boundaries and SPA routing.
- `scripts/verify-*-browser.mjs`: disposable browser profiles and sample data. The auth fixture simulates Supabase HTTP and callbacks; it does not prove hosted email or Realtime. Its build lives under ignored `work/` and must never be deployed. Script headers explain commands.

Before approval, test the real Preview and existing Supabase project with two disposable email accounts whose inboxes you control:

1. Register, receive/confirm email, log in, request reset, follow the emailed PKCE link in the requesting browser, update the password, and log in again.
2. Save a task, event, habit and note. Wait for **Saved**. Refresh, log out/in and open another device. Verify Realtime updates with both devices open.
3. Upload a sample image and STL; refresh and read them on another device. Verify the second account cannot read/write the first account's records/files, including forged-owner requests; anonymous access must fail.
4. Import a portable sample twice with an attachment and a conflicting record ID. Verify conflicts stay intact and originals are unchanged. Test offline edits and conflict recovery with sample data only.
5. Check all modules, dialogs, optional Drive/Sheets, desktop, iPhone Safari and iPad Safari. Chromium viewport checks do not replace real Safari testing.

Outstanding until live configuration: actual email delivery/recovery links, installed live RLS, hosted Realtime, actual storage/CORS/limits, original-user migration, Google integrations, and real Safari. Do not merge main, promote, delete legacy storage, or change production traffic until these pass and the user approves.
