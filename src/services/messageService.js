import { requireSupabase, supabase } from './supabase';

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
