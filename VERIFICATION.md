# Verification — huntrr.organizer

Checked locally on November 2, 2026 (America/Chicago), on branch `codex/huntrr-organizer`.

## Results

| Check | Result |
| --- | --- |
| `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | Passed after repairing the original out-of-sync npm lockfile |
| `npm test` | 7 passed: persistent local CRUD/merge/deletion, query filters/order/limits/document IDs, timestamps and array transforms, subscriptions, isolation of local/cloud batches, concurrent photo transactions, private/public URL validation and backup validation |
| `npm run lint` | Passed (`tsc --noEmit`) |
| `npm run build` | Passed: Vite frontend and bundled Express server; no CSS parser warnings remain |
| `git diff --check` | Passed |
| Production HTTP verification | Passed using `node scripts/verify-production.mjs http://127.0.0.1:4173` |
| Real public metadata fetch | HTTPS request to `https://example.com` returned 200 and real page content; public IPv4/IPv6 validation and rejection of private destinations were checked |

The HTTP check covers the branded frontend, entry JavaScript and CSS, favicon, deep links, health endpoint, JSON API 404s, missing/invalid request fields, private-URL rejection, missing AI configuration/authentication, unsupported integration hosts and malformed JSON. It makes no live Firebase writes or third-party API mutations.

## Browser checks

All 18 navigation destinations rendered in the production application without the error boundary appearing: agenda, daily log, shopping, receipts, jobs, reminders, habits, prints, goals/streaks, month, notes, blog, models, inspiration, build catalog, keychains, Wiki and settings.

Verified using explicitly named `QA` records in the local workspace:

- Character Wiki: create a character with new, separate Series and Franchise values, save, refresh, reopen and edit. Case-insensitive matching and ArrowDown/Enter selection worked. Exact matches did not offer a duplicate new option. Tested the dialog and portaled suggestions at a 390 × 844 phone viewport.
- Shopping: create a list and item, edit name and quantity, mark complete, refresh and verify completion/quantity, delete item and list. The original blur bug between item-name and quantity inputs was fixed. A Save button and list renaming were added.
- Notes: create, edit title and content, verify autosaved values after refresh, then delete the isolated note.
- Agenda: create an event, refresh, open its details, edit its title and verify the edited event after another refresh.
- Settings: Export Everything completed and downloaded a versioned JSON file with `format: huntrr.organizer`, local storage metadata and saved records.

Workspace identity and records persisted when opening fresh browser tabs. Local and cloud workspaces remain separate. Browser tests used the existing application's real local storage adapter, not fabricated sign-in or sync responses.

## Limits and external requirements

- Hosting: the connected Vercel account could list the `huntrr` team but project creation returned HTTP 403: **You don't have permission to create the project**. No Vercel CLI was installed for a separately authenticated fallback. No preview was deployed. A team connection permitted to create/deploy `huntrr-organizer` is required. Deployment settings and exact steps are in README.
- Cloud: no Firebase/Google account was used for tests. Live Firebase sign-in, deployed security rules, cross-device Firestore persistence, Firebase image uploads, Drive, Picker and Sheets remain unverified. They require the real account and authorized origins/domains described in `.env.example` and README. The original private rules and named database configuration were preserved.
- AI: no Gemini server key/model were supplied. Missing configuration is a real HTTP 503; manual job records remain available. Enabling AI also requires a verified, non-anonymous Firebase user.
- Native browser confirmation dialogs blocked the browser automation during appointment deletion; that confirmation was not accepted. The isolated `QA Studio Check Edited` event and `QA Moon Rabbit Edited` character may remain in local storage. It can be deleted from its details. The Wiki dialog was implemented and checked by TypeScript/build; its final interactive deletion could not be completed after the browser confirmation interruption. This did not involve live personal data. Wiki deletion now uses an accessible application dialog instead of a native browser confirmation.
- JSON restore validation and atomic local writes have automated coverage; a complete interactive restore roundtrip was not performed. Large restores merge in batches and can be retried after interruption.
- Receipts/PDF exports, every habit/job/print edit variant, STL uploads/GPU interactions, original Drive folder permissions and external imports were not each exercised end-to-end. Screen rendering and the shared storage layer were checked; these are not claimed as live integration successes.
- Some legacy libraries still produce chunks larger than Vite's 500 kB advisory threshold (not build errors). Heavy screens are loaded on demand.

No database-clearing, reset or migration script was run, and no existing cloud records were edited or deleted.
