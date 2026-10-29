import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder')
);

// Graceful client fallback: will not crash the app if keys are not configured yet
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Persists or updates the logged-in user profile in Supabase
 */
export async function syncUserWithSupabase(user: { email: string; role: string; name: string; phone?: string }) {
  if (!supabase) {
    return { success: false, reason: 'unconfigured' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          email: user.email,
          role: user.role,
          full_name: user.name,
          phone: user.phone || null,
          last_login: new Date().toISOString()
        },
        { onConflict: 'email' }
      )
      .select();

    if (error) {
      console.warn('Supabase profile sync warning:', error.message);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err: any) {
    console.warn('Supabase network error:', err.message);
    return { success: false, error: err };
  }
}
