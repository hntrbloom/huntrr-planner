# Nickname profile preview

The preview branch starts from `codex/huntrr-organizer-supabase-light` and uses its light theme, cat header, tablet frame, and existing planner routes. The Git branch is deployed to the existing `huntrr1/huntrr-organizer` Vercel project with the Preview target.

Create a nickname profile on the welcome screen. Settings contains rename, switch, create, export, and import controls. The last selection lives in IndexedDB alongside isolated profile records and attachments.

## Bring over an existing workspace

1. Open the current workspace at its original address and export a backup. On the email branch use **Settings → Your account → Export planner backup**. On the original Organizer use **Settings → Export Everything**. Save this download.
2. Open the nickname Preview and choose **Import profile data**. Review the record and bundled file counts, give the copy a nickname, and select **Import as new profile**.
3. For a same-origin migration, **Bring over an older workspace** offers the original IndexedDB data, older browser records, and read-only export of an existing Firebase or Supabase session. The two Supabase options keep the hosted snapshot and cached device copy separate. A cache may contain pending edits and can omit records that were never opened.
4. A portable Supabase export bundles private file bytes. For old Firebase/Drive links, **Copy available cloud files** can copy accessible photos or models. Review unavailable references and keep the original backup. Drive access is a separate read-only permission.
5. Verify records, images, and models in each copy. Keep backups while evaluating the preview. Preview and production have distinct browser storage.

Hosted Supabase export uses the original project's public URL and publishable key plus an existing session at the same site address. An export from a different origin must start in the old app. The local nickname flow requires neither Supabase nor Firebase credentials.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, and `npm run verify:vercel`. Test profile creation, rename, switching, refresh, reopening, record isolation, import, and file rendering with disposable data. Check Safari on a real iPhone and iPad before production approval. Browser storage persists across normal restarts but belongs to the browser and site address, and can be cleared or evicted.

Use the Vercel **Preview** environment and keep the production branch and domains on their existing deployment pending approval.
