# huntrr.organizer

A pink stationery workspace for everyday planning and creative work. Built on the existing React 19, TypeScript, Vite, Express and Firebase application. The product name is **huntrr.organizer**; it is not a registered domain or a service address.

## Pocket planner interface

The existing application now lives inside a responsive pink handheld planner. Home, Calendar, Tasks (Daily Log), Habits, Notes and Goals have visible icon-and-label tabs. **All pages** opens the complete navigation, including the creative studio, Character Wiki, work tools and Settings. Hash URLs and browser back/forward keep working.

Home shows read-only summaries of existing daily task records, scheduled habits and calendar completion. Quick actions open the existing editing/check-in workflows. Summaries never save, migrate or reset records. Date keys, habit history, goal milestones, custom colours, Series/Franchise suggestions and existing save behavior are preserved. The task notepad component has a stable identity so clock updates no longer discard an unfinished task draft.

The reusable visual tokens are in `src/planner.css` (`--planner-pink`, `--planner-blush`, `--planner-paper`, `--planner-lavender`, `--planner-ink`, `--planner-border`). The pocket friend is an original inline SVG decoration in `PlannerDecor.tsx`, hidden from screen readers. No decorative dependency or character artwork was added. Focus rings, keyboard navigation, touch controls and reduced-motion preferences are supported.

`src/tablet-frame.css` owns the three tablet layers: a solid pink body with one outline/shadow, a pale bezel, and a warm-white screen with one inner line. Radii follow the same inset curve; rim and bezel thickness decrease on smaller screens. The viewport-based height reserves a separate bottom area for centered Home/Notes/Settings buttons, “little plans.” and the Timer. Pages scroll inside the inset screen on phones and desktops; the scrollbar stays clear of the bezel. The Timer dialog is portaled to the document body so the frame cannot clip it. The duplicated screen status strip was removed; workspace status remains in the shared header.

`CatPlannerHeader.tsx` provides the shared fixed header: two rounded SVG cat ears, a molded pink bow, the home title, workspace control and existing navigation. Decorations are hidden from assistive technology and ignore pointer events. `src/cat-planner-header.css` defines the requested header/bow colour variables and reserves matching space above every planner page. Desktop tabs collapse into the existing **All pages** menu below 768px; header controls remain at least 44px tall. The decoration changes no routes, authentication or stored records.

### Pink and black colour system

The 12 requested shades are defined once as CSS variables in `src/index.css` (`--pink-deep` through `--pink-blush`, `--black-near` through `--black-light-gray`, and `--white`). Existing Tailwind semantic roles and colour utility scales reference those tokens. `src/planner.css` assigns device, navigation, card, progress, focus and selected-control roles without changing their layout.

`src/theme-utilities.css` maps older arbitrary colour utility classes to these same tokens. Their class names remain valid because existing notes may store them. New UI should use semantic utilities such as `bg-primary`, `bg-surface`, `text-on-surface`, and `border-outline-variant`; avoid new hardcoded colours. Saved artwork, sampled colours, and custom content colour values are retained. Theme changes do not rewrite records. Normal supporting labels use dark gray for contrast; mid gray is reserved for outlines and disabled details.

## Start locally

Use Node 24 and npm. The Node engine is pinned to 24.x so the deployed function uses the same runtime. `package-lock.json` is the maintained lockfile; the older Bun lockfile is retained as history.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell use `Copy-Item .env.example .env.local`. Open `http://localhost:3000`. Environment files are optional for the local workspace. `npm run dev` loads `.env` and `.env.local` and serves the frontend through Express/Vite.

Enter a nickname and choose **Create Profile**. The last selected profile opens automatically in the same browser and site address. Open **Settings → Profile** to rename it, switch, or create another.

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
| Settings | Profile creation, renaming, switching, folder settings, backup and import as a new profile | `settings/general`, `preferences` |

## Storage and preservation

Cloud documents retain their original `users/{uid}/...` paths, project and **named Firestore database** from `firebase-applet-config.json`. The Firebase web API key is a public client identifier, not a server credential. Do not substitute another project or the default database when accessing existing data.

`firestore.rules` and `storage.rules` restrict each user's records/files to the matching authenticated Firebase UID. There are no shared/public collections. Rules remain unchanged. No live data reset, cleanup or migration command is part of setup, build or deployment. Historical patch/reset scripts at the repository root are not setup instructions and must not be run against live data. Visiting Wiki, habits, prints or analytics no longer rewrites/merges/deletes stored records automatically. Existing character names, Series/Franchise values and legacy browser data are retained.

Series and Franchise use separate lists. Matching ignores capitalization, typed values can be saved as new options, and saved suggestions are immediately reusable. The suggestion panel is portaled outside the scrollable character dialog and supports arrows, Enter and Escape.

Nickname profiles use the separate IndexedDB database `huntrr.organizer.profiles`. Each has a permanent random ID, a nickname, and a creation date. Records, local photos, STL binaries, and the current timer are scoped to that ID. Selecting a different profile reloads the planner to release the previous profile's state and temporary file grants.

The selected profile and its data persist through normal refreshes, tab and browser closures, and restarts at the **same origin and browser profile**. Preview and production URLs have separate browser storage. Clearing site data, private browsing, storage limits, or browser eviction can remove local data. Keep a downloaded backup. Nicknames separate local workspaces within the app, but anyone with access to this browser can switch profiles.

