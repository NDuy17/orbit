import { requireSupabase } from './supabase';

export async function sendFriendRequest(receiverId) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user.id;

  const { data: existingFriend, error: friendError } = await client
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', receiverId)
    .maybeSingle();

  if (friendError) {
    throw friendError;
  }

  if (existingFriend) {
    return existingFriend;
  }

  const { data: existingRequest, error: requestError } = await client
    .from('friend_requests')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`
    )
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (requestError) {
    throw requestError;
  }

  if (existingRequest) {
    return existingRequest;
  }

  const { data, error } = await client
    .from('friend_requests')
    .upsert({
      sender_id: userId,
      receiver_id: receiverId,
      status: 'pending',
    }, { onConflict: 'sender_id,receiver_id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function acceptFriendRequest(requestId) {
  const client = requireSupabase();
  const { data: request, error: requestError } = await client
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .select()
    .single();

  if (requestError) {
    throw requestError;
  }

  const { data, error } = await client
    .from('friends')
    .upsert(
      [
        {
          user_id: request.sender_id,
          friend_id: request.receiver_id,
        },
        {
          user_id: request.receiver_id,
          friend_id: request.sender_id,
        },
      ],
      { onConflict: 'user_id,friend_id' }
    )
    .select()
    ;

  if (error) {
    throw error;
  }

  return data;
}

export async function rejectFriendRequest(requestId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchPendingRequests() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const { data, error } = await client
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', authData.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const senderIds = (data || []).map((item) => item.sender_id);

  if (!senderIds.length) {
    return [];
  }

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id, name, full_name, avatar_url, bio, status, is_online, last_active')
    .in('id', senderIds);

  if (profileError) {
    throw profileError;
  }

  const profileMap = (profiles || []).reduce((items, profile) => {
    items[profile.id] = profile;
    return items;
  }, {});

  return (data || []).map((request) => ({
    ...request,
    sender: profileMap[request.sender_id] || null,
  }));
}

export async function fetchFriends() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const { data, error } = await client
    .from('friends')
    .select('*')
    .eq('user_id', authData.user.id);

  if (error) {
    throw error;
  }

  const friendIds = (data || []).map((item) => item.friend_id);

  if (!friendIds.length) {
    return [];
  }

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id, name, full_name, avatar_url, bio, status, is_online, last_active')
    .in('id', friendIds);

  if (profileError) {
    throw profileError;
  }

  return profiles || [];
}
