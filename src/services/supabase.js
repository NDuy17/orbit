import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js/dist/module';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/supabaseConfig';

export const hasSupabaseConfig = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_URL.includes('.supabase.co')
);

// Location data is sensitive. Keep Row Level Security enabled on all tables,
// especially profiles, locations, friends, messages, and encounters.
export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase URL or anon key. Using mock data fallback.');
  }

  return supabase;
}
