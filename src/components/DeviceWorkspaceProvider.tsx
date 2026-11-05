import { useState, type ReactNode } from 'react';
import { AuthContext, setAccessToken } from '../lib/AuthContext';
import { LOCAL_SESSION_KEY, LOCAL_USER_ID } from '../lib/workspaceMode';
import { PlannerBow } from './PlannerDecor';

export function DeviceWorkspaceProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(() => localStorage.getItem(LOCAL_SESSION_KEY) === 'true');
  const leave = async () => {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setAccessToken(null);
    setActive(false);
  };
  if (active) return <AuthContext.Provider value={{
    user: { uid: LOCAL_USER_ID, isAnonymous: false, isLocal: true, displayName: 'Local workspace', email: null },
    loading: false, signIn: leave, logOut: leave, signInAsGuest: async () => {},
  }}>{children}</AuthContext.Provider>;
  return <main className="email-account-world"><section className="email-account-card">
    <PlannerBow className="email-account-bow" />
    <h1>Huntrr Organizer</h1>
    <h2>Your plans, in one happy place</h2>
    <p>Email accounts are not configured for this preview yet. You can still open the complete Organizer on this device.</p>
    <p>Device workspaces stay in this browser. Export a backup before changing devices or clearing browser data.</p>
    <button className="email-account-primary" onClick={() => {
      localStorage.setItem(LOCAL_SESSION_KEY, 'true'); setActive(true);
    }}>Continue on this device</button>
  </section></main>;
}
