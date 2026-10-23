'use client';

import { showApiError } from '@/lib/api/errors';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '../api';
import type { Schemas } from '@/lib/api/types';
import { QueryState, SettingsHeading, Toggle } from './fields';

type NotificationType = Schemas['NotificationPreferenceDto']['type'];

const LABELS: Record<string, string> = {
  POST_LIKE: 'Отметки «Нравится» под публикациями',
  COMMENT_LIKE: 'Отметки «Нравится» под комментариями',
  COMMENT: 'Комментарии',
  COMMENT_REPLY: 'Ответы на комментарии',
  MENTION_POST: 'Упоминания в публикациях',
  MENTION_COMMENT: 'Упоминания в комментариях',
  MENTION_STORY: 'Упоминания в историях',
  POST_TAG: 'Отметки на фото',
  FOLLOW: 'Новые подписчики',
  FOLLOW_REQUEST: 'Запросы на подписку',
  FOLLOW_ACCEPTED: 'Принятые запросы на подписку',
  COLLAB_INVITE: 'Приглашения к совместным публикациям',
};

export function NotificationSettings() {
  const { data, isLoading, isError, refetch } = useGetNotificationPreferencesQuery();
  const [update, { isLoading: isSaving }] = useUpdateNotificationPreferencesMutation();

  async function handleChange(type: string, enabled: boolean) {
    try {
      await update([{ type: type as NotificationType, enabled }]).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <div>
      <SettingsHeading>Уведомления</SettingsHeading>
      <QueryState isLoading={isLoading} isError={isError} refetch={refetch}>
        <div className="divide-y divide-separator">
          {data?.map((pref) => (
            <Toggle
              key={pref.type}
              label={LABELS[pref.type] ?? pref.type}
              checked={pref.enabled}
              disabled={isSaving}
              onChange={(enabled) => handleChange(pref.type, enabled)}
            />
          ))}
        </div>
      </QueryState>
    </div>
  );
}
