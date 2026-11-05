import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, getRedirectResult, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { LOCAL_USER_ID, LOCAL_SESSION_KEY, isLocalUser } from './workspaceMode';
import { auth, setLocalGuest } from './firebase';
import { PlannerBow, PocketFriend } from '../components/PlannerDecor';
import { LogIn, AlertCircle, UserCircle2, RefreshCw } from 'lucide-react';
import { requestFreshDriveToken, getLastOAuthDiagnostic, OAuthDiagnosticInfo } from './driveAuth';
import { EmailAuthProvider } from '../components/EmailAuthProvider';
import { supabase } from './supabase';

const TOKEN_KEY = 'drive_access_token';
const TIMESTAMP_KEY = 'drive_token_timestamp';
const TOKEN_EXPIRY_MS = 55 * 60 * 1000; // 55 minutes

let cachedAccessToken: string | null = null;
let cachedTokenTimestamp: number = 0;

export const getAccessToken = (): string | null => {
  try { if (localStorage.getItem(LOCAL_SESSION_KEY) === 'true') return null; } catch { return null; }
  if (cachedAccessToken && (Date.now() - cachedTokenTimestamp < TOKEN_EXPIRY_MS)) {
    return cachedAccessToken;
  }
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    const timestampStr = sessionStorage.getItem(TIMESTAMP_KEY);
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
    
    if (stored && timestamp && (Date.now() - timestamp < TOKEN_EXPIRY_MS)) {
      cachedAccessToken = stored;
      cachedTokenTimestamp = timestamp;
      return stored;
    }
  } catch (_) {}
  return null;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  cachedTokenTimestamp = token ? Date.now() : 0;

  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TIMESTAMP_KEY, String(cachedTokenTimestamp));
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TIMESTAMP_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TIMESTAMP_KEY);
    }
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('drive-token-updated', { detail: { hasToken: !!token } }));
  }
};

export interface LocalWorkspaceUser {
  uid: typeof LOCAL_USER_ID;
  isAnonymous: false;
  isLocal: true;
  displayName: string;
  email: null;
}
const localUser: LocalWorkspaceUser = { uid: LOCAL_USER_ID, isAnonymous: false, isLocal: true, displayName: 'Local workspace', email: null };
export interface EmailWorkspaceUser {
  uid: string;
  isAnonymous: false;
  email: string;
  displayName: string;
}
interface AuthContextType {
  user: User | LocalWorkspaceUser | EmailWorkspaceUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return supabase ? <EmailAuthProvider client={supabase}>{children}</EmailAuthProvider> : <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}

function LegacyAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | LocalWorkspaceUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<OAuthDiagnosticInfo | null>(null);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      getRedirectResult(auth).then((result) => {
        if (result?.user && localStorage.getItem(LOCAL_SESSION_KEY) !== 'true') {
          setUser(result.user);
        }
      }).catch((err) => {
        console.warn('[AuthContext] Error processing redirect result:', err);
      }).finally(() => {
        setIsProcessingRedirect(false);
      });
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (u) => {
        if (u) {
          setLocalGuest(false);
          setError(null);
        }
        if (localStorage.getItem(LOCAL_SESSION_KEY) === 'true') {
          setLocalGuest(true);
          setUser(localUser);
        } else setUser(u);
        setLoading(false);
      },
      (authErr) => {
        console.error('[Firebase Auth State Error]', authErr);
        setLoading(false);
      }
    );
    
    return unsubscribe;
  }, []);

  const signIn = async () => {
    setError(null);
    setDiagnosticInfo(null);
    setIsAuthenticating(true);
    
    try {
      if (user && !user.isAnonymous && !isLocalUser(user)) {
        const token = await requestFreshDriveToken(true);
        if (token) {
          setAccessToken(token);
          setIsAuthenticating(false);
          return;
        } else {
          const diag = getLastOAuthDiagnostic();
          setDiagnosticInfo(diag);
          if (diag.lastErrorType === 'popup_closed') {
            setError('Google sign-in popup was closed before completing authorization.');
          } else if (diag.lastErrorType === 'popup_failed_to_open') {
            setError('Google sign-in popup was blocked by iPad Safari. Please allow popups or tap "Try Again".');
          } else if (diag.lastErrorType === 'missing_client_id') {
            setError('Google OAuth Client ID is missing. Please check your app settings.');
          } else {
            setError(diag.lastErrorMessage || 'Failed to authorize Google Drive. Please tap Try Again.');
          }
          setIsAuthenticating(false);
          return;
        }
      }

      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) setAccessToken(credential.accessToken);
        setUser(result.user);
        setLocalGuest(false);
      }
      setIsAuthenticating(false);
    } catch (error: any) {
      setIsAuthenticating(false);
      
      const msg = error?.message || String(error || '');
      const code = error?.code || '';
      
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in was cancelled. Tap "Sign in with Google" to try again.');
        return;
      }

      console.error('[Sign-In Error Details]', error);
      
      if (code === 'auth/popup-blocked' || msg.toLowerCase().includes('popup')) {
        setError('Sign in popup was blocked. Please open the app in a new tab (using the icon at top right) to sign in.');
      } else if (code === 'auth/unauthorized-domain') {
        setError(`This domain (${window.location.hostname}) is not authorized in Firebase Console > Authentication > Settings > Authorized domains.`);
      } else {
        setError(msg || 'An error occurred during sign in. Please try again.');
      }
    }
  };

  const signInAsGuest = async () => {
    setError(null);
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, 'true');
      setLocalGuest(true);
      setUser(localUser);
    } catch {
      setError('Browser storage is unavailable. Enable site storage or sign in with Google.');
    }
  };

  const logOut = async () => {
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setLocalGuest(false);
      await signOut(auth);
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error('Error signing out', error);
      setLocalGuest(false);
      setUser(null);
      setAccessToken(null);
    }
  };

  const isStillLoading = loading || isProcessingRedirect;

  if (isStillLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#FFF5F9]">
        <div className="w-12 h-12 border-4 border-[#F4A7C7] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[14px] font-bold text-black/50">Loading your space...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="planner-login-world">
        <div className="planner-login-device">
          <PlannerBow className="login-bow" /><PocketFriend className="login-friend" /><p className="planner-eyebrow">Your pocket-sized happy place</p>
          <h1 className="text-[28px] font-headline-md text-on-surface mb-2">
            huntrr.organizer
          </h1>
          <p className="text-[16px] font-body-md text-on-surface-variant mb-6">
            Your plans, creative projects, and little everyday things. Sign in for private cloud storage, or keep a workspace on this device.
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-[14px] font-body-md flex flex-col items-start text-left gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {diagnosticInfo && diagnosticInfo.lastErrorType && (
                <div className="mt-1 pt-2 border-t border-on-error-container/20 text-[12px] font-mono opacity-80 w-full">
                  <div>Type: {diagnosticInfo.lastErrorType}</div>
                  <div>Origin: {diagnosticInfo.origin}</div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button 
              type="button"
              onClick={signIn}
              disabled={isAuthenticating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isAuthenticating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : error ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign in with Google
                </>
              )}
            </button>
            
            <div className="relative py-2 flex items-center justify-center mt-2 mb-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/30"></div>
              </div>
              <div className="relative bg-surface-container-lowest px-4 text-[12px] font-label-sm text-on-surface-variant uppercase tracking-wider">
                Or
              </div>
            </div>

            <button 
              type="button"
              onClick={signInAsGuest}
              className="w-full flex items-center justify-center gap-2 bg-secondary-container text-on-secondary-container px-6 py-3 rounded-full font-label-md font-semibold hover:bg-secondary-container/90 transition-colors cursor-pointer"
            >
              <UserCircle2 className="w-5 h-5" />
              Continue on this device
            </button>
            
            <p className="text-[12px] text-on-surface-variant text-center mt-4">
              Local workspaces save in this browser. Export a backup before clearing browser data. Google Drive features require a Google account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: isStillLoading, signIn, signInAsGuest, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
