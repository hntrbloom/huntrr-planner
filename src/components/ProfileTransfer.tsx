import { useState } from 'react';
import { saveAs } from 'file-saver';
import { gatherAllData, validateBackup, type WorkspaceBackup } from '../lib/backup';
import { exportOlderBrowserData, exportExistingFirebaseWorkspace } from '../lib/legacyBackup';
import { copyCloudAttachments, hasCloudAttachments } from '../lib/cloudAttachmentBackup';
import { requestFreshDriveToken, getLastOAuthDiagnostic } from '../lib/driveAuth';
import { LOCAL_USER_ID } from '../lib/workspaceMode';
import { useProfile } from '../lib/ProfileContext';

function download(backup: WorkspaceBackup) {
  const filename = `huntrr-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  saveAs(new Blob([JSON.stringify(backup)], { type: 'application/json' }), filename);
}

export function ProfileTransfer({ local, browser }: { local: boolean; browser: boolean }) {
  const { user, importBackup } = useProfile();
  const [exported, setExported] = useState<WorkspaceBackup | null>(null);
  const [pending, setPending] = useState<WorkspaceBackup | null>(null);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await work(); }
    catch (err) { setError(err instanceof Error ? err.message : 'The workspace transfer failed.'); }
    finally { setBusy(false); }
  };

  const prepare = (backup: WorkspaceBackup, fallback: string) => {
    validateBackup(backup);
    setPending(backup);
    setNickname(typeof backup.profile?.nickname === 'string' ? backup.profile.nickname.slice(0, 40) : fallback);
  };

  const hasCloudFiles = pending && hasCloudAttachments(pending);

  return <section className="profile-panel" aria-label="Profile data">
    <h2>Profile data</h2>
    <p>Backups include records and files saved on this device. Importing creates a separate profile.</p>
    <div className="profile-actions">
      {user && <button type="button" disabled={busy} onClick={() => run(async () => {
        setExported(await gatherAllData(user.uid));
        setMessage('Your backup is ready to download.');
      })}>Export profile data</button>}
      {exported && <button type="button" onClick={() => download(exported)}>Download profile backup</button>}
      <label className="profile-file">
        <span>Import profile data</span>
        <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void run(async () => {
            setPending(null);
            prepare(JSON.parse(await file.text()), 'Imported workspace');
          });
        }} />
      </label>
    </div>
    <details>
      <summary>Bring over an older workspace</summary>
      <p>Browser data belongs to the site address where it was saved. For a different site or browser, export from the old Organizer and import the downloaded file here.</p>
      <div className="profile-actions">
        {local && <button type="button" disabled={busy} onClick={() => run(async () => prepare(await gatherAllData(LOCAL_USER_ID), 'Previous local workspace'))}>Review previous local workspace</button>}
        {browser && <button type="button" disabled={busy} onClick={() => run(async () => prepare(await exportOlderBrowserData(), 'Older browser workspace'))}>Review older browser records</button>}
        <button type="button" disabled={busy} onClick={() => run(async () => prepare(await exportExistingFirebaseWorkspace(), 'Previous Firebase workspace'))}>Review existing Firebase workspace</button>
      </div>
    </details>
    {pending && <form className="profile-import" onSubmit={event => {
      event.preventDefault();
      void run(async () => {
        await importBackup(nickname, pending);
        setPending(null);
      });
    }}>
      <p>{validateBackup(pending).count} records and {Object.keys(pending.files || {}).length} bundled files. The import gets a new profile ID.</p>
      {hasCloudFiles && <div>
        <p>This backup contains cloud file links. Copy accessible files to include their contents in the new profile.</p>
        <div className="profile-actions">
          <button type="button" disabled={busy} onClick={() => run(async () => {
            if (!await requestFreshDriveToken(true)) throw new Error(getLastOAuthDiagnostic().lastErrorMessage || 'Drive access was not granted.');
            setMessage('Drive file access is available for this tab.');
          })}>Authorize Drive file access</button>
          <button type="button" disabled={busy} onClick={() => run(async () => {
            const result = await copyCloudAttachments(pending);
            setPending(result.backup);
            setMessage(`${result.copied} cloud files copied. ${result.unavailable} unavailable references were retained.`);
          })}>Copy available cloud files</button>
        </div>
      </div>}
      <label>Nickname for imported profile <input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={40} required /></label>
      <div className="profile-actions">
        <button type="button" disabled={busy} onClick={() => run(async () => { download(pending); setMessage('Backup prepared for download.'); })}>Download backup copy</button>
        <button className="profile-primary" type="submit" disabled={busy}>Import as new profile</button>
        <button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
      </div>
    </form>}
    {busy && <p role="status">Preparing workspace data…</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
