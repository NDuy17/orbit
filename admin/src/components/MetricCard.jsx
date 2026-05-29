import { TrendingUp } from 'lucide-react';
import { cn } from '../utils/cn';

export default function MetricCard({ title, value, icon: Icon = TrendingUp, accent = 'ocean', helper }) {
  const accentClasses = {
    ocean: 'bg-cyan-50 text-ocean',
    leaf: 'bg-emerald-50 text-leaf',
    amber: 'bg-amber-50 text-amber',
    berry: 'bg-red-50 text-berry',
    zinc: 'bg-zinc-100 text-zinc-700',
  };

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-normal text-ink">{value}</p>
          {helper ? <p className="mt-2 text-xs font-medium text-muted">{helper}</p> : null}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accentClasses[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}
