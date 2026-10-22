'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/features/users/components/user-avatar';
import {
  useGetMeQuery,
  useRemoveAvatarMutation,
  useSetAvatarMutation,
  useSetLinksMutation,
  useUpdateMeMutation,
} from '@/features/profile/api';
import { getApiError, showApiError } from '@/lib/api/errors';
import type { Me } from '@/lib/api/types';
import { uploadMedia } from '@/lib/api/upload';
import { AccountIdentityForms } from './account-identity-forms';
import { QueryState, Section, SelectField, SettingsHeading, TextField } from './fields';

const BIO_MAX = 150;
const LINKS_MAX = 5;

const GENDERS = [
  { value: '', label: 'Не указан' },
  { value: 'FEMALE', label: 'Женский' },
  { value: 'MALE', label: 'Мужской' },
  { value: 'CUSTOM', label: 'Другое' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Не хочу указывать' },
];

type Gender = NonNullable<Me['gender']>;

function AvatarSection({ me }: { me: Me }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [setAvatar] = useSetAvatarMutation();
  const [removeAvatar, { isLoading: isRemoving }] = useRemoveAvatarMutation();
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFile(file: File) {
    try {
      setProgress(0);
      const media = (await uploadMedia(file, 'AVATAR', setProgress)) as { id: string };
      await setAvatar(media.id).unwrap();
      toast.success('Фото профиля обновлено');
    } catch (error) {
      showApiError(error);
    } finally {
      setProgress(null);
    }
  }

  async function handleRemove() {
    try {
      await removeAvatar().unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-background-secondary p-4">
      <UserAvatar user={me} size={56} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-14 font-semibold">{me.userName}</div>
        <div className="truncate text-14 text-muted-foreground">{me.fullName}</div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Выберите файл с фото"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => fileRef.current?.click()} disabled={progress !== null}>
          {progress !== null ? `Загрузка ${progress}%` : 'Загрузить фото'}
        </Button>
        {me.avatarUrl && (
          <Button variant="secondary" onClick={handleRemove} disabled={isRemoving}>
            Удалить текущее фото
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfileFields({ me }: { me: Me }) {
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const [fullName, setFullName] = useState(me.fullName);
  const [pronouns, setPronouns] = useState(me.pronouns ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [gender, setGender] = useState<string>(me.gender ?? '');
  const [genderCustom, setGenderCustom] = useState(me.genderCustom ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    try {
      await updateMe({
        fullName,
        pronouns: pronouns || null,
        bio: bio || null,
        gender: (gender || null) as Gender | null,
        genderCustom: gender === 'CUSTOM' ? genderCustom || null : null,
      }).unwrap();
      toast.success('Профиль сохранён');
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.code === 'VALIDATION_ERROR' && apiError.details?.length) {
        setErrors(Object.fromEntries(apiError.details.map((d) => [d.field, d.message])));
      } else {
        showApiError(error);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label="Имя"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        maxLength={64}
        required
        error={errors.fullName}
      />
      <TextField
        label="Местоимения"
        value={pronouns}
        onChange={(e) => setPronouns(e.target.value)}
        maxLength={50}
        error={errors.pronouns}
      />
      <div>
        <TextField
          label="О себе"
          multiline
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX}
          error={errors.bio}
        />
        <div className="mt-1 text-right text-12 text-muted-foreground" aria-live="polite">
          {bio.length} / {BIO_MAX}
        </div>
      </div>
      <SelectField label="Пол" options={GENDERS} value={gender} onChange={setGender} />
      {gender === 'CUSTOM' && (
        <TextField
          label="Укажите свой вариант"
          value={genderCustom}
          onChange={(e) => setGenderCustom(e.target.value)}
          error={errors.genderCustom}
        />
      )}
      <Button type="submit" disabled={isLoading || !fullName.trim()}>
        Отправить
      </Button>
    </form>
  );
}

function LinksForm({ me }: { me: Me }) {
  const [setLinks, { isLoading }] = useSetLinksMutation();
  const [rows, setRows] = useState(me.links.map((l) => ({ url: l.url, title: l.title ?? '' })));

  function change(index: number, key: 'url' | 'title', value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await setLinks(
        rows
          .filter((r) => r.url.trim())
          .map((r) => ({ url: r.url.trim(), title: r.title || null })),
      ).unwrap();
      toast.success('Ссылки сохранены');
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField
            label={`Ссылка ${i + 1}`}
            type="url"
            placeholder="https://"
            value={row.url}
            onChange={(e) => change(i, 'url', e.target.value)}
          />
          <TextField
            label="Название"
            maxLength={30}
            value={row.title}
            onChange={(e) => change(i, 'title', e.target.value)}
          />
          <Button
            variant="secondary"
            aria-label={`Удалить ссылку ${i + 1}`}
            onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
          >
            Удалить
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        {rows.length < LINKS_MAX && (
          <Button
            variant="secondary"
            onClick={() => setRows((prev) => [...prev, { url: '', title: '' }])}
          >
            Добавить ссылку
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          Сохранить ссылки
        </Button>
      </div>
    </form>
  );
}

export function EditProfileForm() {
  const { data: me, isLoading, isError, refetch } = useGetMeQuery();
  return (
    <div>
      <SettingsHeading>Редактировать профиль</SettingsHeading>
      <QueryState isLoading={isLoading} isError={isError} refetch={refetch}>
        {me && (
          <div key={me.id}>
            <div className="mb-8">
              <AvatarSection me={me} />
            </div>
            <Section title="Профиль">
              <ProfileFields me={me} />
            </Section>
            <Section title="Ссылки">
              <LinksForm me={me} />
            </Section>
            <AccountIdentityForms me={me} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
