import { createProfile } from './profileService.js';
import { requireSupabase, supabase } from './supabase';
import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';

export async function registerWithEmail(email, password, profile) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: profile.name,
        avatar_url: DEFAULT_AVATAR_URL,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    try {
      await createProfile(data.user.id, profile);
    } catch (profileError) {
      if (data.session) {
        throw profileError;
      }
    }
  }

  return data;
}

export async function loginWithEmail(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data;
}

export async function logout() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentSession() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export function listenToAuthChanges(callback) {
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));

  return () => data.subscription.unsubscribe();
}
