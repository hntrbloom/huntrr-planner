import { auth } from './firebase';
import { LOCAL_SESSION_KEY } from './workspaceMode';

export async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.currentUser && localStorage.getItem(LOCAL_SESSION_KEY) !== 'true') headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  return headers;
}
