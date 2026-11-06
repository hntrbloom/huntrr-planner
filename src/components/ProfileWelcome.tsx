import { useState } from 'react';
import { PlannerBow, PocketFriend } from './PlannerDecor';
import { ProfileTransfer } from './ProfileTransfer';
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

  return <main className="planner-login-world profile-welcome-world">
    <div className="planner-login-device profile-welcome">
      <PlannerBow className="login-bow" />
      <PocketFriend className="login-friend" />
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
        <ProfileTransfer {...legacy} />
      </>}
    </div>
  </main>;
}
