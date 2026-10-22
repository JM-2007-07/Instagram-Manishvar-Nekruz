'use client';

import { useGetMeQuery, useUpdateMeMutation } from '@/features/profile/api';
import { showApiError } from '@/lib/api/errors';
import type { Settings } from '@/lib/api/types';
import { useGetSettingsQuery, useUpdateSettingsMutation } from '../api';
import { QueryState, Section, SelectField, SettingsHeading, Toggle } from './fields';

const AUDIENCE = [
  { value: 'EVERYONE', label: 'Все' },
  { value: 'FOLLOWING', label: 'Люди, на которых вы подписаны' },
  { value: 'MUTUAL', label: 'Взаимные подписки' },
  { value: 'NO_ONE', label: 'Никто' },
];

type Audience = Settings['commentsFrom'];

export function PrivacySettings() {
  const me = useGetMeQuery();
  const settings = useGetSettingsQuery();
  const [updateMe, { isLoading: isMeSaving }] = useUpdateMeMutation();
  const [updateSettings, { isLoading: isSaving }] = useUpdateSettingsMutation();

  async function save(patch: Parameters<typeof updateSettings>[0]) {
    try {
      await updateSettings(patch).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  async function setPrivate(isPrivate: boolean) {
    try {
      await updateMe({ isPrivate }).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  const s = settings.data;
  return (
    <div>
      <SettingsHeading>Конфиденциальность аккаунта</SettingsHeading>
      <QueryState
        isLoading={me.isLoading || settings.isLoading}
        isError={me.isError || settings.isError}
        refetch={() => {
          void me.refetch();
          void settings.refetch();
        }}
      >
        {me.data && s && (
          <>
            <Section title="Аккаунт">
              <Toggle
                label="Закрытый аккаунт"
                hint="Публикации и истории видят только подписчики, которых вы одобрили."
                checked={me.data.isPrivate}
                onChange={setPrivate}
                disabled={isMeSaving}
              />
            </Section>
            <Section title="Взаимодействия">
              <SelectField
                label="Кто может комментировать"
                options={AUDIENCE}
                value={s.commentsFrom}
                disabled={isSaving}
                onChange={(v) => save({ commentsFrom: v as Audience })}
              />
              <SelectField
                label="Кто может отмечать вас"
                options={AUDIENCE}
                value={s.tagsFrom}
                disabled={isSaving}
                onChange={(v) => save({ tagsFrom: v as Audience })}
              />
              <SelectField
                label="Кто может упоминать вас"
                options={AUDIENCE}
                value={s.mentionsFrom}
                disabled={isSaving}
                onChange={(v) => save({ mentionsFrom: v as Audience })}
              />
            </Section>
            <Section title="Активность">
              <Toggle
                label="Показывать статус активности"
                checked={s.showActivityStatus}
                onChange={(v) => save({ showActivityStatus: v })}
                disabled={isSaving}
              />
              <Toggle
                label="Скрывать число отметок «Нравится»"
                checked={s.hideLikeCounts}
                onChange={(v) => save({ hideLikeCounts: v })}
                disabled={isSaving}
              />
              <Toggle
                label="Разрешить делиться историей"
                checked={s.allowStoryResharing}
                onChange={(v) => save({ allowStoryResharing: v })}
                disabled={isSaving}
              />
            </Section>
          </>
        )}
      </QueryState>
    </div>
  );
}
