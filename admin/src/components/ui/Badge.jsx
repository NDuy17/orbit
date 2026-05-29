import { cn } from '../../utils/cn';

const variants = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

export default function Badge({ variant = 'default', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusVariant(status) {
  const value = String(status || '').toLowerCase();
  if (['active', 'resolved', 'sent', 'online'].includes(value)) {
    return 'success';
  }
  if (['pending', 'scheduled', 'open'].includes(value)) {
    return 'warning';
  }
  if (['disabled', 'banned', 'deleted', 'rejected', 'suspended'].includes(value)) {
    return 'danger';
  }
  if (['warned'].includes(value)) {
    return 'info';
  }
  return 'default';
}
