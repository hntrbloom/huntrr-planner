import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient | null = null;

// Only a deliberate legacy export opens the old session. Planner profiles never use it.
export function openLegacySupabase() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  supabase ??= createClient(url, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return supabase;
}
