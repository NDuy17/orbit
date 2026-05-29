import { requireSupabase } from './supabase';

export async function fetchCurrentAdminMembership() {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    return null;
  }

  const { data, error } = await client
    .from('admin_users')
    .select('id,user_id,role,is_active')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
