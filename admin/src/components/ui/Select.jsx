import { cn } from '../../utils/cn';

export default function Select({ label, options = [], className, id, ...props }) {
  const selectId = id || props.name;

  return (
    <label className="block" htmlFor={selectId}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span> : null}
      <select
        id={selectId}
        className={cn(
          'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-cyan-100',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
