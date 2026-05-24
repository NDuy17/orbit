const DAY_MS = 24 * 60 * 60 * 1000;

function getDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatLastActive(user) {
  if (!user) {
    return 'Vừa hoạt động';
  }

  if (user.isOnline) {
    return 'Đang online';
  }

  const lastActiveDate = getDate(user.lastActiveAt || user.last_active);
  if (!lastActiveDate) {
    return user.lastActive || 'Vừa hoạt động';
  }

  const elapsedMs = Date.now() - lastActiveDate.getTime();
  if (elapsedMs >= DAY_MS) {
    return `Online ${Math.floor(elapsedMs / DAY_MS)} ngày trước`;
  }

  return `Hoạt động lúc ${formatTime(lastActiveDate)}`;
}
