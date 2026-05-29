import { getLastDays, toDayKey } from '../utils/date';
import { requireSupabase } from './supabaseClient';

const ADMIN_COLUMNS = 'id,user_id,role,is_active,created_at';
const PROFILE_COLUMNS =
  'id,username,full_name,avatar_url,bio,status,is_online,last_active,created_at,updated_at,account_status,disabled_at,banned_at,deleted_at,moderation_reason,warning_count,last_warned_at,ban_expires_at';
const PROFILE_COLUMNS_SAFE =
  'id,username,full_name,avatar_url,bio,status,is_online,last_active,created_at,updated_at,account_status,disabled_at,banned_at,deleted_at,moderation_reason';
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100;
// Use 'exact' for accurate counts. Change to 'planned' for faster, approximate counts.
const FAST_COUNT_MODE = 'exact';
const AUTO_BAN_AFTER_WARNING_DAYS = 7;

function getSinceDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function bucketByDay(rows, days, label, valueKey) {
  const counts = new Map(getLastDays(days).map((date) => [toDayKey(date), 0]));

  rows.forEach((row) => {
    const key = toDayKey(row.created_at);
    if (counts.has(key)) {
      counts.set(key, counts.get(key) + 1);
    }
  });

  return Array.from(counts.entries()).map(([date, count]) => ({
    date,
    label,
    [valueKey]: count,
  }));
}

async function countRows(table, applyFilters, countMode = FAST_COUNT_MODE) {
  const client = requireSupabase();
  let query = client.from(table).select('*', { count: countMode, head: true });
  if (applyFilters) {
    query = applyFilters(query);
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count || 0;
}

function isMissingWarningColumnError(err) {
  const msg = err?.message || err?.msg || err?.details || '';
  if (typeof msg !== 'string') return false;
  return msg.includes('warning_count') || msg.includes('column "warning_count"') || msg.includes('does not exist');
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isExpoPushToken(value) {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(String(value || ''));
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString();
}

function normalizeBanDays(value, fallback = AUTO_BAN_AFTER_WARNING_DAYS) {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days) || days < 1) {
    return fallback;
  }

  return Math.min(days, 365);
}

async function fetchNotificationPushTokens(client, notification) {
  let query = client
    .from('push_tokens')
    .select('expo_push_token,user_id')
    .eq('is_active', true);

  if (notification.audience === 'user') {
    query = query.eq('user_id', notification.target_user_id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).filter((row) => isExpoPushToken(row.expo_push_token));
}

async function sendExpoPushMessages(messages) {
  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      result?.errors?.[0]?.message ||
      `Expo Push API trả về HTTP ${response.status}`;
    throw new Error(message);
  }

  return Array.isArray(result.data)
    ? result.data
    : result.data
      ? [result.data]
      : [];
}

async function deactivateInvalidPushTokens(client, tokenRows, tickets) {
  const invalidTokens = tickets
    .map((ticket, index) =>
      ticket?.status === 'error' &&
      ticket?.details?.error === 'DeviceNotRegistered'
        ? tokenRows[index]?.expo_push_token
        : null
    )
    .filter(Boolean);

  if (!invalidTokens.length) {
    return;
  }

  await client
    .from('push_tokens')
    .update({
      is_active: false,
      last_error: 'DeviceNotRegistered',
      updated_at: new Date().toISOString(),
    })
    .in('expo_push_token', invalidTokens);
}

async function deliverNotificationPush(client, notification) {
  if (notification.status !== 'sent') {
    return { status: 'scheduled', sent: 0, failed: 0 };
  }

  const tokenRows = await fetchNotificationPushTokens(client, notification);
  if (!tokenRows.length) {
    return {
      status: 'skipped',
      sent: 0,
      failed: 0,
      message: 'Chưa có thiết bị nào đăng ký nhận push.',
    };
  }

  const messages = tokenRows.map((row) => ({
    to: row.expo_push_token,
    sound: 'default',
    channelId: 'orbit-default',
    title: notification.title,
    body: notification.body,
    data: {
      notificationId: notification.id,
      audience: notification.audience,
      targetUserId: notification.target_user_id,
      screen: 'Notifications',
    },
  }));

  const tickets = [];
  const tokenChunks = chunkItems(tokenRows, EXPO_PUSH_BATCH_SIZE);
  const messageChunks = chunkItems(messages, EXPO_PUSH_BATCH_SIZE);

  for (let index = 0; index < messageChunks.length; index += 1) {
    const chunkTickets = await sendExpoPushMessages(messageChunks[index]);
    tickets.push(...chunkTickets);
    await deactivateInvalidPushTokens(client, tokenChunks[index], chunkTickets);
  }

  const failed = tickets.filter((ticket) => ticket?.status === 'error').length;
  const sent = tickets.filter((ticket) => ticket?.status === 'ok').length;
  const firstError = tickets.find((ticket) => ticket?.status === 'error');

  return {
    status: failed && !sent ? 'failed' : 'sent',
    sent,
    failed,
    message: firstError?.message || null,
  };
}

