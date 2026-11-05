import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { portableBackup } from '../lib/accountMigration';

export function LegacyRecoveryPanel() {
  const [legacy, setLegacy] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => onAuthStateChanged(auth, user => setLegacy(user?.isAnonymous ? null : user)), []);
  return <section className="account-settings mb-6" aria-label="Original Organizer recovery">
    <h2 className="text-xl font-bold">Original Organizer recovery</h2>
    <p>Your original Firebase, Drive, and browser data is kept separately. Importing a backup copies data into your email account; it does not remove the original.</p>
    <p>Browser data belongs to its original website and browser. A preview on a different address cannot read production browser storage. Export there, then import here using Your planner data.</p>
    {legacy ? <>
      <p>Original Firebase session: {legacy.email}. Exporting reads this workspace only. Connect its Drive account below if it contains Drive attachments.</p>
      <button disabled={busy} onClick={async () => {
        setBusy(true); setMessage('Preparing a portable copy…');
        try {
          const backup = await portableBackup(legacy.uid, true);
          const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
          const link = document.createElement('a'); link.href = url; link.download = 'huntrr-organizer-original-backup.json'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setMessage('Original workspace exported. Review the destination email before importing this copy.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed. Original data retained.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Exporting…' : 'Export original Firebase workspace with files'}</button>
    </> : <p>No original Firebase session is available on this address. Open the original Organizer to export your data. Email login does not reconnect or replace your Firebase account.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
