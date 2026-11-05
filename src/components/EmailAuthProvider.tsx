import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Eye, EyeOff } from 'lucide-react';
import { AuthContext, setAccessToken } from '../lib/AuthContext';
import { getAccountOwner, setAccountOwner } from '../lib/accountStore';
import { LOCAL_SESSION_KEY, LOCAL_USER_ID } from '../lib/workspaceMode';
import { PlannerBow } from './PlannerDecor';

type Mode = 'login' | 'signup' | 'forgot' | 'recovery';
const RECOVERY_KEY = 'huntrr.organizer.password-recovery';
export const passwordMinimum = 10;

export function EmailAuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState(() => localStorage.getItem(LOCAL_SESSION_KEY) === 'true');
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY' && next) sessionStorage.setItem(RECOVERY_KEY, next.user.id);
      const recovery = Boolean(next && sessionStorage.getItem(RECOVERY_KEY) === next.user.id);
      if (recovery) setMode('recovery');
      if (next) {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        setLocal(false);
      }
      setRecovering(recovery);
      const account = !recovery && next?.user.email_confirmed_at ? next.user.id : null;
      if (getAccountOwner() !== account) setAccessToken(null);
      setAccountOwner(account);
      setSession(next);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setConfirm('');
    setError('');
    setMessage('');
  };
  const logout = async () => {
    if (session) {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
    setAccountOwner(null);
    sessionStorage.removeItem(RECOVERY_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setLocal(false);
    setRecovering(false);
    switchMode('login');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if ((mode === 'signup' || mode === 'recovery') && (password.length < passwordMinimum || password !== confirm)) {
      setError(password.length < passwordMinimum ? 'Use at least 10 characters.' : 'The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setMessage('Check your inbox for a link to confirm your email address.');
      } else if (mode === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setMessage('If an account exists for that address, a reset link is on its way. Open it in this browser.');
      } else {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await logout();
        setMessage('Password updated. Log in with your new password.');
      }
      setPassword('');
      setConfirm('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The request failed. Please try again.');
    } finally { setBusy(false); }
  };

  const id = session?.user.email_confirmed_at ? session.user.id : undefined;
  const accountEmail = session?.user.email ?? '';
  const displayName = String(session?.user.user_metadata.display_name || '');
  const user = useMemo(() => id
    ? { uid: id, email: accountEmail, isAnonymous: false as const, displayName }
    : local ? { uid: LOCAL_USER_ID, email: null, isAnonymous: false as const, isLocal: true as const, displayName: 'Local workspace' } : null,
  [id, accountEmail, displayName, local]);
  useEffect(() => {
    const description = new URLSearchParams(window.location.hash.slice(1)).get('error_description') || new URLSearchParams(window.location.search).get('error_description');
    if (description) setError(description);
  }, []);
  if (loading) return <main className="email-account-world"><p role="status">Restoring your session…</p></main>;
  if (!recovering && user) {
    return <AuthContext.Provider value={{ user, loading, signIn: async () => { throw new Error('Connect Google Drive from Settings.'); }, logOut: logout, signInAsGuest: async () => {} }}>
      <div key={user.uid}>{children}</div>
    </AuthContext.Provider>;
  }
  const heading = { login: 'Log in', signup: 'Create account', forgot: 'Reset your password', recovery: 'Choose a new password' };
  return <main className="email-account-world">
    <section className="email-account-card">
      <PlannerBow className="email-account-bow" />
      <h1>Huntrr Organizer</h1>
      <p>Your space to plan, focus, and grow.</p>
      <h2>{heading[mode]}</h2>
      <form onSubmit={submit}>
        {mode !== 'recovery' && <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {mode !== 'forgot' && <label>Password
          <span className="email-password-field">
            <input required type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>}
        {(mode === 'signup' || mode === 'recovery') && <label>Confirm password<input required type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button className="email-account-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset email' : mode === 'recovery' ? 'Update password' : heading[mode]}</button>
      </form>
      {mode === 'login' ? <div className="email-account-actions">
        <button type="button" disabled={busy} onClick={() => switchMode('signup')}>Create account</button>
        <button type="button" disabled={busy} onClick={() => switchMode('forgot')}>Forgot password?</button>
        <button type="button" disabled={busy} onClick={() => { localStorage.setItem(LOCAL_SESSION_KEY, 'true'); setLocal(true); }}>Continue on this device</button>
      </div> : <button type="button" disabled={busy} onClick={() => recovering ? void logout().catch(err => setError(err.message)) : switchMode('login')}>Back to log in</button>}
    </section>
  </main>;
}
