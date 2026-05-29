import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import Button from './Button';
import useToastStore from '../../store/toastStore';
import { cn } from '../../utils/cn';

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export default function ToastViewport() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info;
        return (
          <div
            key={toast.id}
            className={cn(
              'flex gap-3 rounded-lg border bg-white p-4 shadow-soft',
              toast.type === 'success' && 'border-emerald-200',
              toast.type === 'error' && 'border-red-200',
              toast.type !== 'success' && toast.type !== 'error' && 'border-line'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-5 w-5 shrink-0',
                toast.type === 'success' && 'text-leaf',
                toast.type === 'error' && 'text-berry',
                toast.type !== 'success' && toast.type !== 'error' && 'text-ocean'
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{toast.title}</p>
              {toast.description ? <p className="mt-1 text-sm text-muted">{toast.description}</p> : null}
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeToast(toast.id)} aria-label="Ẩn thông báo">
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