### Transfer a workspace

1. In the current Organizer, use **Settings → Export Everything**. For a profile in this branch, choose **Settings → Export profile data → Download profile backup**. Keep the original download.
2. Open the Preview and choose **Import profile data**. Review the record and file counts, name the copy, and choose **Import as new profile**. The entire copy commits in one IndexedDB transaction. Imports accept the old JSON export and the new versioned backup. Existing profiles and source records remain intact.
3. On the original site address, **Bring over an older workspace** can review and export the old IndexedDB workspace, older browser records, an existing Firebase session, or an existing Supabase account separately. The legacy account exporters require an existing session at that site address. Legacy stores and their schemas stay available to the previous app.
4. For an existing Supabase account, **Review existing Supabase workspace** reads the cloud records and bundles the private files. **Review Supabase device copy** separately reads the cached device records and pending file bytes. Keep these separate to review conflicts or pending edits. The previous email build also offers **Export planner backup** under its account settings.
5. Old cloud backups may contain file links rather than bytes. **Copy available cloud files** bundles accessible photos and STL files, keeping original links for any unavailable file. Private Drive originals require a separate read-only authorization. Verify the imported images and models before relying on the copy.

## Environment and integrations

See `.env.example`; never commit `.env`, `.env.local`, service-account files, OAuth tokens or private keys. All `VITE_` variables are public and embedded at build time. Rebuild/redeploy after changing them.

| Variable / setting | Purpose |
| --- | --- |
| `PORT`, `NODE_ENV` | Express port and development/production mode |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`, `VITE_FIRESTORE_DATABASE_ID` | Optional complete replacement for the bundled public Firebase configuration. Leave blank to preserve the original project/database. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional public configuration for read-only export from an existing Supabase session. |
| `FIREBASE_PROJECT_ID` | Server-side ID token verification project; default is the original project. Must match a replacement client project. No service-account private key is needed for ID token verification. |
| `VITE_GOOGLE_CLIENT_ID` | Google Web OAuth client for Drive/Sheets consent |
| `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID` | Google Picker API key and Cloud project number; existing config is used where supported |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional server-only AI extraction key and model ID enabled for that account. There is no invented/default model. |

Google Drive and Sheets access is optional and uses separate, explicit read-only file authorization. In Google Cloud, enable the applicable Drive, Sheets and Picker APIs and add the exact site's JavaScript origin to the OAuth client. Drive grants are held in memory for the current tab. Imported cloud attachments require authorized access to the original files or an export that already bundles their bytes.

The existing AI text import endpoint still requires a verified Firebase identity when configured. Nickname profiles do not carry that identity. Manual job entry, local spreadsheet import, and public URL import remain available. URL imports reject unsafe addresses and may be blocked by the originating site.

## Deploy the complete Express website

Static-only hosting is insufficient: imports and Drive/Sheets proxies use Express API routes. `vercel.json` deploys `api/index.ts` as the Express handler and `dist` assets on the same origin. `api/index.ts` loads the built `dist/app.cjs` Express backend and never starts a listening port. The build resolves internal TypeScript imports, bundles Firebase Admin and its ESM dependencies for Vercel cold starts, and embeds the original public Firebase configuration into that backend bundle; private credentials remain runtime environment variables. Existing Vite/React/Firebase architecture is retained.

1. Push this working branch to the GitHub repository.
2. In Vercel, create/import **huntrr-organizer**, linked to this repository, using the intended account/team and Node 24. Use Framework **Other**, install `npm ci`, build `npm run build`, output `dist/public` (also declared in `vercel.json`). Deploy the working branch as a **preview**, not a promotion to the live production domain.
3. Set optional server/client variables in that project's Preview environment before deployment. Keep private keys server-only. For local-only operation no secrets are required.
4. Deploy. Check `/api/health`, `/`, `/favicon.svg`, a fingerprinted `/assets/` URL, and an unknown `/api/` URL (404 JSON). Test local CRUD and refresh on the resulting HTTPS origin.
5. Add the exact preview origin to the Google OAuth client only if testing optional Drive imports. Verify migration with disposable backup files. Keep the production site on its current deployment until the replacement is approved.
6. Assign a custom domain only after confirming that it is available and configuring its DNS/TLS. The name `huntrr.organizer` is branding until then.

For a conventional Node host, deploy the same source, run `npm ci && npm run build`, set `NODE_ENV=production`, and start `npm start` with the provider's `PORT`. `/api/health` is the health-check route. Profile data stays in the browser, and legacy Firebase data remains in the original project.

Rules are supplied for review and explicit Firebase deployment. If deploying them, target the original project **and named database**, compare existing deployed rules first, and deploy only rules/indexes intentionally reviewed for that project. This task does not grant access to Firebase Console or verify existing deployed rules through a live account.

## Verification

The default Wiki Drive folder was an unusable placeholder; configure a real folder in Settings before using Drive for Wiki photos. Saved user folder settings are retained. Merely storing a folder ID is labeled as configured, not as verified access.

`npm test` uses fake IndexedDB and an isolated test namespace; it never signs in to Firebase or accesses live data. The repository's older ad-hoc scripts are not the test suite and include destructive tools. Browser/API verification results and any externally blocked checks are recorded in `VERIFICATION.md`.
