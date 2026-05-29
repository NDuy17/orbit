import { requireSupabase, supabase } from './supabase';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getNotificationTimestamp(notification) {
  const value =
    notification?.updated_at || notification?.sent_at || notification?.created_at;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isFriendRequestNotification(notification) {
  const text = normalizeText(
    `${notification?.title || ''} ${notification?.body || ''}`
  );
  return (
    text.includes('ket ban') &&
    (text.includes('loi moi') || text.includes('moi ket ban'))
  );
}

async function fetchStoredNotifications(client, userId, limit) {
  const { data, error } = await client
    .from('notifications')
    .select(
      'id,audience,target_user_id,title,body,status,scheduled_at,sent_at,created_at,updated_at,created_by'
    )
    .eq('status', 'sent')
    .or(`audience.eq.all,target_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || [])
    .filter(
      (notification) =>
        notification.audience === 'all' ||
        notification.target_user_id === userId
    )
    .map((notification) => ({
      ...notification,
      kind: isFriendRequestNotification(notification)
        ? 'friend_request'
        : 'notification',
      sender_id: notification.created_by,
    }));
}

async function fetchFriendRequestNotifications(client, userId) {
  const { data, error } = await client
    .from('friend_requests')
    .select('id,sender_id,receiver_id,status,created_at')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return [];
  }

  const senderIds = [...new Set((data || []).map((request) => request.sender_id))];
  const { data: profiles } = senderIds.length
    ? await client
        .from('profiles')
        .select('id,username,full_name,avatar_url')
        .in('id', senderIds)
    : { data: [] };
  const profileMap = (profiles || []).reduce((items, profile) => {
    items[profile.id] = profile;
    return items;
  }, {});

  return (data || []).map((request) => {
    const sender = profileMap[request.sender_id] || {};
    const senderName =
      sender.full_name || sender.username || 'Người dùng Orbit';

    return {
      id: `friend-request-${request.id}`,
      kind: 'friend_request',
      request_id: request.id,
      sender_id: request.sender_id,
      audience: 'user',
      target_user_id: request.receiver_id,
      title: 'Lời mời kết bạn mới',
      body: `${senderName} đã gửi lời mời kết bạn cho bạn.`,
      status: 'sent',
      sent_at: request.created_at,
      created_at: request.created_at,
      updated_at: request.created_at,
    };
  });
}

export async function fetchUserNotifications({ limit = 30 } = {}) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('Bạn cần đăng nhập để xem thông báo.');
  }

  const storedNotifications = await fetchStoredNotifications(
    client,
    userId,
    limit
  );
  const storedFriendRequestSenderIds = new Set(
    storedNotifications
      .filter((notification) => notification.kind === 'friend_request')
      .map((notification) => notification.sender_id)
      .filter(Boolean)
  );
  const friendRequestNotifications = (
    await fetchFriendRequestNotifications(client, userId)
  ).filter(
    (notification) => !storedFriendRequestSenderIds.has(notification.sender_id)
  );

  return [...friendRequestNotifications, ...storedNotifications]
    .sort(
      (first, second) =>
        getNotificationTimestamp(second) - getNotificationTimestamp(first)
    )
    .slice(0, limit);
}

export function subscribeToNotifications(onChange, userId) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase.channel(
    `notifications:user:${userId || 'current'}`
  );

  if (userId) {
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: 'audience=eq.all',
        },
        onChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `target_user_id=eq.${userId}`,
        },
        onChange
      );
  } else {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      onChange
    );
  }

  channel.subscribe();

  return () => supabase.removeChannel(channel);
}
