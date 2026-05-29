import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const requestTimeoutMs = Number(
  import.meta.env.VITE_SUPABASE_TIMEOUT_MS || 12000
);

export const hasSupabaseConfig = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')
);

function getAuthStorageKey() {
  if (!hasSupabaseConfig) {
    return null;
  }

  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

export const supabaseAuthStorageKey = getAuthStorageKey();

export function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('auth session missing')
  );
}

export function clearSupabaseAuthStorage() {
  if (!supabaseAuthStorageKey || typeof window === 'undefined') {
    return;
  }

  [
    supabaseAuthStorageKey,
    `${supabaseAuthStorageKey}-code-verifier`,
    `${supabaseAuthStorageKey}-user`,
  ].forEach((key) => window.localStorage.removeItem(key));
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: async (input, init = {}) => {
          const controller = new AbortController();
          const timeout = window.setTimeout(
            () => controller.abort(),
            requestTimeoutMs
          );
          const abortFromCaller = () => controller.abort();

          init.signal?.addEventListener('abort', abortFromCaller, {
            once: true,
          });

          try {
            return await fetch(input, {
              ...init,
              signal: controller.signal,
            });
          } catch (error) {
            if (error.name === 'AbortError') {
              throw new Error(
                'Supabase quá thời gian phản hồi. Thử tải lại hoặc kiểm tra mạng.'
              );
            }

            throw error;
          } finally {
            window.clearTimeout(timeout);
            init.signal?.removeEventListener('abort', abortFromCaller);
          }
        },
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Thiếu cấu hình Supabase cho Orbit Admin.');
  }

  return supabase;
}
