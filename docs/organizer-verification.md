# Historical verification of the email-account branch

Date: November 5, 2026. Branch: `codex/huntrr-organizer-supabase-light`. For the nickname profile release, use the [current Preview guide](organizer-preview.md).

## Passed locally

- TypeScript (`npm run lint`) and production frontend/server build (`npm run build`). Build reports existing large-chunk warnings; no build failure.
- Six test files (`npm test`): workspace CRUD/query/backup validation, embedded PostgreSQL ownership/private-file policies and atomic retry-safe writes, offline persistence and conflict protection, non-overwriting imports, failed-photo-repair preservation, and portable legacy exports with IndexedDB fallback images.
- Production HTTP checks and Vercel function entry: frontend assets, favicon, SPA deep links, JSON 404/validation, private URL rejection and unauthenticated AI endpoint restrictions.
- 54 browser page/viewport checks: 18 routes at desktop 1440×1000, iPhone-sized 390×844, and iPad-sized 820×1180, with device dark mode enabled. No horizontal page overflow, detected dark UI surfaces, route error boundaries or uncaught page errors.
- Actual browser IndexedDB workflow with disposable sample data: agenda event appears in calendar; task, habit, habit check-in, note and event survive refreshes.
- Actual browser UI with **simulated Supabase HTTP**: registration/confirmation feedback, PKCE password-recovery callback and password update, automatic note saving, refresh/session restore, later login, separate account notebooks, fresh browser-context reads, and reviewed event/private-attachment import. This verifies the app's UI and SDK integration, not the real hosted service.
- Original cat-ear header component, header CSS and tablet-frame CSS match the original production commit. The full route/module list is retained. Light-theme overrides change colors without importing the Supabase branch's frame restructuring.

## Not verified live

The existing Organizer Vercel project returns 404 to the connected account. No hosted preview URL, live Vercel variables, Git configuration or production deployment could be inspected. No live Supabase credentials or database connection were provided. Consequently these remain required before production approval:

- Actual registration/confirmation emails and password-reset delivery.
- Existing project's installed schema, RLS and bucket policies.
- Hosted automatic saving, multi-device Realtime and actual private-file downloads/limits/CORS.
- Migration of the user's original Firebase/Drive/browser data and full attachment parity.
- External Drive/Sheets authorization and original photo-recovery access.
- Actual iPhone/iPad Safari behavior; Chromium viewport emulation is not Safari.

No live SQL, credentials, data migration, deletion, project settings, production traffic or main-branch merge was performed. Follow [the safe Preview guide](organizer-preview.md), then test with disposable accounts and non-destructive sample data. Production requires the user's approval after the real Preview passes.
