export function formatDate(value, options = {}) {
  if (!value) {
    return 'Chưa có';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Ngày không hợp lệ';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short',
  }).format(date);
}

export function formatRelativeTime(value) {
  if (!value) {
    return 'Chưa có';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Ngày không hợp lệ';
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return new Intl.RelativeTimeFormat('vi-VN', { numeric: 'auto' }).format(
        Math.round(diffSeconds / seconds),
        unit
      );
    }
  }

  return 'Vừa xong';
}

export function getLastDays(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - index));
    return date;
  });
}

export function toDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}
