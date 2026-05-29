import DEFAULT_AVATAR_URL from '../constants/defaultAvatar';
import { isRecentlyOnline } from '../utils/presence';
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

  const isOnline = isRecentlyOnline(row.is_online, row.last_active);

  return {
    id: row.id,
    name: textOr(row.full_name || row.username || row.name, 'Người dùng Orbit'),
    avatar: row.avatar_url || DEFAULT_AVATAR_URL,
    avatar_url: row.avatar_url,
    bio: textOr(row.bio, ''),
    status: textOr(row.status, ''),
    isOnline,
    lastActiveAt: row.last_active,
    lastActive: isOnline
      ? 'Đang online'
      : `Hoạt động lúc ${formatLastActiveTime(row.last_active)}`,
    friends: row.friends_count || 0,
    met: row.encounters_count || 0,
    recent: row.recent_count || 0,
    accountStatus: row.account_status || 'active',
    disabledAt: row.disabled_at || null,
    bannedAt: row.banned_at || null,
    deletedAt: row.deleted_at || null,
    moderationReason: textOr(row.moderation_reason, ''),
    banExpiresAt: row.ban_expires_at || null,
  };
}

export async function createProfile(userId, profile, options = {}) {
  const client = requireSupabase();
  const isOnline = Boolean(options.isOnline);
  const payload = {
    id: userId,
    username: profile.username || null,
    full_name: textOr(profile.name || profile.full_name, 'Người dùng Orbit'),
    avatar_url: profile.avatar_url || profile.avatar || DEFAULT_AVATAR_URL,
    bio: textOr(profile.bio, ''),
    status: textOr(profile.status, 'Mới tham gia Orbit'),
    is_online: isOnline,
    last_active: new Date().toISOString(),
  };

  const { error } = await client.from('profiles').insert(payload);

  if (!error) {
    return mapProfileRow(payload);
  }

  if (error.code !== '23505') {
    throw error;
  }

  const { error: updateError } = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (updateError) {
    throw updateError;
  }

  return mapProfileRow(payload);
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
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

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

    profile.friendIds = (friendRows || [])
      .map((row) => row.friend_id)
      .filter(Boolean);
  } catch {
    // Friend count can be restricted by RLS; the profile row remains usable.
  }

  return profile;
}

function mergeProfileRows(rows) {
  const items = new Map();
  rows.forEach((row) => {
    if (row?.id && !items.has(row.id)) {
      items.set(row.id, row);
    }
  });
  return Array.from(items.values());
}

export async function searchProfilesByName(
  query,
  { limit = 8, offset = 0 } = {}
) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return [];
  }

  const prefixQuery = `${cleanQuery}%`;
  const wordPrefixQuery = `% ${cleanQuery}%`;
  const fetchLimit = offset + limit;
  const currentUserId = authData.user?.id || '';
  const rows = [];

  const usernameQuery = await client
    .from('profiles')
    .select('*')
    .ilike('username', prefixQuery)
    .neq('id', currentUserId)
    .range(0, fetchLimit - 1);

  if (usernameQuery.error) {
    throw usernameQuery.error;
  }

  rows.push(...(usernameQuery.data || []));

  const fullNameQueries = await Promise.all([
    client
      .from('profiles')
      .select('*')
      .ilike('full_name', prefixQuery)
      .neq('id', currentUserId)
      .range(0, fetchLimit - 1),
    client
      .from('profiles')
      .select('*')
      .ilike('full_name', wordPrefixQuery)
      .neq('id', currentUserId)
      .range(0, fetchLimit - 1),
  ]);

  fullNameQueries.forEach((result) => {
    if (!result.error) {
      rows.push(...(result.data || []));
    }
  });

  return mergeProfileRows(rows)
    .slice(offset, offset + limit)
    .map(mapProfileRow)
    .filter(Boolean);
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

  const { data, error } = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

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
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles' },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
