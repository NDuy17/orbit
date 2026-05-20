export function formatLastActive(user) {
  if (user.isOnline) {
    return 'Đang online';
  }

  return user.lastActive || 'Vừa hoạt động';
}
