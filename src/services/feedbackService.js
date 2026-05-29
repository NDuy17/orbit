import { requireSupabase } from './supabase';

export async function submitFeedback({ type = 'general', title = '', message }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('Bạn cần đăng nhập để gửi góp ý.');
  }

  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    throw new Error('Vui lòng nhập nội dung góp ý.');
  }

  const { data, error } = await client
    .from('feedbacks')
    .insert({
      user_id: userId,
      type,
      title: String(title || '').trim() || null,
      message: cleanMessage,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
