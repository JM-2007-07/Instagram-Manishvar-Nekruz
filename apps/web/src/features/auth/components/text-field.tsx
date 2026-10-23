'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = Omit<React.ComponentProps<'input'>, 'id' | 'placeholder'> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
};

// Поле как у Instagram: рамка 60 px, скругление 16, подпись внутри поля.
// Пустое поле без фокуса — подпись по центру; при вводе она уменьшается и уходит наверх.
// Пароль (type="password") получает кнопку «показать/скрыть».
export function TextField({ label, error, hint, type = 'text', className, ...props }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'relative h-[60px] rounded-2xl border-[0.8px] border-auth-field-border bg-transparent focus-within:border-auth-field-border-focus',
          error && 'border-destructive focus-within:border-destructive',
        )}
      >
        <input
          id={id}
          type={isPassword && shown ? 'text' : type}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'peer absolute inset-0 h-full w-full rounded-2xl bg-transparent px-[17px] pt-[18px] text-15 font-medium text-auth-text outline-none',
            isPassword && 'pr-12',
            className,
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute top-2 left-[17px] max-w-[calc(100%-34px)] truncate text-12 text-auth-label transition-all duration-200 ease-(--ease-move)',
            'peer-placeholder-shown:top-[19px] peer-placeholder-shown:text-15 peer-placeholder-shown:font-medium',
            'peer-focus:top-2 peer-focus:text-12 peer-focus:font-normal',
            isPassword && 'max-w-[calc(100%-64px)]',
          )}
        >
          {label}
        </label>
        {isPassword && props.value !== '' && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute inset-y-0 right-2 flex w-10 items-center justify-center text-auth-text outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {hint}
      {error && (
        <p id={`${id}-error`} role="alert" className="px-1 text-12 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
