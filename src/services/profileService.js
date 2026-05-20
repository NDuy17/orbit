import { requireSupabase, supabase } from './supabase';
import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';

function formatLastActiveTime(value) {
  if (!value) {
    return 'Vừa hoạt động';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Vừa hoạt động';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function mapProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name || row.full_name || 'Người dùng Orbit',
    avatar: row.avatar_url || DEFAULT_AVATAR_URL,
    avatar_url: row.avatar_url,
    bio: row.bio || '',
    status: row.status || '',
    isOnline: Boolean(row.is_online),
    lastActive: row.is_online ? 'Đang online' : `Hoạt động lúc ${formatLastActiveTime(row.last_active)}`,
    friends: row.friends_count || 0,
    met: row.encounters_count || 0,
    recent: row.recent_count || 0,
  };
}

export async function createProfile(userId, profile) {
  const client = requireSupabase();
  const payload = {
    id: userId,
    name: profile.name || 'Orbit user',
    avatar_url: profile.avatar_url || profile.avatar || DEFAULT_AVATAR_URL,
    bio: profile.bio || '',
    status: profile.status || 'Moi tham gia Orbit',
    is_online: true,
    last_active: new Date().toISOString(),
  };

  const { data, error } = await client.from('profiles').upsert(payload).select().single();

  if (error) {
    throw error;
  }

  return mapProfileRow(data);
}

export async function fetchCurrentUserProfile() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    return null;
  }

  return fetchProfileById(authData.user.id);
}

export async function fetchProfileById(userId) {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();

  if (error) {
    throw error;
  }

  return mapProfileRow(data);
}

export async function updateProfile(userId, updates) {
  const client = requireSupabase();
  const payload = {
    name: updates.name,
    avatar_url: updates.avatar_url,
    bio: updates.bio,
    status: updates.status,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  const { data, error } = await client.from('profiles').update(payload).eq('id', userId).select().single();

  if (error) {
    throw error;
  }

  return mapProfileRow(data);
}

export async function updateOnlineStatus(isOnline) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    return null;
  }

  const payload = {
    is_online: isOnline,
    last_active: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('profiles')
    .update(payload)
    .eq('id', authData.user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProfileRow(data);
}

export function subscribeToProfiles(onChange) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('profiles:presence')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
