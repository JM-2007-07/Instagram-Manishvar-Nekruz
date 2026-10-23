'use client';

import { ChevronDown } from 'lucide-react';
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

// Как у Instagram: три поля 60 px со скруглением 16 и стрелкой справа.
const selectClass =
  'h-[60px] w-full appearance-none rounded-2xl border-[0.8px] border-auth-field-border bg-transparent pr-11 pl-4 text-15 font-medium text-auth-text outline-none focus:border-auth-field-border-focus [&:has(option[value=""]:checked)]:text-auth-label';

function Select({
  label,
  value,
  invalid,
  onChange,
  children,
}: {
  label: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <select
        aria-label={label}
        className={cn(selectClass, invalid && 'border-destructive')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 size-6 -translate-y-1/2 text-auth-text"
      />
    </div>
  );
}

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
  const invalid = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-4">
        <Select
          label="День"
          value={value.day}
          invalid={invalid}
          onChange={(day) => onChange({ ...value, day })}
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select
          label="Месяц"
          value={value.month}
          invalid={invalid}
          onChange={(month) => onChange({ ...value, month })}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </Select>
        <Select
          label="Год"
          value={value.year}
          invalid={invalid}
          onChange={(year) => onChange({ ...value, year })}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p role="alert" className="px-1 text-12 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
