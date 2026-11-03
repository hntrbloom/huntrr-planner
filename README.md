# huntrr.organizer

A pink stationery workspace for everyday planning and creative work. Built on the existing React 19, TypeScript, Vite, Express and Firebase application. The product name is **huntrr.organizer**; it is not a registered domain or a service address.

## Pocket planner interface

The existing application now lives inside a responsive pink handheld planner. Home, Calendar, Tasks (Daily Log), Habits, Notes and Goals have visible icon-and-label tabs. **All pages** opens the complete navigation, including the creative studio, Character Wiki, work tools and Settings. Hash URLs and browser back/forward keep working.

Home shows read-only summaries of existing daily task records, scheduled habits and calendar completion. Quick actions open the existing editing/check-in workflows. Summaries never save, migrate or reset records. Date keys, habit history, goal milestones, custom colours, Series/Franchise suggestions and existing save behavior are preserved. The task notepad component has a stable identity so clock updates no longer discard an unfinished task draft.

The reusable visual tokens are in `src/planner.css` (`--planner-pink`, `--planner-blush`, `--planner-paper`, `--planner-lavender`, `--planner-ink`, `--planner-border`). The bow and pocket friend are original inline SVG decorations in `PlannerDecor.tsx`, hidden from screen readers. No decorative dependency or character artwork was added. Focus rings, keyboard navigation, touch controls and reduced-motion preferences are supported. At desktop widths the page scrolls inside the device; on phones it uses normal document scrolling with sticky planner tabs.

## Start locally

Use Node 24 and npm. The Node engine is pinned to 24.x so the deployed function uses the same runtime. `package-lock.json` is the maintained lockfile; the older Bun lockfile is retained as history.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell use `Copy-Item .env.example .env.local`. Open `http://localhost:3000`. Environment files are optional for the local workspace. `npm run dev` loads `.env` and `.env.local` and serves the frontend through Express/Vite.

Choose **Continue on this device** for a real local workspace, or **Sign in with Google** for the existing private Firebase workspace. These are separate workspaces; switching never uploads local records into a Google account.

```sh
npm test       # isolated IndexedDB CRUD, queries, subscriptions, transactions, URL safety
npm run lint  # existing TypeScript check (tsc --noEmit)
npm run build # Vite frontend plus bundled Express production entry
npm run verify:vercel # test the built Vercel function entry under plain Node 24
npm start     # production Express server; no Vite development server
```

`PORT` defaults to 3000. In PowerShell: `$env:PORT='4173'; npm start`. Production serves `dist/index.html`, fingerprinted assets, and `/api/*` from the same origin. An unknown API route returns JSON with HTTP 404. `/api/health` reports readiness and whether AI credentials are present. Run from the repository root.

## Product inventory

All existing tools are available in the navigation. Heavy screens load when opened. Hash routes retain the selected screen after refresh and support browser back/forward.

| Screen | Supported workflow | Existing storage |
| --- | --- | --- |
| Agenda / Monthly | Appointments, work shifts, completion, calendar | `appointments`, `workShifts` |
| Daily Log | Tasks, categories, daily planning | `dailyLogs`, `preferences` |
| Shopping Lists | Lists, quantities, editable items, completion and deletion | `preferences/shoppingListsData` |
| Client Receipts | Line items, calculations, saved receipts, exports | `preferences/clientReceiptsData` |
| Habit Tracker | Categories, schedules, completion history, editing | `preferences/habitsData` |
| Goals & Streaks | Goals, progress and personal activity charts | `preferences`, `activity`, `moods` |
| Notes / Blog / Reminders | Create, edit, save and delete entries | `preferences/notesData`, `blog`, `preferences/remindersData` |
| Prints | Print designs, sets, categories, galleries and images | `miniFurniture`, legacy `prints`, `preferences` |
| Character Wiki | Character details, palettes, galleries, Series and Franchise autocomplete | `preferences/characterWiki` |
| Keychains / Build Catalog | Design ideas, charms, builds and images | `keychains`, `printing` |
| Inspiration | Boards and reference photos; optional Pinterest import | `boards`, `photos` |
| Job Applications | Manual entries, statuses, spreadsheet import and optional URL/AI import | `preferences/jobApplicationsData`, history/config documents |
| 3D Models | Local STL viewer, dimensions, thumbnails, save, reopen, rename, download and delete | `saved_models`; local binary files or Google Drive |
| Settings | Workspace switching, folder settings, full JSON export and validated restore | `settings/general`, `preferences` |

## Storage and preservation

Cloud documents retain their original `users/{uid}/...` paths, project and **named Firestore database** from `firebase-applet-config.json`. The Firebase web API key is a public client identifier, not a server credential. Do not substitute another project or the default database when accessing existing data.

`firestore.rules` and `storage.rules` restrict each user's records/files to the matching authenticated Firebase UID. There are no shared/public collections. Rules remain unchanged. No live data reset, cleanup or migration command is part of setup, build or deployment. Historical patch/reset scripts at the repository root are not setup instructions and must not be run against live data. Visiting Wiki, habits, prints or analytics no longer rewrites/merges/deletes stored records automatically. Existing character names, Series/Franchise values and legacy browser data are retained.

Series and Franchise use separate lists. Matching ignores capitalization, typed values can be saved as new options, and saved suggestions are immediately reusable. The suggestion panel is portaled outside the scrollable character dialog and supports arrows, Enter and Escape.

