import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';
import { textOr } from '../utils/text';
import { requireSupabase, supabase } from './supabase';

function formatLastActiveTime(value) {
  if (!value) {
    return 'vừa xong';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'vừa xong';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function mapProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: textOr(row.full_name || row.username || row.name, 'Người dùng Orbit'),
    avatar: row.avatar_url || DEFAULT_AVATAR_URL,
    avatar_url: row.avatar_url,
    bio: textOr(row.bio, ''),
    status: textOr(row.status, ''),
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
    username: profile.username || null,
    full_name: textOr(profile.name || profile.full_name, 'Người dùng Orbit'),
    avatar_url: profile.avatar_url || profile.avatar || DEFAULT_AVATAR_URL,
    bio: textOr(profile.bio, ''),
    status: textOr(profile.status, 'Mới tham gia Orbit'),
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

  const profile = mapProfileRow(data);

  try {
    const { data: friendRows, count } = await client
      .from('friends')
      .select('friend_id', { count: 'exact' })
      .eq('user_id', userId);

    if (typeof count === 'number') {
      profile.friends = count;
    }

    profile.friendIds = (friendRows || []).map((row) => row.friend_id).filter(Boolean);
  } catch {
    // Friend count can be restricted by RLS; the profile row remains usable.
  }

  return profile;
}

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export async function searchProfilesByName(query, { limit = 8, offset = 0 } = {}) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return [];
  }

  let { data, error } = await client
    .from('profiles')
    .select('*')
    .or(`full_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%`)
    .neq('id', authData.user?.id || '')
    .range(offset, offset + limit - 1);

  if (error && String(error.message || '').toLowerCase().includes('full_name')) {
    const retry = await client
      .from('profiles')
      .select('*')
      .ilike('username', `%${cleanQuery}%`)
      .neq('id', authData.user?.id || '')
      .range(offset, offset + limit - 1);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  return shuffleItems((data || []).map(mapProfileRow).filter(Boolean));
}

export async function updateProfile(userId, updates) {
  const client = requireSupabase();
  const payload = {
    full_name: updates.name || updates.full_name,
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
