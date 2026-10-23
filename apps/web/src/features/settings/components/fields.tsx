'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Общие элементы страниц настроек: простые, на токенах дизайн-системы.

export function SettingsHeading({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-6 text-20 leading-[25px] font-bold md:mb-11">{children}</h1>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-16 leading-5 font-bold">{title}</h2>
      {children}
    </section>
  );
}

// Как у Instagram (2026): поле 42 px, рамка 0.8 px, скругление 12, текст 16.
const inputClass =
  'w-full rounded-xl border-[0.8px] border-separator bg-background px-4 py-2.5 text-16 leading-5 outline-none focus:border-(--input-border-focus) disabled:bg-(--input-disabled) disabled:text-muted-foreground';

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
      <label htmlFor={id} className="block pb-3 text-16 leading-5 font-bold">
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
      <label htmlFor={id} className="block pb-3 text-16 leading-5 font-bold">
        {label}
      </label>
      <select
        id={id}
        className={cn(inputClass, 'h-[54px]')}
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
    // Карточка-переключатель: рамка 0.8 px, скругление 20, переключатель 40×24 (вкл. — чёрный).
    <div className="flex min-h-[62px] items-center justify-between gap-4 rounded-[20px] border-[0.8px] border-separator px-4 py-2.5">
      <div>
        <div className="text-16 leading-5">{label}</div>
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
          'relative h-6 w-10 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          checked ? 'bg-foreground' : 'bg-muted-foreground',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform',
            checked && 'translate-x-4',
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
