import {
  Ban,
  Eye,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldOff,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Avatar from '../components/ui/Avatar';
import Badge, { statusVariant } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Select from '../components/ui/Select';
import { getUsers, updateUserModeration } from '../services/adminApi';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDate, formatRelativeTime } from '../utils/date';
import { labelFor } from '../utils/labels';
import { ADMIN_REFRESH_MS } from '../utils/presence';
import { canManageUsers } from '../utils/roles';

const PAGE_SIZE = 10;

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'disabled', label: 'Đã vô hiệu' },
  { value: 'banned', label: 'Đã cấm' },
  { value: 'deleted', label: 'Đã xóa mềm' },
];

const onlineOptions = [
  { value: 'all', label: 'Tất cả người dùng' },
  { value: 'online', label: 'Chỉ online' },
  { value: 'offline', label: 'Chỉ offline' },
];

const actionMeta = {
  warn: {
    label: 'Cảnh cáo người dùng',
    icon: ShieldAlert,
    variant: 'secondary',
  },
  disable: {
    label: 'Vô hiệu tài khoản',
    icon: ShieldOff,
    variant: 'destructive',
  },
  enable: { label: 'Mở lại tài khoản', icon: UserCheck, variant: 'primary' },
  soft_delete: {
    label: 'Xóa mềm tài khoản',
    icon: Trash2,
    variant: 'destructive',
  },
  ban: { label: 'Cấm tài khoản', icon: Ban, variant: 'destructive' },
  unban: { label: 'Gỡ cấm tài khoản', icon: RotateCcw, variant: 'primary' },
};

const DEFAULT_BAN_DAYS = 7;

function userName(user) {
  return user.full_name || user.username || 'Người dùng Orbit';
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-ink">
        {value || 'Chưa có'}
      </p>
    </div>
  );
}

function getWarningCount(user) {
  return Number(user?.warning_count || 0);
}

function getActionDescription(confirmAction, banDays) {
  if (!confirmAction) {
    return '';
  }

  const name = userName(confirmAction.user);
  const warningCount = getWarningCount(confirmAction.user);

  if (confirmAction.action === 'warn') {
    return warningCount >= 1
      ? `${name} đã có ${warningCount} lần vi phạm. Cảnh cáo lần này sẽ tự ban ${DEFAULT_BAN_DAYS} ngày.`
      : `${name} sẽ nhận cảnh cáo lần 1. Nếu tiếp tục vi phạm sẽ bị ban tạm thời.`;
  }

  if (confirmAction.action === 'ban') {
    return `Ban ${name} trong ${banDays} ngày.`;
  }

  return `Áp dụng thao tác này cho ${name}.`;
}

