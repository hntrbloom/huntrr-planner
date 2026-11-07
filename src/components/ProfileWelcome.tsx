import { useState } from 'react';
import { ProfileTransfer } from './ProfileTransfer';
import { TabletFrame } from './TabletFrame';
import { useProfile } from '../lib/ProfileContext';

export function ProfileWelcome({ error }: { error: string }) {
  const { create, select, profiles, legacy } = useProfile();
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const run = async (action: () => Promise<void>) => {
    setProblem('');
    setBusy(true);
    try { await action(); }
    catch (err) { setProblem(err instanceof Error ? err.message : 'The profile could not be opened.'); }
    finally { setBusy(false); }
  };

  return (
    <main className="profile-welcome-world">
      <TabletFrame>
        <div className="profile-welcome">
          <svg className="profile-welcome-paws" viewBox="0 0 228 46" fill="currentColor" aria-hidden="true" focusable="false">
            <defs>
              <g id="welcome-paw">
                <ellipse cx="-9" cy="-4" rx="2.7" ry="3.4" transform="rotate(-24 -9 -4)" />
                <ellipse cx="-3.5" cy="-9" rx="2.7" ry="3.6" transform="rotate(-10 -3.5 -9)" />
                <ellipse cx="3.5" cy="-9" rx="2.7" ry="3.6" transform="rotate(10 3.5 -9)" />
                <ellipse cx="9" cy="-4" rx="2.7" ry="3.4" transform="rotate(24 9 -4)" />
                <path d="M0-4c3.1 0 4.2 2.9 6.5 4.8C8.9 2.8 9 6.2 6.4 7.4 4.4 8.4 2 7 0 7s-4.4 1.4-6.4.4C-9 6.2-8.9 2.8-6.5.8-4.2-1.1-3.1-4 0-4Z" />
              </g>
            </defs>
            <use href="#welcome-paw" transform="translate(17 29) rotate(72) scale(.92)" />
            <use href="#welcome-paw" transform="translate(55 16) rotate(98)" />
            <use href="#welcome-paw" transform="translate(94 29) rotate(76) scale(.95)" />
            <use href="#welcome-paw" transform="translate(133 16) rotate(102) scale(.9)" />
            <use href="#welcome-paw" transform="translate(172 29) rotate(74)" />
            <use href="#welcome-paw" transform="translate(211 16) rotate(97) scale(.94)" />
          </svg>
          <h1>Welcome to Huntrr Organizer! ♡</h1>
          <p>Pick a nickname for your planner. Your profiles stay in this browser.</p>
          {error ? <>
            <p role="alert">{error}</p>
            <button type="button" onClick={() => window.location.reload()}>Try again</button>
          </> : <>
            <form onSubmit={event => { event.preventDefault(); void run(() => create(nickname)); }}>
              <label htmlFor="welcome-nickname">Nickname</label>
              <input id="welcome-nickname" autoComplete="nickname" value={nickname} maxLength={40} required
                onChange={event => setNickname(event.target.value)} />
              <button className="profile-primary" type="submit" disabled={busy}>Create Profile</button>
            </form>
            {profiles.length > 0 && <section className="profile-panel" aria-label="Existing profiles">
              <h2>Choose an existing profile</h2>
              <ul className="profile-list">
                {profiles.map(profile => <li key={profile.id}>
                  <button type="button" disabled={busy} onClick={() => run(() => select(profile.id))}>
                    {profile.nickname}<small>Created {new Date(profile.createdAt).toLocaleDateString()}</small>
                  </button>
                </li>)}
              </ul>
            </section>}
            {problem && <p role="alert">{problem}</p>}
            <details className="profile-welcome-import">
              <summary>Import existing profile</summary>
              <ProfileTransfer {...legacy} />
            </details>
          </>}
        </div>
      </TabletFrame>
    </main>
  );
}
