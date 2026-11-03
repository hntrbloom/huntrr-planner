import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, getRedirectResult, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, setLocalGuest } from './firebase';
import { LogIn, AlertCircle, UserCircle2, RefreshCw } from 'lucide-react';
import { requestFreshDriveToken, getLastOAuthDiagnostic, OAuthDiagnosticInfo } from './driveAuth';

const TOKEN_KEY = 'drive_access_token';
const TIMESTAMP_KEY = 'drive_token_timestamp';
const TOKEN_EXPIRY_MS = 55 * 60 * 1000; // 55 minutes

let cachedAccessToken: string | null = null;
let cachedTokenTimestamp: number = 0;

export const getAccessToken = (): string | null => {
  if (cachedAccessToken && (Date.now() - cachedTokenTimestamp < TOKEN_EXPIRY_MS)) {
    return cachedAccessToken;
  }
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    const timestampStr = sessionStorage.getItem(TIMESTAMP_KEY) || localStorage.getItem(TIMESTAMP_KEY);
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
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TIMESTAMP_KEY, String(cachedTokenTimestamp));
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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<OAuthDiagnosticInfo | null>(null);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth).then((result) => {
        if (result?.user) {
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
        setUser(u);
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
      if (user && !user.isAnonymous) {
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
    setDiagnosticInfo(null);
    setLoading(true);
    try {
      await signInAnonymously(auth);
      setLoading(false);
    } catch (error: any) {
      console.warn('Firebase anonymous sign-in fallback to local guest session', error);
      setLocalGuest(true);
      setUser({
        uid: 'guest-local-user',
        isAnonymous: true,
        displayName: 'Guest User',
        email: null,
      } as User);
      setLoading(false);
    }
  };

  const logOut = async () => {
    try {
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#FFF0F4]">
        <div className="w-12 h-12 border-4 border-[#FFB8CD] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[14px] font-bold text-black/50">Loading your space...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 shadow-md text-center max-w-md w-full mx-4">
          <h2 className="text-[28px] font-headline-md text-on-surface mb-2">
            Welcome
          </h2>
          <p className="text-[16px] font-body-md text-on-surface-variant mb-6">
            Sign in to save your planner data and preferences.
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
              Preview as Guest
            </button>
            
            <p className="text-[12px] text-on-surface-variant text-center mt-4">
              If sign-in is blocked in this preview, please click the "Open in new tab" icon at the top right of this panel.
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
