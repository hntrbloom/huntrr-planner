import { useEffect, useState } from 'react';
import { useProfile } from '../lib/ProfileContext';
import { getAccessToken, setAccessToken } from '../lib/driveAccess';
import { getLastOAuthDiagnostic, requestFreshDriveToken } from '../lib/driveAuth';
import { getUserSettings, updateUserSettings } from '../lib/settingsUtils';
import { extractDriveFolderId, getAllPrintTypes } from '../lib/driveFolderUtils';
import { ProfileTransfer } from './ProfileTransfer';

export function SettingsView() {
  const { profile, profiles, create, select, rename, legacy } = useProfile();
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [newNickname, setNewNickname] = useState('');
  const [selected, setSelected] = useState('');
  const [folderIds, setFolderIds] = useState<Record<string, string>>({});
  const [foldersReady, setFoldersReady] = useState(false);
  const [connected, setConnected] = useState(() => Boolean(getAccessToken()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    let mounted = true;
    getUserSettings(profile.id).then(settings => {
      if (mounted) {
        setFolderIds(settings?.printFolderIds ?? {});
        setFoldersReady(true);
      }
    });
    return () => { mounted = false; };
  }, [profile?.id]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await work(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  };
  if (!profile) return null;

  return <main className="flex-1 min-h-0 md:overflow-y-auto px-4 md:px-8 py-6">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-5">Settings</h1>
      <section className="profile-panel" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        <p>Current profile: <strong>{profile.nickname}</strong></p>
        <p>Created {new Date(profile.createdAt).toLocaleDateString()}. This profile and its data stay in this browser.</p>
        <form onSubmit={event => { event.preventDefault(); void run(async () => {
          await rename(nickname);
          setNickname(nickname.trim());
          setMessage('Nickname saved.');
        }); }}>
          <label>Edit nickname <input value={nickname} maxLength={40} required onChange={event => setNickname(event.target.value)} /></label>
          <button type="submit" disabled={busy}>Save nickname</button>
        </form>
        <form onSubmit={event => { event.preventDefault(); void run(() => select(selected)); }}>
          <label>Switch profile
            <select value={selected} onChange={event => setSelected(event.target.value)} required>
              <option value="">Choose a profile</option>
              {profiles.filter(item => item.id !== profile.id).map(item =>
                <option key={item.id} value={item.id}>{item.nickname} · {new Date(item.createdAt).toLocaleDateString()}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !selected}>Open profile</button>
        </form>
        <form onSubmit={event => { event.preventDefault(); void run(() => create(newNickname)); }}>
          <label>New profile nickname <input value={newNickname} maxLength={40} required onChange={event => setNewNickname(event.target.value)} /></label>
          <button type="submit" disabled={busy}>Create another profile</button>
        </form>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
      <ProfileTransfer {...legacy} />
      <section className="profile-panel" aria-labelledby="drive-heading">
        <h2 id="drive-heading">Google Drive file access</h2>
        <p>Optional access for opening and importing Drive files and spreadsheets. Your Organizer profile stays on this device.</p>
        {connected ? <button type="button" onClick={() => { setAccessToken(null); setConnected(false); }}>Disconnect Drive</button> :
          <button type="button" disabled={busy} onClick={() => run(async () => {
            if (!await requestFreshDriveToken(true)) throw new Error(getLastOAuthDiagnostic().lastErrorMessage || 'Drive access could not be granted.');
            setConnected(true);
            setMessage('Drive access granted for this tab.');
          })}>Authorize Drive access</button>}
        <details>
          <summary>Saved Drive folders</summary>
          <form onSubmit={event => { event.preventDefault(); void run(async () => {
            const printFolderIds: Record<string, string> = {};
            for (const [name, value] of Object.entries(folderIds)) {
              if (!value.trim()) continue;
              const id = extractDriveFolderId(value);
              if (!id) throw new Error(`Enter a valid Drive folder ID or URL for ${name}.`);
              printFolderIds[name] = id;
            }
            await updateUserSettings(profile.id, { printFolderIds });
            setFolderIds(printFolderIds);
            setMessage('Drive folders saved for this profile.');
          }); }}>
            <fieldset disabled={!foldersReady || busy}>
              {getAllPrintTypes(Object.keys(folderIds)).map(({ name }) => <label key={name}>{name}
                <input value={folderIds[name] ?? ''} onChange={event => setFolderIds(previous => ({ ...previous, [name]: event.target.value }))} />
              </label>)}
              <button type="submit">Save Drive folder IDs</button>
            </fieldset>
          </form>
        </details>
      </section>
    </div>
  </main>;
}
