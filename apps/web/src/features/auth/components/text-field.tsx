'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = Omit<React.ComponentProps<'input'>, 'id'> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
};

// Поле с подписью и текстом ошибки. Пароль (type="password") получает кнопку «показать/скрыть».
export function TextField({ label, error, hint, type = 'text', className, ...props }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-12 text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'h-11 w-full rounded-(--radius-input) border border-input bg-background-secondary px-3 text-14 text-foreground outline-none placeholder:text-muted-foreground focus:border-(--input-border-focus) disabled:bg-(--input-disabled)',
            isPassword && 'pr-11',
            error && 'border-destructive',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {hint}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-12 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
