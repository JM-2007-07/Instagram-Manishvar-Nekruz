import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Поле поиска: фон --background-secondary, скругление 25 px, высота 40 px (DESIGN_SYSTEM §2.4).
export function SearchField({
  value,
  onChange,
  label,
  placeholder = 'Поиск',
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[25px] bg-background-secondary pr-4 pl-10 text-16 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
