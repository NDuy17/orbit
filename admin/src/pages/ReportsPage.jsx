import { Ban, CheckCircle2, Eye, Send, ShieldOff, XCircle } from 'lucide-react';
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
import {
  getReports,
  suspendUser,
  updateReport,
  warnUser,
} from '../services/adminApi';
import useToastStore from '../store/toastStore';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate, formatRelativeTime } from '../utils/date';
import { labelFor } from '../utils/labels';

const PAGE_SIZE = 12;

const statusOptions = [
  { value: 'pending', label: 'Báo cáo đang chờ' },
  { value: 'resolved', label: 'Báo cáo đã xử lý' },
  { value: 'rejected', label: 'Báo cáo bị từ chối' },
  { value: 'warned', label: 'Người dùng đã cảnh báo' },
  { value: 'suspended', label: 'Tài khoản bị đình chỉ' },
  { value: 'all', label: 'Tất cả báo cáo' },
];

function profileName(profile, fallback) {
  return (
    profile?.full_name || profile?.username || fallback || 'Không rõ người dùng'
  );
}

function ProfileCell({ profile, fallback }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar src={profile?.avatar_url} name={profileName(profile, fallback)} />
      <div>
        <p className="font-bold text-ink">{profileName(profile, fallback)}</p>
        <p className="text-xs text-muted">{profile?.username || fallback}</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, loading, error, refresh } = useAsyncData(
    () => getReports({ status, page, pageSize: PAGE_SIZE }),
    [status, page],
    {
      initialData: { rows: [], total: 0 },
      cacheKey: `reports:${status}:${page}`,
    }
  );

  useEffect(() => {
    setAdminNotes(selectedReport?.admin_notes || '');
  }, [selectedReport]);

  const columns = useMemo(
    () => [
      {
        key: 'target',
        header: 'Đối tượng',
        render: (row) => (
          <ProfileCell profile={row.target} fallback={row.target_user_id} />
        ),
      },
      {
        key: 'reporter',
        header: 'Người báo cáo',
        render: (row) => (
          <ProfileCell profile={row.reporter} fallback={row.reporter_id} />
        ),
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
      {
        key: 'actions',
        header: 'Thao tác',
        render: (row) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedReport(row)}
          >
            <Eye className="h-4 w-4" />
            Chi tiết
          </Button>
        ),
      },
    ],
    []
  );

  async function handleReportAction(action) {
    if (!selectedReport) {
      return;
    }

    setActionLoading(action);
    try {
      if (action === 'resolved' || action === 'rejected') {
        await updateReport(selectedReport.id, {
          status: action,
          admin_notes: adminNotes.trim() || null,
        });
      }

      if (action === 'warned') {
        await warnUser(
          selectedReport.target_user_id,
          selectedReport.id,
          adminNotes.trim()
        );
      }

      if (action === 'suspended') {
        await suspendUser(
          selectedReport.target_user_id,
          selectedReport.id,
          adminNotes.trim()
        );
      }

      pushToast({
        type: 'success',
        title: 'Đã cập nhật báo cáo',
        description: `Báo cáo đã chuyển sang trạng thái ${labelFor(action)}.`,
      });
      setSelectedReport(null);
      await refresh();
    } catch (caughtError) {
      pushToast({
        type: 'error',
        title: 'Thao tác báo cáo thất bại',
        description: caughtError.message,
      });
    } finally {
      setActionLoading('');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Kiểm duyệt báo cáo</CardTitle>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={statusOptions}
            className="sm:w-56"
          />
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
            emptyTitle="Chưa có báo cáo"
            emptyDescription="Báo cáo khớp bộ lọc hiện tại sẽ xuất hiện tại đây."
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
        open={Boolean(selectedReport)}
        title="Chi tiết báo cáo"
        description={
          selectedReport
            ? `Tạo lúc ${formatDate(selectedReport.created_at)}`
            : ''
        }
        onClose={() => setSelectedReport(null)}
        size="lg"
        footer={
          selectedReport ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setSelectedReport(null)}
              >
                Đóng
              </Button>
              <Button
                variant="secondary"
                loading={actionLoading === 'rejected'}
                onClick={() => handleReportAction('rejected')}
              >
                <XCircle className="h-4 w-4" />
                Từ chối
              </Button>
              <Button
                loading={actionLoading === 'resolved'}
                onClick={() => handleReportAction('resolved')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Xử lý
              </Button>
              <Button
                variant="secondary"
                loading={actionLoading === 'warned'}
                onClick={() => handleReportAction('warned')}
              >
                <Send className="h-4 w-4" />
                Cảnh báo
              </Button>
              <Button
                variant="destructive"
                loading={actionLoading === 'suspended'}
                onClick={() => handleReportAction('suspended')}
              >
                <ShieldOff className="h-4 w-4" />
                Đình chỉ
              </Button>
            </>
          ) : null
        }
      >
        {selectedReport ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                  Người báo cáo
                </p>
                <ProfileCell
                  profile={selectedReport.reporter}
                  fallback={selectedReport.reporter_id}
                />
              </div>
              <div className="rounded-lg border border-line p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                  Đối tượng
                </p>
                <ProfileCell
                  profile={selectedReport.target}
                  fallback={selectedReport.target_user_id}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Lý do
              </p>
              <p className="mt-1 text-sm font-bold text-ink">
                {selectedReport.reason}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Mô tả
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                {selectedReport.description || 'Không có mô tả'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant(selectedReport.status)}>
                {labelFor(selectedReport.status)}
              </Badge>
              {selectedReport.resolved_at ? (
                <Badge variant="neutral">
                  Đã xử lý {formatRelativeTime(selectedReport.resolved_at)}
                </Badge>
              ) : null}
              {selectedReport.target_user_id ? (
                <Badge variant="default">
                  <Ban className="mr-1 h-3 w-3" />
                  Có thể xử lý đối tượng
                </Badge>
              ) : null}
            </div>
            <Textarea
              label="Ghi chú admin"
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="Ghi chú kiểm duyệt nội bộ"
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
