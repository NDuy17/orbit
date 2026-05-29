import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import { cn } from '../../utils/cn';

export default function Modal({ open, title, description, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const width = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4">
      <button aria-label="Đóng lớp phủ modal" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className={cn('relative max-h-[88vh] w-full overflow-hidden rounded-lg bg-white shadow-soft', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng modal">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
