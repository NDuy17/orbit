export function getVietnameseErrorMessage(message) {
  if (!message) {
    return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }

  const text = String(message).toLowerCase();

  if (text.includes('location_permission_denied') || text.includes('permission')) {
    return 'Orbit cần quyền vị trí để hiển thị bạn trên bản đồ. Hãy bật quyền rồi thử lại.';
  }

  if (text.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu chưa đúng.';
  }

  if (text.includes('email not confirmed')) {
    return 'Bạn cần xác nhận email trước khi đăng nhập.';
  }

  if (text.includes('signup') && text.includes('disabled')) {
    return 'Supabase đang tắt đăng ký tài khoản.';
  }

  if (text.includes('provider') && text.includes('email')) {
    return 'Supabase chưa bật đăng ký bằng email.';
  }

  if (text.includes('user already registered') || text.includes('already registered')) {
    return 'Email này đã được dùng để đăng ký.';
  }

  if (text.includes('rate limit') || text.includes('security purposes') || (text.includes('after') && text.includes('seconds'))) {
    return 'Supabase đang chặn tạm do bảo mật. Chờ một chút hoặc tắt xác nhận email khi test.';
  }

  if (text.includes('confirmation') && text.includes('email')) {
    return 'Supabase chưa gửi được email xác nhận. Hãy kiểm tra cấu hình Auth Email.';
  }

  if (text.includes('relation') && text.includes('profiles')) {
    return 'Chưa tạo bảng profiles trong Supabase.';
  }

  if (text.includes('password') && (text.includes('six') || text.includes('6'))) {
    return 'Mật khẩu cần ít nhất 6 ký tự.';
  }

  if (text.includes('password')) {
    return 'Mật khẩu chưa hợp lệ.';
  }

  if (text.includes('invalid') && text.includes('email')) {
    return 'Supabase không nhận email này. Hãy thử một email thật khác.';
  }

  if (text.includes('email')) {
    return 'Có lỗi liên quan đến email. Hãy kiểm tra email hoặc cấu hình Auth trong Supabase.';
  }

  if (text.includes('network') || text.includes('fetch')) {
    return 'Không kết nối được máy chủ. Hãy kiểm tra mạng.';
  }

  if (text.includes('missing supabase')) {
    return 'Chưa cấu hình đầy đủ Supabase.';
  }

  if (text.includes('row-level security') || text.includes('rls') || text.includes('forbidden')) {
    return 'Bạn chưa có quyền thực hiện thao tác này. Hãy kiểm tra RLS trong Supabase.';
  }

  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