The explicit local workspace uses IndexedDB `huntrr.organizer.workspace`, with documents under a dedicated local namespace; photos and STL binaries use the existing `SereneStationeryIDB` stores. It does not create a Firebase identity, send records to Firestore, or claim cloud sync. It survives page refresh, browser reopening and workspace switching on the **same origin and browser profile**. It is not available in another browser or at a new deployment URL. Clearing site data removes it. Export before clearing data or moving origins. Private browsing/storage restrictions may prevent persistence; save failures are surfaced.

Settings → **Export Everything** produces a versioned JSON backup of all known collections and the legacy user document. Local exports also include referenced local image/STL attachments. Cloud exports contain file metadata/URLs; keep original Firebase/Drive files as well. Exports fail rather than silently skipping unreadable collections.

**Restore Backup** validates JSON and asks before merging records into the current workspace. Matching IDs receive backup values; unrelated records are retained. Large restores commit in batches of 400; if interrupted, retry the same backup. Local backups with attachments must be restored into the local workspace. A restore never clears the database first.

## Environment and integrations

See `.env.example`; never commit `.env`, `.env.local`, service-account files, OAuth tokens or private keys. All `VITE_` variables are public and embedded at build time. Rebuild/redeploy after changing them.

| Variable / setting | Purpose |
| --- | --- |
| `PORT`, `NODE_ENV` | Express port and development/production mode |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`, `VITE_FIRESTORE_DATABASE_ID` | Optional complete replacement for the bundled public Firebase configuration. Leave blank to preserve the original project/database. |
| `FIREBASE_PROJECT_ID` | Server-side ID token verification project; default is the original project. Must match a replacement client project. No service-account private key is needed for ID token verification. |
| `VITE_GOOGLE_CLIENT_ID` | Google Web OAuth client for Drive/Sheets consent |
| `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID` | Google Picker API key and Cloud project number; existing config is used where supported |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional server-only AI extraction key and model ID enabled for that account. There is no invented/default model. |

For cloud sign-in, enable the Google provider in Firebase Authentication and add the actual localhost/preview/production host to **Authentication → Settings → Authorized domains**. Use the original project to retain saved data. In Google Cloud, enable Drive API, Sheets API and Picker API as needed; configure the OAuth consent screen, permitted users/scopes and the site's exact JavaScript origin. The client requests `drive.file`, `drive.readonly` and `spreadsheets.readonly`. Authorize only an account with access to the chosen folders/files. Drive access tokens are held in memory/session storage and expire; reconnect through Settings when needed.

Google Drive uploads, folder access, Sheets imports and OAuth require real user authorization. Local/manual planning and STL storage do not. AI text import returns HTTP 503 when its configuration is missing, and requires a verified, non-anonymous Firebase account when enabled. Manual job entry stays available. URL import reads public metadata; private/loopback addresses, unsafe schemes and oversized pages are rejected. MakerWorld/Pinterest may block automated access. Pinterest failures return a clear error instead of fabricated pins; manual boards/images remain available.

## Deploy the complete Express website

Static-only hosting is insufficient: imports and Drive/Sheets proxies use Express API routes. `vercel.json` deploys `api/index.ts` as the Express handler and `dist` assets on the same origin. `api/index.ts` loads the built `dist/app.cjs` Express backend and never starts a listening port. The build resolves internal TypeScript imports, bundles Firebase Admin and its ESM dependencies for Vercel cold starts, and embeds the original public Firebase configuration into that backend bundle; private credentials remain runtime environment variables. Existing Vite/React/Firebase architecture is retained.

1. Push this working branch to the GitHub repository.
2. In Vercel, create/import **huntrr-organizer**, linked to this repository, using the intended account/team and Node 24. Use Framework **Other**, install `npm ci`, build `npm run build`, output `dist` (also declared in `vercel.json`). Deploy the working branch as a **preview**, not a promotion to the live production domain.
3. Set optional server/client variables in that project's Preview environment before deployment. Keep private keys server-only. For local-only operation no secrets are required.
4. Deploy. Check `/api/health`, `/`, `/favicon.svg`, a fingerprinted `/assets/` URL, and an unknown `/api/` URL (404 JSON). Test local CRUD and refresh on the resulting HTTPS origin.
5. Add the actual preview host to Firebase authorized domains and its origin to the Google OAuth client before testing cloud sign-in/Drive. Use a dedicated test Firebase user; never test by editing existing personal records.
6. Assign a custom domain only after confirming that it is available and configuring its DNS/TLS. The name `huntrr.organizer` is branding until then.

For a conventional Node host, deploy the same source, run `npm ci && npm run build`, set `NODE_ENV=production`, and start `npm start` with the provider's `PORT`. `/api/health` is the health-check route. Firebase remains external durable cloud storage; do not rely on server-local files for user data.

Rules are supplied for review and explicit Firebase deployment. If deploying them, target the original project **and named database**, compare existing deployed rules first, and deploy only rules/indexes intentionally reviewed for that project. This task does not grant access to Firebase Console or verify existing deployed rules through a live account.

## Verification

The default Wiki Drive folder was an unusable placeholder; configure a real folder in Settings before using Drive for Wiki photos. Saved user folder settings are retained. Merely storing a folder ID is labeled as configured, not as verified access.

`npm test` uses fake IndexedDB and an isolated test namespace; it never signs in to Firebase or accesses live data. The repository's older ad-hoc scripts are not the test suite and include destructive tools. Browser/API verification results and any externally blocked checks are recorded in `VERIFICATION.md`.
