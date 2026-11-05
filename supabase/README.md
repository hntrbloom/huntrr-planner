# Huntrr Planner email accounts

Use a separate Supabase test project. This checkout keeps the existing Firebase and browser workspace modes available for export and rollback. Setting both public Supabase variables selects the email-account experience at build time.

1. Apply [the planner migration](migrations/202611040001_planner_accounts.sql) to the test project with the Supabase CLI or SQL Editor. It creates owner-scoped planner documents, write receipts, a Realtime publication entry, and the private `planner-files` bucket.
2. Enable the Email provider and **Confirm email**. Set the minimum password length to at least 10. Set the test app as the Auth Site URL and add its exact origin and pathname to the redirect allow list, including `http://localhost:3000/` for local development. The email links use PKCE and should be opened in the browser that requested them. Configure SMTP for testing real recipients if the project’s built-in email service restricts delivery.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the ignored `.env.local` file. Set the server-only `SUPABASE_SECRET_KEY` there if testing account deletion. Do not send the secret in chat, prefix it with `VITE_`, or commit the file.
4. Run `npm run dev` for the configured app. Two browser profiles with the same account simulate separate devices. Use a separate test account to check isolation. Test registration, email confirmation, refresh, logout, password recovery, account settings, record and attachment sync, offline edits, and confirmed account deletion before considering a production cutover.

## Storage and migration

The document paths match existing Firebase IDs and aggregate records. That covers agenda and calendar events, shifts, tasks and daily logs, moods, habits and completions, goals and streaks, notes, focus history and settings, jobs and job streaks, receipts, shopping lists, medication logs, reminders, blog, wiki, print inventory and catalog, boards, photos, keychains, models, and user settings. The active timer is device-specific. Preferences and completed sessions belong to the account.

IndexedDB holds cached scopes, queued writes, and queued attachments per account. Writes to the same record can coalesce before sending. Postgres verifies versions in an atomic batch and recognizes retries by request ID. Deletes retain a tombstone to stop an offline client from resurrecting a record. A conflict retains the pending edits and stops the queue. Settings can export those edits and let the user resume from the cloud copy. Imported and uploaded files stay private and can be shared by multiple records within an account. Account deletion removes the private objects and cascades the account’s records and write receipts.

In the email workspace, open **Settings → Your account → Your planner data**. Review browser data or choose a JSON backup, then confirm the destination email. Browser preview data may include examples. The import preserves IDs, verifies stored copies, skips conflicting IDs, and can be retried. Keep the original browser data and backup until you have checked the account on a second device.

For a Google/Firebase workspace, open this checkout with the two public Supabase variables unset. Sign into the original workspace and use **Settings → Data Backup & Recovery → Export migration backup with files**. If that workspace contains Drive-only attachments, connect its original Drive account during export. The exporter packages readable Firebase and Drive files with the JSON. Recover inaccessible files in the original workspace before retrying. Import the portable JSON from the email account after confirming the destination. The original cloud data is retained.

## Verification

`npm test` exercises the actual PostgreSQL migration in an embedded Postgres runtime and the browser queue and import logic with a simulated transport. `npm run lint` checks TypeScript and `npm run build` builds the app and server. Hosted Auth, email delivery, Realtime across devices, and actual storage endpoints require the configured test project.

With the local app running and `SUPABASE_SECRET_KEY` set for the test project, `npm run verify:supabase` checks automatic saving, account isolation, session restoration, cross-device Realtime, and logout. It creates two confirmed disposable users with addresses starting with `planner-verification-` and cleans up only those users. It uses installed Chrome on Windows or Puppeteer's browser on other platforms. This test uses preconfirmed users, so signup confirmation and recovery email delivery still need a test inbox.
