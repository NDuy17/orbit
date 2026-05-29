import { create } from 'zustand';
import { getAdminMembership } from '../services/adminApi';
import {
  clearSupabaseAuthStorage,
  hasSupabaseConfig,
  isInvalidRefreshTokenError,
  supabase,
} from '../services/supabaseClient';

let authSubscription = null;

async function clearLocalAdminSession() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut({ scope: 'local' });
  clearSupabaseAuthStorage();

  if (error && !isInvalidRefreshTokenError(error)) {
    throw error;
  }
}

async function resolveAdminSession(session) {
  if (!session?.user) {
    return { session: null, user: null, admin: null, status: 'unauthenticated', error: null };
  }

  const admin = await getAdminMembership(session.user.id);
  if (!admin) {
    await clearLocalAdminSession().catch(() => {
      clearSupabaseAuthStorage();
    });
    return {
      session: null,
      user: null,
      admin: null,
      status: 'unauthorized',
      error: 'Tài khoản này chưa được cấp quyền truy cập Orbit Admin.',
    };
  }

  return {
    session,
    user: session.user,
    admin,
    status: 'authenticated',
    error: null,
  };
}

const useAuthStore = create((set, get) => ({
  session: null,
  user: null,
  admin: null,
  status: 'idle',
  error: null,
  initialize: async () => {
    if (!hasSupabaseConfig) {
      set({
        status: 'configuration_error',
        error: 'Thiếu biến môi trường Supabase.',
      });
      return;
    }

    if (get().status === 'loading') {
      return;
    }

    set({ status: 'loading', error: null });

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          clearSupabaseAuthStorage();
          set({
            session: null,
            user: null,
            admin: null,
            status: 'unauthenticated',
            error: null,
          });
          return;
        }

        throw error;
      }

      set(await resolveAdminSession(data.session));

      if (!authSubscription) {
        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          try {
            set(await resolveAdminSession(nextSession));
          } catch (caughtError) {
            set({
              session: null,
              user: null,
              admin: null,
              status: 'unauthenticated',
              error: caughtError.message,
            });
          }
        });

        authSubscription = listener.subscription;
      }
    } catch (caughtError) {
      set({
        session: null,
        user: null,
        admin: null,
        status: 'unauthenticated',
        error: caughtError.message,
      });
    }
  },
  signIn: async (email, password) => {
    if (!hasSupabaseConfig) {
      throw new Error('Thiếu biến môi trường Supabase.');
    }

    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ status: 'unauthenticated', error: error.message });
      throw error;
    }

    const resolvedSession = await resolveAdminSession(data.session);
    set(resolvedSession);

    if (resolvedSession.status !== 'authenticated') {
      throw new Error(resolvedSession.error || 'Tài khoản admin chưa được cấp quyền.');
    }

    return resolvedSession;
  },
  signOut: async () => {
    await clearLocalAdminSession().catch(() => {
      clearSupabaseAuthStorage();
    });

    set({
      session: null,
      user: null,
      admin: null,
      status: 'unauthenticated',
      error: null,
    });
  },
}));

export default useAuthStore;
