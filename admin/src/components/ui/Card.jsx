import { cn } from '../../utils/cn';

export function Card({ className, children }) {
  return <section className={cn('rounded-lg border border-line bg-white shadow-sm', className)}>{children}</section>;
}

export function CardHeader({ className, children }) {
  return <div className={cn('border-b border-line px-5 py-4', className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return <h2 className={cn('text-base font-bold text-ink', className)}>{children}</h2>;
}

export function CardDescription({ className, children }) {
  return <p className={cn('mt-1 text-sm text-muted', className)}>{children}</p>;
}

export function CardContent({ className, children }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
