'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Общие элементы страниц настроек: простые, на токенах дизайн-системы.

export function SettingsHeading({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-6 text-20 font-semibold">{children}</h1>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-16 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const inputClass =
  'w-full rounded-[var(--radius-input)] border border-input bg-background px-3 py-2 text-14 outline-none focus:border-[var(--input-border-focus)] disabled:bg-[var(--input-disabled)]';

export function TextField({
  label,
  error,
  multiline,
  ...props
}: {
  label: string;
  error?: string;
  multiline?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-14 font-semibold">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          className={cn(inputClass, 'resize-none')}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input id={id} className={inputClass} {...props} />
      )}
      {error && (
        <p role="alert" className="text-12 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-14 font-semibold">
        {label}
      </label>
      <select
        id={id}
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Переключатель (role="switch"), управляется с клавиатуры как обычная кнопка.
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-14 font-semibold">{label}</div>
        {hint && <div className="text-12 text-muted-foreground">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

// Загрузка / ошибка раздела; готовые данные рисует вызывающий.
export function QueryState({
  isLoading,
  isError,
  refetch,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-background-secondary" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-14">Не удалось загрузить данные</p>
        <Button variant="secondary" onClick={refetch}>
          Повторить
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
