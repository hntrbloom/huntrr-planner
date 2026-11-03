import { LOCAL_SESSION_KEY } from './workspaceMode';
import { setAccessToken } from './AuthContext';

export interface OAuthDiagnosticInfo {
  timestamp: string;
  origin: string;
  clientIdPresent: boolean;
  clientIdMasked: string;
  scopesRequested: string;
  lastStatus: 'idle' | 'in_progress' | 'success' | 'error';
  lastErrorType: string | null;
  lastErrorMessage: string | null;
}

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

let activeTokenPromise: Promise<string | null> | null = null;
let isPromptingUser = false;

let lastDiagnostic: OAuthDiagnosticInfo = {
  timestamp: new Date().toISOString(),
  origin: typeof window !== 'undefined' ? window.location.origin : '',
  clientIdPresent: false,
  clientIdMasked: '',
  scopesRequested: SCOPES,
  lastStatus: 'idle',
  lastErrorType: null,
  lastErrorMessage: null,
};

export function isDriveAuthPromptActive(): boolean {
  return isPromptingUser;
}

export function getLastOAuthDiagnostic(): OAuthDiagnosticInfo {
  if (typeof window !== 'undefined') {
    lastDiagnostic.origin = window.location.origin;
  }
  return { ...lastDiagnostic };
}

/**
 * Obtains a fresh Google Drive OAuth access token via google.accounts.oauth2.initTokenClient.
 * @param promptUser If true, shows account selection / consent prompt (user interaction required).
 *                   If false, attempts silent token request ('prompt: none').
 */
export function requestFreshDriveToken(promptUser: boolean = false): Promise<string | null> {
  if (localStorage.getItem(LOCAL_SESSION_KEY) === 'true') return Promise.resolve(null);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const maskedClientId = clientId 
    ? (clientId.length > 16 ? `${clientId.slice(0, 10)}...${clientId.slice(-14)}` : clientId) 
    : 'MISSING';

  lastDiagnostic = {
    timestamp: new Date().toISOString(),
    origin: currentOrigin,
    clientIdPresent: !!clientId,
    clientIdMasked: maskedClientId,
    scopesRequested: SCOPES,
    lastStatus: 'in_progress',
    lastErrorType: null,
    lastErrorMessage: null,
  };

  // If an interactive prompt is already active, reuse the existing promise to prevent multiple popups
  if (promptUser && activeTokenPromise && isPromptingUser) {
    return activeTokenPromise;
  }
  // If a silent request is active and promptUser is false, reuse it
  if (!promptUser && activeTokenPromise) {
    return activeTokenPromise;
  }

  if (promptUser) {
    isPromptingUser = true;
  }

  activeTokenPromise = new Promise<string | null>((resolve) => {
    if (!clientId) {
      const errorMsg = 'VITE_GOOGLE_CLIENT_ID is missing. Please verify your Google OAuth Web Client ID in the environment settings.';
      console.warn('[GIS Drive Auth]', errorMsg);
      lastDiagnostic.lastStatus = 'error';
      lastDiagnostic.lastErrorType = 'missing_client_id';
      lastDiagnostic.lastErrorMessage = errorMsg;
      isPromptingUser = false;
      activeTokenPromise = null;
      resolve(null);
      return;
    }

    const cleanup = (token: string | null, errorType?: string, errorMsg?: string) => {
      isPromptingUser = false;
      activeTokenPromise = null;
      if (token) {
        lastDiagnostic.lastStatus = 'success';
        lastDiagnostic.lastErrorType = null;
        lastDiagnostic.lastErrorMessage = null;
        console.log('[GIS Drive Auth] Token authorization successful. Origin:', currentOrigin);
      } else {
        lastDiagnostic.lastStatus = 'error';
        lastDiagnostic.lastErrorType = errorType || 'auth_failed';
        lastDiagnostic.lastErrorMessage = errorMsg || 'Google Drive authorization was not completed.';
        console.warn('[GIS Drive Auth] Token authorization failed. Diagnostic:', {
          errorType: lastDiagnostic.lastErrorType,
          errorMessage: lastDiagnostic.lastErrorMessage,
          origin: currentOrigin,
          clientIdMasked: maskedClientId,
        });
      }
      resolve(token);
    };

    const runTokenRequest = () => {
      try {
        const googleObj = (window as any).google;
        if (!googleObj?.accounts?.oauth2?.initTokenClient) {
          cleanup(null, 'gis_not_loaded', 'Google Identity Services library is not loaded or blocked by browser.');
          return;
        }

        console.log('[GIS Drive Auth] Initializing Token Client. Origin:', currentOrigin, 'Prompt:', promptUser ? 'select_account' : 'none');

        const client = googleObj.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error || !response.access_token) {
              const err = response.error || 'no_token';
              const errDescription = response.error_description || (response.error ? `OAuth error: ${response.error}` : 'No access token returned');
              cleanup(null, err, errDescription);
            } else {
              setAccessToken(response.access_token);
              cleanup(response.access_token);
            }
          },
          error_callback: (nonOAuthErr: any) => {
            const errType = nonOAuthErr?.type || 'popup_error';
            const message = nonOAuthErr?.message || (errType === 'popup_failed_to_open' 
              ? 'Popup was blocked by iPad Safari. Please allow popups or tap Try Again.' 
              : errType === 'popup_closed' 
                ? 'Sign-in popup was closed before completing authorization.' 
                : 'Google authorization popup encountered an error.');
            cleanup(null, errType, message);
          }
        });

        client.requestAccessToken({ prompt: promptUser ? 'select_account' : 'none' });
      } catch (err: any) {
        cleanup(null, 'init_exception', err?.message || String(err));
      }
    };

    // If GIS script is already ready (from index.html preload), execute synchronously in user event
    if ((window as any).google?.accounts?.oauth2) {
      runTokenRequest();
      return;
    }

    // Fallback dynamic script loader if not already present
    const existing = document.getElementById('google-gis-script');
    if (existing) {
      existing.addEventListener('load', runTokenRequest);
      existing.addEventListener('error', () => cleanup(null, 'script_load_error', 'Failed to load Google Identity Services client script.'));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => runTokenRequest();
    script.onerror = () => cleanup(null, 'script_load_error', 'Failed to load Google Identity Services client script.');
    document.body.appendChild(script);
  });

  return activeTokenPromise;
}
