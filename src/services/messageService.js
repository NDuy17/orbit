import { requireSupabase, supabase } from './supabase';
import { mapProfileRow } from './profileService.js';

export async function fetchMessagesWithUser(otherUserId) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user.id;
  const { data, error } = await client
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function sendMessage(receiverId, text) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const { data, error } = await client
    .from('messages')
    .insert({
      sender_id: authData.user.id,
      receiver_id: receiverId,
      text,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchRecentConversations(limit = 30) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user?.id;
  if (!userId) {
    return [];
  }

  const { data, error } = await client
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const latestByUser = new Map();
  (data || []).forEach((message) => {
    const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
    if (otherUserId && !latestByUser.has(otherUserId)) {
      latestByUser.set(otherUserId, message);
    }
  });

  const otherUserIds = Array.from(latestByUser.keys());
  if (!otherUserIds.length) {
    return [];
  }

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('*')
    .in('id', otherUserIds);

  if (profileError) {
    throw profileError;
  }

  const profileMap = (profiles || []).reduce((items, profile) => {
    items[profile.id] = mapProfileRow(profile);
    return items;
  }, {});

  return otherUserIds
    .map((otherUserId) => {
      const message = latestByUser.get(otherUserId);
      const profile = profileMap[otherUserId];
      if (!profile) {
        return null;
      }

      return {
        ...profile,
        lastMessage: message.text,
        lastMessageAt: message.created_at,
        lastMessageTime: message.created_at
          ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
        isMine: message.sender_id === userId,
      };
    })
    .filter(Boolean);
}

export async function fetchIncomingMessages(limit = 500) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user?.id;
  if (!userId) {
    return [];
  }

  const { data, error } = await client
    .from('messages')
    .select('id,sender_id,receiver_id,created_at')
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

export function subscribeToMessages(otherUserId, currentUserId, onMessage) {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`messages:${currentUserId}:${otherUserId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      onMessage(payload.new);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToAllMessages(currentUserId, onMessage) {
  if (!supabase || !currentUserId) {
    return () => {};
  }

  const channel = supabase
    .channel(`messages:recent:${currentUserId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new;
      if (row?.sender_id === currentUserId || row?.receiver_id === currentUserId) {
        onMessage(row);
      }
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}
