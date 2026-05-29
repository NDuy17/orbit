import { useState } from 'react';
import Button from './Button';
import Modal from './Modal';
import Textarea from './Textarea';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  requireReason = false,
  loading = false,
  variant = 'destructive',
  onConfirm,
  onClose,
  children,
}) {
  const [reason, setReason] = useState('');

  async function handleConfirm() {
    await onConfirm(reason);
    setReason('');
  }

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button variant={variant} loading={loading} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {requireReason ? (
        <Textarea
          label="Ghi chú kiểm duyệt"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Nhập ghi chú nội bộ ngắn"
        />
      ) : null}
    </Modal>
  );
}
