import { requireSupabase } from './supabase';

export async function submitUserReport({ targetUserId, reason, description = '' }) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  const reporterId = authData.user?.id;
  if (!reporterId) {
    throw new Error('Bạn cần đăng nhập để gửi báo cáo.');
  }

  if (!targetUserId) {
    throw new Error('Thiếu người dùng cần báo cáo.');
  }

  if (targetUserId === reporterId) {
    throw new Error('Bạn không thể tự báo cáo chính mình.');
  }

  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new Error('Vui lòng chọn lý do báo cáo.');
  }

  const { data, error } = await client
    .from('reports')
    .insert({
      reporter_id: reporterId,
      target_user_id: targetUserId,
      reason: cleanReason,
      description: String(description || '').trim() || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
