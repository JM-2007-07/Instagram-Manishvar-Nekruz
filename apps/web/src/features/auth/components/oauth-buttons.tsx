'use client';

import { buttonVariants } from '@/components/ui/button';
import { useGetOAuthProvidersQuery } from '../api';

// Кнопки соцвхода — только для включённых провайдеров. Это обычная ссылка: браузер уходит на провайдера.
export function OAuthButtons() {
  const { data } = useGetOAuthProvidersQuery();
  if (!data || (!data.google && !data.facebook)) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-separator" />
        <span className="text-12 font-semibold text-muted-foreground">ИЛИ</span>
        <span className="h-px flex-1 bg-separator" />
      </div>
      {data.facebook && <ProviderLink provider="facebook" label="Войти через Facebook" />}
      {data.google && <ProviderLink provider="google" label="Войти через Google" />}
    </div>
  );
}

function ProviderLink({ provider, label }: { provider: string; label: string }) {
  return (
    <a
      href={`/api/v1/auth/oauth/${provider}`}
      className={buttonVariants({ variant: 'secondary', className: 'h-10 w-full' })}
    >
      {label}
    </a>
  );
}
