import { textOr } from './text';

const ACTIVE_STATUS = 'active';

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function isActiveAccount(profile) {
  return (profile?.accountStatus || ACTIVE_STATUS) === ACTIVE_STATUS;
}

export function getAccountRestriction(profile) {
  const status = profile?.accountStatus || ACTIVE_STATUS;
  if (status === ACTIVE_STATUS) {
    return null;
  }

  const reason = textOr(profile?.moderationReason, '');
  const until = formatDateTime(profile?.banExpiresAt);
  const suffix = reason ? ` Lý do: ${reason}` : '';

  if (status === 'banned') {
    return {
      status,
      title: 'Tài khoản đang bị cấm',
      message: until
        ? `Tài khoản của bạn bị cấm tạm thời đến ${until}.${suffix}`
        : `Tài khoản của bạn đang bị cấm tạm thời.${suffix}`,
    };
  }

  if (status === 'disabled') {
    return {
      status,
      title: 'Tài khoản đã bị vô hiệu',
      message: `Tài khoản của bạn đã bị vô hiệu bởi đội ngũ Orbit.${suffix}`,
    };
  }

  if (status === 'deleted') {
    return {
      status,
      title: 'Tài khoản đã bị xóa mềm',
      message: `Tài khoản của bạn đang ở trạng thái xóa mềm và không thể dùng Orbit.${suffix}`,
    };
  }

  return {
    status,
    title: 'Tài khoản bị giới hạn',
    message: `Tài khoản của bạn không thể dùng Orbit lúc này.${suffix}`,
  };
}
