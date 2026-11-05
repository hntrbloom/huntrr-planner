import { auth } from './firebase';
import { LOCAL_SESSION_KEY } from './workspaceMode';
import { supabase } from './supabase';

export async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = 'Bearer ' + data.session.access_token;
    return headers;
  }
  if (auth.currentUser && localStorage.getItem(LOCAL_SESSION_KEY) !== 'true') headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  return headers;
}
