import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { apiHeaders } from '../lib/apiClient';
import { forgetAccountCache, getAccountOwner, getAccountSyncState, getPendingAccountWrites, resolveUsingCloud, subscribeAccountSync, syncAccountNow } from '../lib/accountStore';
import { browserBackup, hasBrowserBackup, importIntoAccount, portableBackup, readBackup } from '../lib/accountMigration';
import { validateBackup } from '../lib/backupValidation';
import { passwordMinimum } from './EmailAuthProvider';

function download(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AccountSettings() {
  const { user, logOut } = useAuth();
  const state = useSyncExternalStore(subscribeAccountSync, getAccountSyncState);
  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [hasLocal, setHasLocal] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ source: string; data: unknown; count: number }>();
  useEffect(() => { void hasBrowserBackup().then(setHasLocal).catch(() => {}); }, []);

  if (!supabase || !user || getAccountOwner() !== user.uid) return null;
  const client = supabase;
  const account = user;
  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setFeedback(undefined);
    try { setFeedback({ error: false, text: await action() }); }
    catch (error) { setFeedback({ error: true, text: (error as { message?: string }).message || 'Please try again.' }); }
    finally { setBusy(false); }
  };
  const profile = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const nextEmail = email.trim();
      const changingEmail = nextEmail !== account.email;
      const { error } = await client.auth.updateUser({
        data: { display_name: name.trim() },
        ...(changingEmail ? { email: nextEmail } : {}),
      }, { emailRedirectTo: window.location.origin + window.location.pathname });
      if (error) throw error;
      return changingEmail ? 'Check your email to confirm the address change.' : 'Profile saved.';
    });
  };
  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (password.length < passwordMinimum || password !== confirmPassword) throw new Error('Use at least 10 characters and enter the same password twice.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      return 'Password changed.';
    });
  };
  const chooseImport = (source: string, load: () => Promise<unknown>) => run(async () => {
    const data = await load();
    const { count } = validateBackup(data);
    setPendingImport({ source, data, count });
    return 'Review the destination account before importing.';
  });
  const removeAccount = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (deleteEmail.trim() !== account.email || !deletePassword) throw new Error('Enter this account’s email address and password.');
      const response = await fetch('/api/account', {
        method: 'DELETE', headers: await apiHeaders(), body: JSON.stringify({ password: deletePassword }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Account deletion failed.');
      await forgetAccountCache(account.uid);
      await logOut();
      return 'Account deleted.';
    });
  };

  return <section className="account-settings mb-6">
    <h2 className="text-xl font-bold">Your account</h2>
    <p>{account.email} · {state}</p>
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    <form onSubmit={profile}>
      <label>Display name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} autoComplete="name" /></label>
      <label>Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>
      <button disabled={busy}>Save profile</button>
    </form>
    <form onSubmit={changePassword}>
      <label>New password<input type="password" required minLength={passwordMinimum} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label>Confirm new password<input type="password" required autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
      <button disabled={busy}>Change password</button>
    </form>
    <h3 className="font-bold">Your planner data</h3>
    <p>Import a backup into {account.email}. If an ID already exists with different data, the cloud copy stays in place and the import reports the skipped record.</p>
    {hasLocal && <button disabled={busy} onClick={() => void chooseImport('Data saved in this browser', browserBackup)}>Review browser data</button>}
    <label>Choose planner backup<input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void chooseImport(file.name, () => {
        if (file.size > 100 * 1024 * 1024) throw new Error('Choose a backup smaller than 100 MB.');
        return readBackup(file);
      });
    }} /></label>
    {pendingImport && <div className="grid gap-2">
      <p>{pendingImport.source} has {pendingImport.count} records. Import into {account.email}?</p>
      <button disabled={busy} onClick={() => void run(async () => {
        const result = await importIntoAccount(account.uid, pendingImport.data);
        setPendingImport(undefined);
        return `${result.imported} imported and verified, ${result.alreadyPresent} already present, ${result.skipped} skipped because the cloud copy differs. Keep your original backup.`;
      })}>Confirm import</button>
      <button disabled={busy} onClick={() => setPendingImport(undefined)}>Cancel import</button>
    </div>}
    <button disabled={busy} onClick={() => void run(async () => {
      download(await portableBackup(account.uid), 'huntrr-planner-backup.json');
      return 'Backup downloaded.';
    })}>Export planner backup</button>
    {state !== 'Saved' && <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => void syncAccountNow()}>Retry sync</button>
      <button disabled={busy} onClick={() => void run(async () => {
        const pending = await getPendingAccountWrites(account.uid);
        download(pending, 'huntrr-pending-edits.json');
        return 'Pending changes downloaded.';
      })}>Export pending changes</button>
      {state === 'Conflict' && <>
        <p role="alert">Another device saved a newer copy. Your pending edits are still on this device.</p>
        <button disabled={busy} onClick={() => void run(async () => {
          if (!window.confirm('Download a copy of all pending edits and replace this device’s queued changes with the cloud versions?')) return 'Pending edits kept.';
          download(await getPendingAccountWrites(account.uid), 'huntrr-pending-edits.json');
          await resolveUsingCloud(account.uid);
          return 'Pending edits downloaded. The planner is using the cloud copies.';
        })}>Download edits and use cloud copies</button>
      </>}
    </div>}
    <button disabled={busy} onClick={() => void run(async () => { await logOut(); return 'Signed out.'; })}>Log out</button>
    {!deleting ? <button disabled={busy} onClick={() => setDeleting(true)}>Delete account…</button> :
      <form onSubmit={removeAccount}>
        <p>Deleting this account permanently removes its cloud records and files. Export a backup first if you want to keep a copy.</p>
        <label>Confirm email address<input type="email" required value={deleteEmail} onChange={event => setDeleteEmail(event.target.value)} /></label>
        <label>Current password<input type="password" required autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></label>
        <button disabled={busy}>Permanently delete account</button>
        <button type="button" disabled={busy} onClick={() => { setDeleting(false); setDeletePassword(''); setDeleteEmail(''); }}>Cancel deletion</button>
      </form>}
  </section>;
}
