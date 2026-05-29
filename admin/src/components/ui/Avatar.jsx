import { cn } from '../../utils/cn';

function getInitials(name) {
  return String(name || 'Người dùng Orbit')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function Avatar({ src, name, className }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-slate-100 text-sm font-bold text-slate-600',
        className
      )}
    >
      {src ? <img src={src} alt={name || 'Ảnh đại diện người dùng'} className="h-full w-full object-cover" /> : getInitials(name)}
    </div>
  );
}