export async function getAdminMembership(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('admin_users')
    .select(ADMIN_COLUMNS)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDashboardStats() {
  const client = requireSupabase();
  const activeSince = getSinceDate(1);
  const chartSince = getSinceDate(13);

  let [
    totalUsers,
    activeUsers,
    totalFriendRequests,
    totalFriendships,
    totalMessages,
    totalReports,
    onlineUsers,
    recentRegistrations,
    recentProfiles,
    recentReports,
    chartProfiles,
    chartMessages,
  ] = await Promise.all([
    countRows('profiles'),
    countRows('profiles', (query) => query.gte('last_active', activeSince)),
    countRows('friend_requests'),
    countRows('friends'),
    countRows('messages'),
    countRows('reports'),
    countRows('profiles', (query) => query.eq('is_online', true)),
    countRows('profiles', (query) => query.gte('created_at', getSinceDate(7))),
    client
      .from('profiles')
      .select(PROFILE_COLUMNS_SAFE)
      .order('created_at', { ascending: false })
      .limit(8),
    client
      .from('reports')
      .select(
        'id,reason,status,created_at,reporter:profiles!reports_reporter_id_fkey(id,username,full_name,avatar_url),target:profiles!reports_target_user_id_fkey(id,username,full_name,avatar_url)'
      )
      .order('created_at', { ascending: false })
      .limit(8),
    client
      .from('profiles')
      .select('created_at')
      .gte('created_at', chartSince)
      .limit(3000),
    client
      .from('messages')
      .select('created_at')
      .gte('created_at', chartSince)
      .limit(3000),
  ]);

  // If recentProfiles failed due to missing migration columns (warning_count),
  // retry with a safe column list so the dashboard still renders.
  if (recentProfiles && recentProfiles.error) {
    if (isMissingWarningColumnError(recentProfiles.error)) {
      const retry = await client
        .from('profiles')
        .select(PROFILE_COLUMNS_SAFE)
        .order('created_at', { ascending: false })
        .limit(8);
      if (retry.error) {
        throw retry.error;
      }
      recentProfiles = retry;
    } else {
      throw recentProfiles.error;
    }
  }

  [recentReports, chartProfiles, chartMessages].forEach((result) => {
    if (result.error) {
      throw result.error;
    }
  });

  const registrationBuckets = bucketByDay(
    chartProfiles.data || [],
    14,
    'Users',
    'users'
  );
  const messageBuckets = bucketByDay(
    chartMessages.data || [],
    14,
    'Messages',
    'messages'
  );
  const messageByDate = new Map(
    messageBuckets.map((item) => [item.date, item.messages])
  );

  return {
    cards: {
      totalUsers,
      activeUsers,
      totalFriendRequests,
      totalFriendships,
      totalMessages,
      totalReports,
      onlineUsers,
      recentRegistrations,
    },
    chartData: registrationBuckets.map((item) => ({
      date: item.date,
      users: item.users,
      messages: messageByDate.get(item.date) || 0,
    })),
    recentUsers: recentProfiles.data || [],
    recentReports: recentReports.data || [],
  };
}

export async function getUsers({
  search = '',
  status = 'all',
  online = 'all',
  page = 1,
  pageSize = 10,
}) {
  const client = requireSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = client
    .from('profiles')
    .select(PROFILE_COLUMNS_SAFE, { count: FAST_COUNT_MODE })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search.trim()) {
    const safeSearch = search
      .trim()
      .replaceAll('%', '\\%')
      .replaceAll(',', ' ');
    query = query.or(
      `username.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%`
    );
  }

  if (status !== 'all') {
    query = query.eq('account_status', status);
  }

  if (online !== 'all') {
    query = query.eq('is_online', online === 'online');
  }

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  const ids = (data || []).map((profile) => profile.id);
  let locationByUser = {};
  if (ids.length) {
    const { data: locations, error: locationError } = await client
      .from('locations')
      .select('user_id,is_visible,is_approximate,updated_at')
      .in('user_id', ids);

    if (locationError) {
      throw locationError;
    }

    locationByUser = (locations || []).reduce((items, location) => {
      items[location.user_id] = location;
      return items;
    }, {});
  }

  return {
    rows: (data || []).map((profile) => ({
      ...profile,
      location: locationByUser[profile.id] || null,
      ghost_mode: locationByUser[profile.id]
        ? locationByUser[profile.id].is_visible === false
        : false,
    })),
    total: count || 0,
  };
}

