import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const location = useLocation();
  const signIn = useAuthStore((state) => state.signIn);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const admin = useAuthStore((state) => state.admin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) {
      setFormError(error);
    }
  }, [error]);

  if (status === 'authenticated' && admin) {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (caughtError) {
      setFormError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-[1fr_480px]">
      <section className="hidden items-center justify-center border-r border-line bg-white p-10 lg:flex">
        <div className="max-w-xl">
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg bg-ink text-white">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-5xl font-black tracking-normal text-ink">Orbit Admin</h1>
          <p className="mt-4 text-lg leading-8 text-muted">
            Công cụ kiểm duyệt, vận hành người dùng, xử lý báo cáo, góp ý và thông báo cho Orbit.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <p className="text-sm font-bold text-ink">Bảo mật</p>
              <p className="mt-1 text-xs text-muted">Chặn bằng bảng admin</p>
            </div>
            <div className="rounded-lg border border-line bg-cyan-50 p-4">
              <p className="text-sm font-bold text-ink">Thời gian thực</p>
              <p className="mt-1 text-xs text-muted">Dữ liệu cập nhật liên tục</p>
            </div>
            <div className="rounded-lg border border-line bg-emerald-50 p-4">
              <p className="text-sm font-bold text-ink">Vận hành</p>
              <p className="mt-1 text-xs text-muted">Ưu tiên thao tác nhanh</p>
            </div>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-white lg:hidden">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-ink">Đăng nhập admin</h2>
            <p className="mt-1 text-sm text-muted">Dùng tài khoản Supabase đã có trong bảng `admin_users`.</p>
          </div>
          {formError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {formError}
            </div>
          ) : null}
          <div className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="Mật khẩu"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button className="w-full" type="submit" loading={loading}>
              Vào bảng admin
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
