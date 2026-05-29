export const ADMIN_REFRESH_MS = 60 * 1000;
export const ONLINE_STALE_MS = 2 * 60 * 1000;

export function getOnlineCutoffIso(now = Date.now()) {
  return new Date(now - ONLINE_STALE_MS).toISOString();
}

export function isRecentlyOnline(isOnline, lastActiveAt, now = Date.now()) {
  if (!isOnline || !lastActiveAt) {
    return false;
  }

  const lastActiveTime = new Date(lastActiveAt).getTime();
  if (Number.isNaN(lastActiveTime)) {
    return false;
  }

  return now - lastActiveTime <= ONLINE_STALE_MS;
}