async function sendModerationNotification(profile, action, payload) {
  const name = profile.full_name || profile.username || 'bạn';
  const messages = {
    warn: {
      title: 'Cảnh cáo từ Orbit',
      body:
        payload.warning_count >= 2
          ? `${name}, tài khoản của bạn đã bị ban tạm thời ${AUTO_BAN_AFTER_WARNING_DAYS} ngày vì tiếp tục vi phạm sau cảnh cáo.`
          : `${name}, tài khoản của bạn đã nhận cảnh cáo. Nếu tiếp tục vi phạm, tài khoản sẽ bị ban tạm thời.`,
    },
    ban: {
      title: 'Tài khoản Orbit bị ban tạm thời',
      body: `Tài khoản của bạn đã bị ban ${payload.ban_days} ngày. Lý do: ${payload.reason || 'Vi phạm quy định cộng đồng.'}`,
    },
    unban: {
      title: 'Tài khoản Orbit đã được mở ban',
      body: 'Tài khoản của bạn đã được mở ban và có thể sử dụng lại Orbit.',
    },
  };

  const message = messages[action];
  if (!message) {
    return;
  }

  await createNotification({
    audience: 'user',
    targetUserId: profile.id,
    title: message.title,
    body: message.body,
  }).catch(() => {});
}

export async function updateUserModeration(userId, action, options = {}) {
  const client = requireSupabase();
  const now = new Date().toISOString();
  const normalizedOptions =
    typeof options === 'string' ? { reason: options } : options || {};
  const trimmedReason = normalizedOptions.reason?.trim() || null;
  const banDays = normalizeBanDays(normalizedOptions.banDays);
  let { data: currentProfile, error: currentProfileError } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  if (currentProfileError && isMissingWarningColumnError(currentProfileError)) {
    const retry = await client
      .from('profiles')
      .select(PROFILE_COLUMNS_SAFE)
      .eq('id', userId)
      .single();
    currentProfile = retry.data;
    currentProfileError = retry.error;
  }

  if (currentProfileError) {
    throw currentProfileError;
  }

  const warningCount = Number(currentProfile.warning_count || 0);
  const nextWarningCount = warningCount + 1;
  const warningShouldBan = warningCount >= 1;
  const actionPayloads = {
    warn: warningShouldBan
      ? {
          account_status: 'banned',
          banned_at: now,
          ban_expires_at: addDays(now, AUTO_BAN_AFTER_WARNING_DAYS),
          warning_count: nextWarningCount,
          last_warned_at: now,
          moderation_reason:
            trimmedReason ||
            `Tự động ban ${AUTO_BAN_AFTER_WARNING_DAYS} ngày sau cảnh cáo lần ${nextWarningCount}.`,
        }
      : {
          warning_count: nextWarningCount,
          last_warned_at: now,
          moderation_reason:
            trimmedReason ||
            'Cảnh cáo lần 1. Nếu tiếp tục vi phạm sẽ bị ban tạm thời.',
        },
    disable: {
      account_status: 'disabled',
      disabled_at: now,
      moderation_reason: trimmedReason,
    },
    enable: {
      account_status: 'active',
      disabled_at: null,
      deleted_at: null,
      moderation_reason: trimmedReason,
    },
    soft_delete: {
      account_status: 'deleted',
      deleted_at: now,
      moderation_reason: trimmedReason,
    },
    ban: {
      account_status: 'banned',
      banned_at: now,
      ban_expires_at: addDays(now, banDays),
      moderation_reason: trimmedReason,
    },
    unban: {
      account_status: 'active',
      banned_at: null,
      ban_expires_at: null,
      moderation_reason: trimmedReason,
    },
  };

  const payload = actionPayloads[action];
  if (!payload) {
    throw new Error(`Thao tác kiểm duyệt không được hỗ trợ: ${action}`);
  }

  const { data, error } = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  await sendModerationNotification(data, action, {
    reason: trimmedReason,
    ban_days:
      action === 'warn' && warningShouldBan
        ? AUTO_BAN_AFTER_WARNING_DAYS
        : banDays,
    warning_count: nextWarningCount,
  });

  return data;
}

