'use client';

import { useGetOAuthProvidersQuery } from '../api';
import { authButton } from './auth-card';

// Кнопки соцвхода — только для включённых провайдеров. Это обычная ссылка: браузер уходит на провайдера.
export function OAuthButtons() {
  const { data } = useGetOAuthProvidersQuery();
  if (!data || (!data.google && !data.facebook)) return null;

  return (
    <>
      {data.facebook && <ProviderLink provider="facebook" label="Войти через Facebook" />}
      {data.google && <ProviderLink provider="google" label="Войти через Google" />}
    </>
  );
}

function ProviderLink({ provider, label }: { provider: string; label: string }) {
  return (
    <a href={`/api/v1/auth/oauth/${provider}`} className={authButton.secondary}>
      {provider === 'facebook' && (
        <span aria-hidden="true" className="size-4 rounded-full bg-(--facebook)" />
      )}
      {label}
    </a>
  );
}
