'use client';

import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import { useGetSessionsQuery, useRevokeSessionMutation } from '../api';
import { QueryState, SettingsHeading } from './fields';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

export function SessionsList() {
  const { data, isLoading, isError, refetch } = useGetSessionsQuery();
  const [revoke, { isLoading: isRevoking }] = useRevokeSessionMutation();

  async function handleRevoke(id: string) {
    try {
      await revoke(id).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <div>
      <SettingsHeading>Сессии</SettingsHeading>
      <QueryState isLoading={isLoading} isError={isError} refetch={refetch}>
        {data?.length === 0 ? (
          <p className="text-14 text-muted-foreground">Активных сессий нет</p>
        ) : (
          <ul className="divide-y divide-separator">
            {data?.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-14 font-semibold">
                    {s.userAgent ?? 'Неизвестное устройство'}
                    {s.isCurrent && <span className="ml-2 text-success">Это устройство</span>}
                  </div>
                  <div className="text-12 text-muted-foreground">
                    {s.ipCity ? `${s.ipCity} · ` : ''}Вход: {formatDate(s.createdAt)} · Активность:{' '}
                    {formatDate(s.lastUsedAt)}
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button
                    variant="secondary"
                    disabled={isRevoking}
                    onClick={() => handleRevoke(s.id)}
                  >
                    Завершить
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
