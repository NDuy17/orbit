import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function EmptyState({ title = 'Chưa có dữ liệu', description, icon: Icon = Inbox, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-line p-8 text-center', className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}