export default function UsersPage() {
  const role = useAuthStore((state) => state.admin?.role);
  const pushToast = useToastStore((state) => state.pushToast);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('all');
  const [online, setOnline] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [banDays, setBanDays] = useState(DEFAULT_BAN_DAYS);
  const [actionLoading, setActionLoading] = useState(false);
  const canModerate = canManageUsers(role);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, online, status]);

  const { data, loading, error, refresh } = useAsyncData(
    () =>
      getUsers({
        search: debouncedSearch,
        status,
        online,
        page,
        pageSize: PAGE_SIZE,
      }),
    [debouncedSearch, status, online, page],
    {
      initialData: { rows: [], total: 0 },
      cacheKey: `users:${debouncedSearch}:${status}:${online}:${page}`,
    }
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {});
    }, ADMIN_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const columns = useMemo(
    () => [
      {
        key: 'user',
        header: 'Người dùng',
        render: (row) => (
          <div className="flex items-center gap-3">
            <Avatar src={row.avatar_url} name={userName(row)} />
            <div>
              <p className="font-bold text-ink">{userName(row)}</p>
              <p className="text-xs text-muted">{row.username || row.id}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'account_status',
        header: 'Tài khoản',
        render: (row) => (
          <Badge variant={statusVariant(row.account_status || 'active')}>
            {labelFor(row.account_status || 'active')}
          </Badge>
        ),
      },
      {
        key: 'warning_count',
        header: 'Vi phạm',
        render: (row) => (
          <Badge variant={getWarningCount(row) ? 'warning' : 'neutral'}>
            {getWarningCount(row)} lần
          </Badge>
        ),
      },
      {
        key: 'online',
        header: 'Trực tuyến',
        render: (row) => (
          <Badge variant={row.is_online ? 'success' : 'neutral'}>
            {row.is_online ? 'Đang online' : 'Offline'}
          </Badge>
        ),
      },
      {
        key: 'ghost',
        header: 'Ẩn vị trí',
        render: (row) => (
          <Badge variant={row.ghost_mode ? 'warning' : 'default'}>
            {row.ghost_mode ? 'Bật' : 'Tắt'}
          </Badge>
        ),
      },
      {
        key: 'last_active',
        header: 'Hoạt động gần nhất',
        render: (row) => formatRelativeTime(row.last_active),
      },
      {
        key: 'actions',
        header: 'Thao tác',
        className: 'text-right',
        render: (row) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedUser(row)}
          >
            <Eye className="h-4 w-4" />
            Xem
          </Button>
        ),
      },
    ],
    []
  );

  async function handleModeration(reason) {
    if (!confirmAction) {
      return;
    }

    setActionLoading(true);
    try {
      await updateUserModeration(confirmAction.user.id, confirmAction.action, {
        reason,
        banDays,
      });
      pushToast({
        type: 'success',
        title: 'Đã cập nhật người dùng',
        description: `${userName(confirmAction.user)} đã được cập nhật.`,
      });
      setConfirmAction(null);
      setSelectedUser(null);
      await refresh();
    } catch (caughtError) {
      pushToast({
        type: 'error',
        title: 'Kiểm duyệt thất bại',
        description: caughtError.message,
      });
    } finally {
      setActionLoading(false);
    }
  }

  function openAction(action) {
    if (!selectedUser) {
      return;
    }

    if (action === 'ban') {
      setBanDays(DEFAULT_BAN_DAYS);
    }

    setConfirmAction({ user: selectedUser, action });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý người dùng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <Input
              aria-label="Tìm người dùng"
              placeholder="Tìm username hoặc tên hiển thị"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={statusOptions}
            />
            <Select
              value={online}
              onChange={(event) => setOnline(event.target.value)}
              options={onlineOptions}
            />
          </div>
          <div className="pointer-events-none relative -mt-10 ml-3 h-10 w-4 text-muted">
            <Search className="h-4 w-4 translate-y-3" />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error.message}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={data?.rows || []}
            loading={loading}
            emptyTitle="Không tìm thấy người dùng"
            emptyDescription="Đổi từ khóa hoặc bộ lọc rồi thử lại."
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data?.total || 0}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selectedUser)}
        title={selectedUser ? userName(selectedUser) : ''}
        description={selectedUser?.id}
        onClose={() => setSelectedUser(null)}
        size="lg"
        footer={
          selectedUser ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                Đóng
              </Button>
              {canModerate ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => openAction('warn')}
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Cảnh cáo
                  </Button>
                  {(selectedUser.account_status || 'active') === 'disabled' ? (
                    <Button onClick={() => openAction('enable')}>
                      <UserCheck className="h-4 w-4" />
                      Mở lại
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => openAction('disable')}
                    >
                      <ShieldOff className="h-4 w-4" />
                      Vô hiệu
                    </Button>
                  )}
                  {(selectedUser.account_status || 'active') === 'banned' ? (
                    <Button onClick={() => openAction('unban')}>
                      <RotateCcw className="h-4 w-4" />
                      Gỡ cấm
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => openAction('ban')}
                    >
                      <Ban className="h-4 w-4" />
                      Cấm
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => openAction('soft_delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa mềm
                  </Button>
                </div>
              ) : null}
            </>
          ) : null
        }
      >
        {selectedUser ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                src={selectedUser.avatar_url}
                name={userName(selectedUser)}
                className="h-16 w-16 text-lg"
              />
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={statusVariant(
                      selectedUser.account_status || 'active'
                    )}
                  >
                    {labelFor(selectedUser.account_status || 'active')}
                  </Badge>
                  <Badge
                    variant={selectedUser.is_online ? 'success' : 'neutral'}
                  >
                    {selectedUser.is_online ? 'Đang online' : 'Offline'}
                  </Badge>
                  <Badge
                    variant={selectedUser.ghost_mode ? 'warning' : 'default'}
                  >
                    Ẩn vị trí {selectedUser.ghost_mode ? 'bật' : 'tắt'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {selectedUser.bio || 'Chưa có bio'}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="Tên người dùng" value={selectedUser.username} />
              <DetailRow
                label="Ngày tạo"
                value={formatDate(selectedUser.created_at)}
              />
              <DetailRow
                label="Hoạt động gần nhất"
                value={formatDate(selectedUser.last_active)}
              />
              <DetailRow
                label="Cập nhật vị trí"
                value={formatDate(selectedUser.location?.updated_at)}
              />
              <DetailRow label="Trạng thái hồ sơ" value={selectedUser.status} />
              <DetailRow
                label="Số lần vi phạm"
                value={`${getWarningCount(selectedUser)} lần`}
              />
              <DetailRow
                label="Cảnh cáo gần nhất"
                value={formatDate(selectedUser.last_warned_at)}
              />
              <DetailRow
                label="Ban đến"
                value={formatDate(selectedUser.ban_expires_at)}
              />
              <DetailRow
                label="Lý do kiểm duyệt"
                value={selectedUser.moderation_reason}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction ? actionMeta[confirmAction.action].label : ''}
        description={
          confirmAction ? getActionDescription(confirmAction, banDays) : ''
        }
        confirmLabel={
          confirmAction ? actionMeta[confirmAction.action].label : 'Xác nhận'
        }
        variant={
          confirmAction
            ? actionMeta[confirmAction.action].variant
            : 'destructive'
        }
        requireReason
        loading={actionLoading}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleModeration}
      >
        {confirmAction?.action === 'ban' ? (
          <Input
            label="Số ngày ban"
            type="number"
            min="1"
            max="365"
            value={banDays}
            onChange={(event) => setBanDays(event.target.value)}
          />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
