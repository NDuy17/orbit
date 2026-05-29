export const ADMIN_ROLES = ['super_admin', 'admin', 'moderator'];

export function roleLabel(role) {
  const labels = {
    super_admin: 'Quản trị tối cao',
    admin: 'Quản trị viên',
    moderator: 'Kiểm duyệt viên',
  };

  return labels[role] || 'Không rõ quyền';
}

export function canManageUsers(role) {
  return role === 'super_admin' || role === 'admin';
}

export function canResolveReports(role) {
  return ADMIN_ROLES.includes(role);
}

export function canSendNotifications(role) {
  return role === 'super_admin' || role === 'admin';
}
