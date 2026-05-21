import { requireSupabase, supabase } from './supabase';

// These queries use the anon key only. Supabase RLS should allow users to read
// and mutate only their own friend_requests/friends rows.
async function getCurrentUserId(client) {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user?.id;
}

async function fetchProfilesByIds(client, ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];

  if (!uniqueIds.length) {
    return {};
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, status, is_online, last_active')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return (data || []).reduce((items, profile) => {
    items[profile.id] = profile;
    return items;
  }, {});
}

async function addFriendRowIfMissing(client, userId, friendId) {
  const { data: existingRows, error: selectError } = await client
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  if (existingRows?.length) {
    return existingRows[0];
  }

  const { data, error } = await client
    .from('friends')
    .insert({ user_id: userId, friend_id: friendId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function addFriendPair(client, firstUserId, secondUserId) {
  await addFriendRowIfMissing(client, firstUserId, secondUserId);
  await addFriendRowIfMissing(client, secondUserId, firstUserId);
}

export async function fetchFriendshipSnapshot() {
  const client = requireSupabase();
  const userId = await getCurrentUserId(client);

  if (!userId) {
    return { friends: [], pendingRequests: [], sentRequests: [] };
  }

  const { data: friendRows, error: friendError } = await client
    .from('friends')
    .select('*')
    .eq('user_id', userId);

  if (friendError) {
    throw friendError;
  }

  const { data: requestRows, error: requestError } = await client
    .from('friend_requests')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (requestError) {
    throw requestError;
  }

  const profileMap = await fetchProfilesByIds(client, [
    ...(friendRows || []).map((row) => row.friend_id),
    ...(requestRows || []).map((row) => row.sender_id),
    ...(requestRows || []).map((row) => row.receiver_id),
  ]);

  const friendIdSet = new Set((friendRows || []).map((row) => row.friend_id));

  const friends = [...friendIdSet]
    .map((friendId) => profileMap[friendId])
    .filter(Boolean);

  const pendingRequests = (requestRows || [])
    .filter((request) => request.receiver_id === userId && !friendIdSet.has(request.sender_id))
    .map((request) => ({
      ...request,
      sender: profileMap[request.sender_id] || null,
    }));

  const sentRequests = (requestRows || [])
    .filter((request) => request.sender_id === userId && !friendIdSet.has(request.receiver_id))
    .map((request) => ({
      ...request,
      receiver: profileMap[request.receiver_id] || null,
    }));

  return { friends, pendingRequests, sentRequests };
}

export async function sendFriendRequest(receiverId) {
  const client = requireSupabase();
  const userId = await getCurrentUserId(client);

  if (!userId || !receiverId || userId === receiverId) {
    throw new Error('Không thể gửi lời mời kết bạn.');
  }

  const { data: existingFriends, error: friendError } = await client
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', receiverId)
    .limit(1);

  if (friendError) {
    throw friendError;
  }

  if (existingFriends?.length) {
    return { type: 'friends', data: existingFriends[0] };
  }

  const { data: existingRequests, error: requestError } = await client
    .from('friend_requests')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (requestError) {
    throw requestError;
  }

  if (existingRequests?.length) {
    return { type: 'pending', data: existingRequests[0] };
  }

  const { data, error } = await client
    .from('friend_requests')
    .insert({
      sender_id: userId,
      receiver_id: receiverId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { type: 'pending', data };
}

export async function acceptFriendRequest(requestId) {
  const client = requireSupabase();
  const userId = await getCurrentUserId(client);

  if (!userId) {
    throw new Error('Bạn cần đăng nhập để chấp nhận lời mời.');
  }

  const { data: request, error: requestError } = await client
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('receiver_id', userId)
    .select()
    .single();

  if (requestError) {
    throw requestError;
  }

  await addFriendPair(client, request.sender_id, request.receiver_id);

  return request;
}

export async function rejectFriendRequest(requestId) {
  const client = requireSupabase();
  const userId = await getCurrentUserId(client);

  const { data, error } = await client
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('receiver_id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchFriends() {
  const snapshot = await fetchFriendshipSnapshot();
  return snapshot.friends;
}

export async function fetchPendingRequests() {
  const snapshot = await fetchFriendshipSnapshot();
  return snapshot.pendingRequests;
}

export function subscribeToFriendRequests(onChange) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('friend_requests:orbit')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToFriends(onChange) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('friends:orbit')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
