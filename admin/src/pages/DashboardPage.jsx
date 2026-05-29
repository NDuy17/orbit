import {
  Activity,
  Clock,
  MessageCircle,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { useEffect } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MetricCard from '../components/MetricCard';
import Avatar from '../components/ui/Avatar';
import Badge, { statusVariant } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { getDashboardStats } from '../services/adminApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate, formatRelativeTime } from '../utils/date';
import { labelFor } from '../utils/labels';
import { ADMIN_REFRESH_MS } from '../utils/presence';

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function ErrorPanel({ error, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-800">
        Không tải được dữ liệu tổng quan
      </p>
      <p className="mt-1 text-sm text-red-700">{error.message}</p>
      <Button className="mt-3" variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, refresh } = useAsyncData(
    getDashboardStats,
    [],
    {
      cacheKey: 'dashboard',
    }
  );
  const cards = data?.cards || {};

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {});
    }, ADMIN_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const metricCards = [
    {
      title: 'Tổng người dùng',
      value: cards.totalUsers,
      icon: Users,
      accent: 'ocean',
    },
    {
      title: 'Người dùng hoạt động',
      value: cards.activeUsers,
      icon: Activity,
      accent: 'leaf',
      helper: '24 giờ qua',
    },
    {
      title: 'Lời mời kết bạn',
      value: cards.totalFriendRequests,
      icon: UserPlus,
      accent: 'amber',
    },
    {
      title: 'Quan hệ bạn bè',
      value: cards.totalFriendships,
      icon: UsersRound,
      accent: 'zinc',
    },
    {
      title: 'Tin nhắn',
      value: cards.totalMessages,
      icon: MessageCircle,
      accent: 'ocean',
    },
    {
      title: 'Báo cáo',
      value: cards.totalReports,
      icon: ShieldAlert,
      accent: 'berry',
    },
    {
      title: 'Đang online',
      value: cards.onlineUsers,
      icon: UserCheck,
      accent: 'leaf',
    },
    {
      title: 'Đăng ký mới',
      value: cards.recentRegistrations,
      icon: Clock,
      accent: 'amber',
      helper: '7 ngày qua',
    },
  ];

  const userColumns = [
    {
      key: 'user',
      header: 'Người dùng',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatar_url} name={row.full_name || row.username} />
          <div>
            <p className="font-bold text-ink">
              {row.full_name || row.username || 'Người dùng Orbit'}
            </p>
            <p className="text-xs text-muted">{row.username || row.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <Badge variant={statusVariant(row.account_status || 'active')}>
          {labelFor(row.account_status || 'active')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Đăng ký',
      render: (row) => formatRelativeTime(row.created_at),
    },
  ];

  const reportColumns = [
    {
      key: 'target',
      header: 'Đối tượng',
      render: (row) =>
        row.target?.full_name || row.target?.username || row.target_user_id,
    },
    {
      key: 'reason',
      header: 'Lý do',
      render: (row) => <span className="font-semibold">{row.reason}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <Badge variant={statusVariant(row.status)}>
          {labelFor(row.status)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Tạo lúc',
      render: (row) => formatRelativeTime(row.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      {error ? <ErrorPanel error={error} onRetry={refresh} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={loading ? '...' : formatNumber(card.value)}
            icon={card.icon}
            accent={card.accent}
            helper={card.helper}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Tăng trưởng và tin nhắn</CardTitle>
            <p className="mt-1 text-sm text-muted">14 ngày gần nhất</p>
          </div>
          {loading ? <Spinner /> : null}
        </CardHeader>
        <CardContent>
          {data?.chartData?.length ? (
            <div className="min-h-80 min-w-0">
              <ResponsiveContainer
                width="100%"
                height={320}
                minWidth={0}
                minHeight={320}
              >
                <AreaChart
                  data={data.chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="usersGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="messagesGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#16a34a"
                        stopOpacity={0.28}
                      />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name="Người dùng"
                    stroke="#0891b2"
                    fill="url(#usersGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    name="Tin nhắn"
                    stroke="#16a34a"
                    fill="url(#messagesGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="Chưa có dữ liệu biểu đồ"
              description="Hoạt động sẽ hiện khi có đăng ký hoặc tin nhắn mới."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Đăng ký gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={userColumns}
              rows={data?.recentUsers || []}
              loading={loading}
              emptyTitle="Chưa có người dùng mới"
              emptyDescription="Hồ sơ mới sẽ xuất hiện tại đây."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Báo cáo gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={reportColumns}
              rows={data?.recentReports || []}
              loading={loading}
              emptyTitle="Chưa có báo cáo mới"
              emptyDescription="Báo cáo kiểm duyệt sẽ xuất hiện tại đây."
            />
          </CardContent>
        </Card>
      </div>

      {data?.recentUsers?.length ? (
        <p className="text-xs text-muted">
          Cập nhật lần cuối: {formatDate(new Date().toISOString())}
        </p>
      ) : null}
    </div>
  );
}
