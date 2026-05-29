import { cn } from '../../utils/cn';

export default function Input({ label, hint, error, className, id, ...props }) {
  const inputId = id || props.name;

  return (
    <label className="block" htmlFor={inputId}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span> : null}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-50',
          error && 'border-berry focus:border-berry focus:ring-red-100',
          className
        )}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs font-medium text-berry">{error}</span> : null}
      {hint && !error ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
