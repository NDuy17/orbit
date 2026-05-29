import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Spinner({ className, label = 'Đang tải' }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm font-medium text-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function FullPageLoader({ label = 'Đang tải Orbit Admin' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Spinner label={label} />
    </div>
  );
}
