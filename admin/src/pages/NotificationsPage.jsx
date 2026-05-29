import { Clock3, Eye, Send } from 'lucide-react';
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
import DataTable from '../components/ui/DataTable';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import {
  createNotification,
  getNotifications,
  getUsers,
  sendNotificationNow,
} from '../services/adminApi';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDate, formatRelativeTime } from '../utils/date';
import { labelFor } from '../utils/labels';
import { canSendNotifications } from '../utils/roles';

const PAGE_SIZE = 12;

function getLocalDateTimeInputValue(date) {
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getPushDeliveryDescription(pushDelivery) {
  if (pushDelivery?.status === 'sent') {
    return `Đã gửi push đến ${pushDelivery.sent} thiết bị${pushDelivery.failed ? `, lỗi ${pushDelivery.failed}` : ''}.`;
  }

  if (pushDelivery?.status === 'scheduled') {
    return 'Thông báo đã được lên lịch, push sẽ cần worker xử lý khi đến giờ.';
  }

  if (pushDelivery?.status === 'skipped') {
    return `${pushDelivery.message || 'Chưa có thiết bị nào đăng ký nhận push.'} Thông báo vẫn đã được lưu để app user tự cập nhật.`;
  }

  return (
    pushDelivery?.message || 'Lịch sử thông báo đã được cập nhật cho user.'
  );
}

function userName(user) {
  return user?.full_name || user?.username || user?.id || 'Người dùng Orbit';
}

export default function NotificationsPage() {
  const role = useAuthStore((state) => state.admin?.role);
  const pushToast = useToastStore((state) => state.pushToast);
  const [page, setPage] = useState(1);
  const [audience, setAudience] = useState('all');
  const [targetSearch, setTargetSearch] = useState('');
  const debouncedTargetSearch = useDebouncedValue(targetSearch, 350);
  const [targetUser, setTargetUser] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendingNowIds, setSendingNowIds] = useState({});
  const [selectedNotification, setSelectedNotification] = useState(null);
  const canSend = canSendNotifications(role);
  const minimumScheduledAt = getLocalDateTimeInputValue(
    new Date(Date.now() + 60 * 1000)
  );

  const { data, loading, error, refresh } = useAsyncData(
    () => getNotifications({ page, pageSize: PAGE_SIZE }),
    [page],
    {
      initialData: { rows: [], total: 0 },
      cacheKey: `notifications:${page}`,
    }
  );

  const {
    data: searchData,
    loading: searchLoading,
    error: searchError,
  } = useAsyncData(
    () =>
      audience === 'user' && debouncedTargetSearch.trim()
        ? getUsers({ search: debouncedTargetSearch, page: 1, pageSize: 6 })
        : Promise.resolve({ rows: [], total: 0 }),
    [audience, debouncedTargetSearch],
    {
      initialData: { rows: [], total: 0 },
      cacheKey: `notification-targets:${audience}:${debouncedTargetSearch}`,
    }
  );

  useEffect(() => {
    if (audience === 'all') {
      setTargetUser(null);
      setTargetSearch('');
    }
  }, [audience]);

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Thông báo',
        render: (row) => (
          <div>
            <p className="font-bold text-ink">{row.title}</p>
            <p className="line-clamp-1 text-xs text-muted">{row.body}</p>
          </div>
        ),
      },
      {
        key: 'audience',
        header: 'Người nhận',
        render: (row) => (
          <div className="flex items-center gap-2">
            <Badge variant={row.audience === 'all' ? 'info' : 'default'}>
              {row.audience === 'all' ? 'Tất cả' : 'Một người'}
            </Badge>
            {row.target ? (
              <span className="text-xs text-muted">{userName(row.target)}</span>
            ) : null}
          </div>
        ),
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
      {
        key: 'actions',
        header: 'Thao tác',
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            {row.status === 'scheduled' ? (
              <Button
                variant="primary"
                size="sm"
                loading={Boolean(sendingNowIds[row.id])}
                onClick={() => handleSendNow(row.id)}
              >
                <Send className="h-4 w-4" />
                Đẩy ngay
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedNotification(row)}
            >
              <Eye className="h-4 w-4" />
              Xem
            </Button>
          </div>
        ),
      },
    ],
    [sendingNowIds]
  );

  async function handleSendNow(notificationId) {
    setSendingNowIds((items) => ({ ...items, [notificationId]: true }));

    try {
      const sentNotification = await sendNotificationNow(notificationId);
      pushToast({
        type: 'success',
        title: 'Đã đẩy thông báo',
        description: getPushDeliveryDescription(sentNotification.pushDelivery),
      });
      await refresh();
    } catch (caughtError) {
      pushToast({
        type: 'error',
        title: 'Đẩy thông báo thất bại',
        description: caughtError.message,
      });
    } finally {
      setSendingNowIds((items) => {
        const nextItems = { ...items };
        delete nextItems[notificationId];
        return nextItems;
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSend) {
      pushToast({
        type: 'error',
        title: 'Không đủ quyền',
        description: 'Vai trò của bạn không được gửi thông báo.',
      });
      return;
    }

    if (audience === 'user' && !targetUser) {
      pushToast({
        type: 'error',
        title: 'Chọn người nhận',
        description: 'Chọn một người dùng trước khi gửi.',
      });
      return;
    }

    if (deliveryMode === 'scheduled' && !scheduledAt) {
      pushToast({
        type: 'error',
        title: 'Chọn thời gian',
        description: 'Chọn thời gian lên lịch hoặc chuyển sang Đẩy ngay.',
      });
      return;
    }

    setSendLoading(true);
    try {
      const createdNotification = await createNotification({
        audience,
        targetUserId: targetUser?.id,
        title,
        body,
        deliveryMode,
        scheduledAt: deliveryMode === 'scheduled' ? scheduledAt : null,
      });
      setTitle('');
      setBody('');
      setDeliveryMode('now');
      setScheduledAt('');
      setTargetUser(null);
      setTargetSearch('');
      pushToast({
        type: 'success',
        title:
          deliveryMode === 'scheduled'
            ? 'Đã lên lịch thông báo'
            : 'Đã đẩy thông báo',
        description: getPushDeliveryDescription(
          createdNotification.pushDelivery
        ),
      });
      await refresh();
    } catch (caughtError) {
      pushToast({
        type: 'error',
        title: 'Gửi thông báo thất bại',
        description: caughtError.message,
      });
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Gửi thông báo</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Select
              label="Người nhận"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              options={[
                { value: 'all', label: 'Tất cả người dùng' },
                { value: 'user', label: 'Một người dùng' },
              ]}
              disabled={!canSend}
            />

            {audience === 'user' ? (
              <div className="space-y-3">
                <Input
                  label="Tìm người dùng"
                  value={targetSearch}
                  onChange={(event) => setTargetSearch(event.target.value)}
                  placeholder="Tìm theo tên hoặc username"
                  disabled={!canSend}
                />
                {targetUser ? (
                  <div className="flex items-center justify-between rounded-lg border border-line bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={targetUser.avatar_url}
                        name={userName(targetUser)}
                      />
                      <div>
                        <p className="text-sm font-bold text-ink">
                          {userName(targetUser)}
                        </p>
                        <p className="text-xs text-muted">
                          {targetUser.username || targetUser.id}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTargetUser(null)}
                    >
                      Xóa chọn
                    </Button>
                  </div>
                ) : null}
                {debouncedTargetSearch && !targetUser ? (
                  <div className="rounded-lg border border-line bg-white">
                    {searchLoading ? (
                      <p className="p-3 text-sm text-muted">Đang tìm...</p>
                    ) : searchError ? (
                      <p className="p-3 text-sm text-berry">
                        {searchError.message}
                      </p>
                    ) : searchData?.rows?.length ? (
                      searchData.rows.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                          onClick={() => setTargetUser(user)}
                        >
                          <Avatar src={user.avatar_url} name={userName(user)} />
                          <span>
                            <span className="block text-sm font-bold text-ink">
                              {userName(user)}
                            </span>
                            <span className="block text-xs text-muted">
                              {user.username || user.id}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="p-3 text-sm text-muted">
                        Không có người dùng phù hợp.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <Input
              label="Tiêu đề"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tiêu đề thông báo"
              required
              disabled={!canSend}
            />
            <Textarea
              label="Nội dung"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Nội dung thông báo"
              required
              disabled={!canSend}
            />
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-ink">
                Cách gửi
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={deliveryMode === 'now'}
                  disabled={!canSend || sendLoading}
                  onClick={() => {
                    setDeliveryMode('now');
                    setScheduledAt('');
                  }}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-55 ${
                    deliveryMode === 'now'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-ink hover:bg-slate-50'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  Đẩy ngay
                </button>
                <button
                  type="button"
                  aria-pressed={deliveryMode === 'scheduled'}
                  disabled={!canSend || sendLoading}
                  onClick={() => setDeliveryMode('scheduled')}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-55 ${
                    deliveryMode === 'scheduled'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-ink hover:bg-slate-50'
                  }`}
                >
                  <Clock3 className="h-4 w-4" />
                  Lên lịch
                </button>
              </div>
            </div>
            {deliveryMode === 'scheduled' ? (
              <Input
                label="Thời gian gửi"
                type="datetime-local"
                value={scheduledAt}
                min={minimumScheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                required
                disabled={!canSend}
              />
            ) : null}
            <Button
              type="submit"
              loading={sendLoading}
              disabled={!canSend}
              className="w-full"
            >
              <Send className="h-4 w-4" />
              {deliveryMode === 'scheduled'
                ? 'Lên lịch thông báo'
                : 'Đẩy thông báo ngay'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error.message}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Lịch sử thông báo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              rows={data?.rows || []}
              loading={loading}
              emptyTitle="Chưa có thông báo"
              emptyDescription="Thông báo đã gửi và đã lên lịch sẽ xuất hiện tại đây."
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total || 0}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>

      <Modal
        open={Boolean(selectedNotification)}
        title={selectedNotification?.title || 'Thông báo'}
        description={
          selectedNotification
            ? `Tạo lúc ${formatDate(selectedNotification.created_at)}`
            : ''
        }
        onClose={() => setSelectedNotification(null)}
      >
        {selectedNotification ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant(selectedNotification.status)}>
                {labelFor(selectedNotification.status)}
              </Badge>
              <Badge
                variant={
                  selectedNotification.audience === 'all' ? 'info' : 'default'
                }
              >
                {selectedNotification.audience === 'all'
                  ? 'Tất cả'
                  : 'Một người'}
              </Badge>
            </div>
            {selectedNotification.target ? (
              <div className="flex items-center gap-3 rounded-lg border border-line p-3">
                <Avatar
                  src={selectedNotification.target.avatar_url}
                  name={userName(selectedNotification.target)}
                />
                <div>
                  <p className="text-sm font-bold text-ink">
                    {userName(selectedNotification.target)}
                  </p>
                  <p className="text-xs text-muted">
                    {selectedNotification.target.username}
                  </p>
                </div>
              </div>
            ) : null}
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
              {selectedNotification.body}
            </p>
            {selectedNotification.scheduled_at ? (
              <p className="text-sm text-muted">
                Lên lịch lúc {formatDate(selectedNotification.scheduled_at)}
              </p>
            ) : null}
            {selectedNotification.sent_at ? (
              <p className="text-sm text-muted">
                Đã gửi lúc {formatDate(selectedNotification.sent_at)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
