import { CheckCircle2, Eye, RotateCcw } from 'lucide-react';
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
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { getFeedbacks, updateFeedback } from '../services/adminApi';
import useToastStore from '../store/toastStore';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate, formatRelativeTime } from '../utils/date';
import { labelFor } from '../utils/labels';

const PAGE_SIZE = 12;

const typeOptions = [
  { value: 'all', label: 'Tất cả loại góp ý' },
  { value: 'bug', label: 'Lỗi' },
  { value: 'feature', label: 'Tính năng' },
  { value: 'safety', label: 'An toàn' },
  { value: 'general', label: 'Chung' },
];

const statusOptions = [
  { value: 'open', label: 'Đang mở' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'all', label: 'Tất cả trạng thái' },
];

function userName(user, fallback) {
  return user?.full_name || user?.username || fallback || 'Không rõ người dùng';
}

export default function FeedbackPage() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [status, type]);

  const { data, loading, error, refresh } = useAsyncData(
    () => getFeedbacks({ type, status, page, pageSize: PAGE_SIZE }),
    [type, status, page],
    {
      initialData: { rows: [], total: 0 },
      cacheKey: `feedback:${type}:${status}:${page}`,
    }
  );

  useEffect(() => {
    setAdminNotes(selectedFeedback?.admin_notes || '');
  }, [selectedFeedback]);

  const columns = useMemo(
    () => [
      {
        key: 'user',
        header: 'Người dùng',
        render: (row) => (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.user?.avatar_url}
              name={userName(row.user, row.user_id)}
            />
            <div>
              <p className="font-bold text-ink">
                {userName(row.user, row.user_id)}
              </p>
              <p className="text-xs text-muted">
                {row.user?.username || row.user_id}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Loại',
        render: (row) => <Badge variant="info">{labelFor(row.type)}</Badge>,
      },
      {
        key: 'title',
        header: 'Tiêu đề',
        render: (row) => (
          <span className="font-semibold">
            {row.title || 'Góp ý chưa có tiêu đề'}
          </span>
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedFeedback(row)}
          >
            <Eye className="h-4 w-4" />
            Chi tiết
          </Button>
        ),
      },
    ],
    []
  );

  async function handleUpdate(nextStatus) {
    if (!selectedFeedback) {
      return;
    }

    setActionLoading(true);
    try {
      await updateFeedback(selectedFeedback.id, {
        status: nextStatus,
        admin_notes: adminNotes.trim() || null,
      });
      pushToast({
        type: 'success',
        title: 'Đã cập nhật góp ý',
        description: `Đã chuyển sang ${labelFor(nextStatus)}.`,
      });
      setSelectedFeedback(null);
      await refresh();
    } catch (caughtError) {
      pushToast({
        type: 'error',
        title: 'Cập nhật góp ý thất bại',
        description: caughtError.message,
      });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Góp ý người dùng</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={typeOptions}
            />
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={statusOptions}
            />
          </div>
        </CardHeader>
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
            emptyTitle="Chưa có góp ý"
            emptyDescription="Góp ý khớp bộ lọc hiện tại sẽ xuất hiện tại đây."
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
        open={Boolean(selectedFeedback)}
        title={selectedFeedback?.title || 'Chi tiết góp ý'}
        description={
          selectedFeedback
            ? `Tạo lúc ${formatDate(selectedFeedback.created_at)}`
            : ''
        }
        onClose={() => setSelectedFeedback(null)}
        size="lg"
        footer={
          selectedFeedback ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setSelectedFeedback(null)}
              >
                Đóng
              </Button>
              {selectedFeedback.status === 'resolved' ? (
                <Button
                  variant="secondary"
                  loading={actionLoading}
                  onClick={() => handleUpdate('open')}
                >
                  <RotateCcw className="h-4 w-4" />
                  Mở lại
                </Button>
              ) : (
                <Button
                  loading={actionLoading}
                  onClick={() => handleUpdate('resolved')}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Đánh dấu đã xử lý
                </Button>
              )}
            </>
          ) : null
        }
      >
        {selectedFeedback ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar
                src={selectedFeedback.user?.avatar_url}
                name={userName(selectedFeedback.user, selectedFeedback.user_id)}
              />
              <div>
                <p className="font-bold text-ink">
                  {userName(selectedFeedback.user, selectedFeedback.user_id)}
                </p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="info">
                    {labelFor(selectedFeedback.type)}
                  </Badge>
                  <Badge variant={statusVariant(selectedFeedback.status)}>
                    {labelFor(selectedFeedback.status)}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Nội dung
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                {selectedFeedback.message}
              </p>
            </div>
            <Textarea
              label="Ghi chú admin"
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="Ghi chú nội bộ"
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
