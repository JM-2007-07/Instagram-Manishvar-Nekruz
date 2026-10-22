'use client';

import { cn } from '@/lib/utils';

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export type Birth = { year: string; month: string; day: string };

const selectClass =
  'h-11 min-w-0 flex-1 rounded-(--radius-input) border border-input bg-background-secondary px-2 text-14 text-foreground outline-none focus:border-(--input-border-focus)';

// Дата рождения: три списка (день, месяц, год).
export function BirthdayFields({
  value,
  onChange,
  error,
}: {
  value: Birth;
  onChange: (next: Birth) => void;
  error?: string;
}) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 110 }, (_, i) => String(thisYear - i));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const cls = cn(selectClass, error && 'border-destructive');

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-12 text-muted-foreground">Дата рождения</legend>
      <div className="flex gap-2">
        <select
          aria-label="День"
          className={cls}
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
        >
          <option value="">День</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Месяц"
          className={cls}
          value={value.month}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
        >
          <option value="">Месяц</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Год"
          className={cls}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: e.target.value })}
        >
          <option value="">Год</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-12 text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
