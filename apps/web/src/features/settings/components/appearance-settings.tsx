'use client';

import { showApiError } from '@/lib/api/errors';
import type { Settings } from '@/lib/api/types';
import { setTheme } from '@/lib/theme';
import { useGetSettingsQuery, useUpdateSettingsMutation } from '../api';
import { QueryState, Section, SelectField, SettingsHeading } from './fields';

const THEMES = [
  { value: 'SYSTEM', label: 'Как в системе' },
  { value: 'LIGHT', label: 'Светлая' },
  { value: 'DARK', label: 'Тёмная' },
];

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

export function AppearanceSettings() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateSettingsMutation();

  async function save(patch: Parameters<typeof updateSettings>[0]) {
    try {
      await updateSettings(patch).unwrap();
      // Cookie темы нужна, чтобы страница рисовалась без мигания (settings.md).
      if (patch.theme) setTheme(patch.theme.toLowerCase() as 'light' | 'dark' | 'system');
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <div>
      <SettingsHeading>Тема и язык</SettingsHeading>
      <QueryState isLoading={isLoading} isError={isError} refetch={refetch}>
        {data && (
          <Section title="Оформление">
            <SelectField
              label="Тема"
              options={THEMES}
              value={data.theme}
              disabled={isSaving}
              onChange={(v) => save({ theme: v as Settings['theme'] })}
            />
            <SelectField
              label="Язык"
              options={LANGUAGES}
              value={data.language}
              disabled={isSaving}
              onChange={(v) => save({ language: v as Settings['language'] })}
            />
          </Section>
        )}
      </QueryState>
    </div>
  );
}
