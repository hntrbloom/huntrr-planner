let grant: { token: string; expiresAt: number } | null = null;

export function getAccessToken() {
  return grant && grant.expiresAt > Date.now() ? grant.token : null;
}

export function setAccessToken(token: string | null) {
  grant = token ? { token, expiresAt: Date.now() + 55 * 60 * 1000 } : null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('drive-token-updated', { detail: { hasToken: Boolean(token) } }));
  }
}
