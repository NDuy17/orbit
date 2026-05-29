import { cn } from '../../utils/cn';

export default function Textarea({ label, className, id, ...props }) {
  const textareaId = id || props.name;

  return (
    <label className="block" htmlFor={textareaId}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span> : null}
      <textarea
        id={textareaId}
        className={cn(
          'min-h-28 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:ring-2 focus:ring-cyan-100',
          className
        )}
        {...props}
      />
    </label>
  );
}
