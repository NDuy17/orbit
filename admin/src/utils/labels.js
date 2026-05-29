const labels = {
  active: 'Hoạt động',
  disabled: 'Đã vô hiệu',
  banned: 'Đã cấm',
  deleted: 'Đã xóa mềm',
  pending: 'Đang chờ',
  resolved: 'Đã xử lý',
  rejected: 'Đã từ chối',
  warned: 'Đã cảnh báo',
  suspended: 'Đã đình chỉ',
  open: 'Đang mở',
  sent: 'Đã gửi',
  scheduled: 'Đã lên lịch',
  draft: 'Bản nháp',
  cancelled: 'Đã hủy',
  all: 'Tất cả',
  user: 'Một người dùng',
  bug: 'Lỗi',
  feature: 'Tính năng',
  safety: 'An toàn',
  general: 'Chung',
  online: 'Đang online',
  offline: 'Offline',
};

export function labelFor(value, fallback = 'Không rõ') {
  if (!value) {
    return fallback;
  }

  return labels[String(value).toLowerCase()] || value;
}
