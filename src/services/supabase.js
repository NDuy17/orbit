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

function getAuthStorageKey() {
  if (!hasSupabaseConfig) {
    return null;
  }

  try {
    return `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

export const SUPABASE_AUTH_STORAGE_KEY = getAuthStorageKey();

export function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('auth session missing')
  );
}

export async function clearSupabaseAuthStorage() {
  if (!SUPABASE_AUTH_STORAGE_KEY) {
    return;
  }

  await Promise.all(
    [
      SUPABASE_AUTH_STORAGE_KEY,
      `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
      `${SUPABASE_AUTH_STORAGE_KEY}-user`,
    ].map((key) => AsyncStorage.removeItem(key).catch(() => null))
  );
}

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
