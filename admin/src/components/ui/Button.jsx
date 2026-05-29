import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const variants = {
  primary: 'bg-ink text-white hover:bg-zinc-800 focus-visible:ring-ink',
  secondary: 'bg-white text-ink border border-line hover:bg-slate-50 focus-visible:ring-ocean',
  outline: 'bg-transparent text-ink border border-line hover:bg-slate-50 focus-visible:ring-ocean',
  destructive: 'bg-berry text-white hover:bg-red-700 focus-visible:ring-berry',
  ghost: 'bg-transparent text-muted hover:bg-slate-100 hover:text-ink focus-visible:ring-ocean',
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
};

export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
