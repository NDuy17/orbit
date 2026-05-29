import {
  Bell,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { prefetchAsyncData } from '../hooks/useAsyncData';
import {
  getDashboardStats,
  getFeedbacks,
  getNotifications,
  getReports,
  getUsers,
} from '../services/adminApi';
import useAuthStore from '../store/authStore';
import { cn } from '../utils/cn';
import { roleLabel } from '../utils/roles';

const navItems = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/users', label: 'Người dùng', icon: Users },
  { to: '/reports', label: 'Báo cáo', icon: ShieldAlert },
  { to: '/feedback', label: 'Góp ý', icon: MessageSquareText },
  { to: '/notifications', label: 'Thông báo', icon: Bell },
];

const titles = {
  '/': 'Tổng quan',
  '/users': 'Quản lý người dùng',
  '/reports': 'Kiểm duyệt báo cáo',
  '/feedback': 'Góp ý người dùng',
  '/notifications': 'Thông báo',
};

const prefetchItems = [
  ['dashboard', getDashboardStats],
  [
    'users::all:all:1',
    () =>
      getUsers({
        search: '',
        status: 'all',
        online: 'all',
        page: 1,
        pageSize: 10,
      }),
  ],
  [
    'reports:pending:1',
    () => getReports({ status: 'pending', page: 1, pageSize: 12 }),
  ],
  [
    'feedback:all:open:1',
    () => getFeedbacks({ type: 'all', status: 'open', page: 1, pageSize: 12 }),
  ],
  ['notifications:1', () => getNotifications({ page: 1, pageSize: 12 })],
];

function warmAdminCaches() {
  prefetchItems.forEach(([cacheKey, loader]) => {
    prefetchAsyncData(cacheKey, loader).catch(() => {});
  });
}

function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-line bg-white lg:flex lg:flex-col">
      <div className="border-b border-line px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-sm font-black text-white">
            O
          </div>
          <div>
            <p className="text-base font-black text-ink">Orbit Admin</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bảng điều khiển</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition',
                  isActive ? 'bg-slate-100 text-ink' : 'text-muted hover:bg-slate-50 hover:text-ink'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-3 lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold',
                isActive ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const admin = useAuthStore((state) => state.admin);
  const title = titles[location.pathname] || 'Orbit Admin';

  useEffect(() => {
    if (!admin) {
      return undefined;
    }

    const scheduleIdleWork =
      window.requestIdleCallback ||
      ((callback) => window.setTimeout(callback, 150));
    const cancelIdleWork =
      window.cancelIdleCallback || ((id) => window.clearTimeout(id));
    const idleId = scheduleIdleWork(warmAdminCaches);

    return () => cancelIdleWork(idleId);
  }, [admin]);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div>
              <h1 className="text-xl font-black tracking-normal text-ink">{title}</h1>
              <p className="text-sm text-muted">Dùng chung Supabase backend, chỉ tài khoản admin được truy cập.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-ink">{user?.email}</p>
                <Badge variant="info">{roleLabel(admin?.role)}</Badge>
              </div>
              <Button variant="secondary" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          </div>
          <MobileNav />
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
