import { createClient } from '@supabase/supabase-js';

const url = typeof import.meta.env === 'undefined' ? undefined : import.meta.env.VITE_SUPABASE_URL;
const key = typeof import.meta.env === 'undefined' ? undefined : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Configuring both values opts this build into email accounts.
export const supabase = url && key ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true },
}) : null;