export async function getReports({
  status = 'pending',
  page = 1,
  pageSize = 12,
} = {}) {
  const client = requireSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = client
    .from('reports')
    .select(
      'id,reporter_id,target_user_id,reason,description,status,created_at,resolved_by,resolved_at,admin_notes,reporter:profiles!reports_reporter_id_fkey(id,username,full_name,avatar_url),target:profiles!reports_target_user_id_fkey(id,username,full_name,avatar_url)',
      { count: FAST_COUNT_MODE }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  return { rows: data || [], total: count || 0 };
}

export async function updateReport(reportId, payload) {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw userError;
  }

  const updatePayload = {
    ...payload,
    resolved_by: userData.user?.id || null,
    resolved_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('reports')
    .update(updatePayload)
    .eq('id', reportId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function warnUser(targetUserId, reportId, notes) {
  const moderatedProfile = await updateUserModeration(targetUserId, 'warn', {
    reason:
      notes ||
      'Kiểm duyệt viên Orbit đã xem xét một báo cáo liên quan đến tài khoản của bạn.',
    audience: 'user',
    targetUserId,
    title: 'Thông báo kiểm duyệt từ Orbit',
    body:
      notes ||
      'Kiểm duyệt viên Orbit đã xem xét một báo cáo liên quan đến tài khoản của bạn.',
  });

  if (reportId) {
    return updateReport(reportId, {
      status:
        moderatedProfile.account_status === 'banned' ? 'suspended' : 'warned',
      admin_notes: notes || null,
    });
  }

  return true;
}

export async function suspendUser(targetUserId, reportId, notes) {
  await updateUserModeration(
    targetUserId,
    'disable',
    notes || 'Tài khoản bị đình chỉ sau khi kiểm duyệt.'
  );

  if (reportId) {
    return updateReport(reportId, {
      status: 'suspended',
      admin_notes: notes || null,
    });
  }

  return true;
}

export async function getFeedbacks({
  type = 'all',
  status = 'open',
  page = 1,
  pageSize = 12,
} = {}) {
  const client = requireSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = client
    .from('feedbacks')
    .select(
      'id,user_id,type,title,message,status,admin_notes,created_at,resolved_by,resolved_at,user:profiles!feedbacks_user_id_fkey(id,username,full_name,avatar_url)',
      { count: FAST_COUNT_MODE }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (type !== 'all') {
    query = query.eq('type', type);
  }

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  return { rows: data || [], total: count || 0 };
}

export async function updateFeedback(feedbackId, payload) {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw userError;
  }

  const updatePayload = {
    ...payload,
    resolved_by:
      payload.status === 'resolved' ? userData.user?.id || null : null,
    resolved_at:
      payload.status === 'resolved' ? new Date().toISOString() : null,
  };

  const { data, error } = await client
    .from('feedbacks')
    .update(updatePayload)
    .eq('id', feedbackId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getNotifications({ page = 1, pageSize = 12 } = {}) {
  const client = requireSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await client
    .from('notifications')
    .select(
      'id,audience,target_user_id,title,body,status,scheduled_at,sent_at,created_by,created_at,target:profiles!notifications_target_user_id_fkey(id,username,full_name,avatar_url)',
      { count: FAST_COUNT_MODE }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return { rows: data || [], total: count || 0 };
}

export async function createNotification({
  audience,
  targetUserId,
  title,
  body,
  scheduledAt,
}) {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    throw userError;
  }

  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const shouldSchedule = Boolean(
    scheduledDate && scheduledDate.getTime() > Date.now()
  );
  const payload = {
    audience,
    target_user_id: audience === 'user' ? targetUserId : null,
    title: title.trim(),
    body: body.trim(),
    status: shouldSchedule ? 'scheduled' : 'sent',
    scheduled_at: shouldSchedule ? scheduledDate.toISOString() : null,
    sent_at: shouldSchedule ? null : new Date().toISOString(),
    created_by: userData.user?.id || null,
  };

  const { data, error } = await client
    .from('notifications')
    .insert(payload)
    .select()
    .single();
  if (error) {
    throw error;
  }

  let pushDelivery = { status: 'skipped', sent: 0, failed: 0 };
  try {
    pushDelivery = await deliverNotificationPush(client, data);
  } catch (caughtError) {
    pushDelivery = {
      status: 'failed',
      sent: 0,
      failed: 0,
      message: caughtError.message,
    };
  }

  return { ...data, pushDelivery };
}

export async function sendNotificationNow(notificationId) {
  const client = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('notifications')
    .update({
      status: 'sent',
      scheduled_at: null,
      sent_at: now,
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  let pushDelivery = { status: 'skipped', sent: 0, failed: 0 };
  try {
    pushDelivery = await deliverNotificationPush(client, data);
  } catch (caughtError) {
    pushDelivery = {
      status: 'failed',
      sent: 0,
      failed: 0,
      message: caughtError.message,
    };
  }

  return { ...data, pushDelivery };
}
