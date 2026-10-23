'use client';

import { useGetCurrentUserQuery } from '@/features/posts/api';
import { useEffect, useState } from 'react';
import { Accessibility, ChevronDown, MapPin, UserPlus, X } from 'lucide-react';
import { UserAvatar } from '@/components/temp/student-a';
import type { Location } from '@/features/posts/types';
import { useSearchLocationsQuery, useSearchUsersQuery } from '../api';
import { CAPTION_LIMIT, type DraftItem, type DraftTag } from '../types';

// Задержка ввода перед поиском (не загрузка данных, а только отложенное значение).
function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export type CaptionState = {
  caption: string;
  location: Location | null;
  hideLikeCount: boolean;
  commentsDisabled: boolean;
};

const rowClass =
  'flex w-full items-center justify-between border-b border-border px-4 py-3 text-16 text-foreground';

const inputClass =
  'h-9 w-full rounded-lg bg-secondary px-3 text-14 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring';

// Раскрывающаяся строка настроек.
function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={rowClass}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <ChevronDown className={`size-4 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="border-b border-border px-4 py-3">{children}</div>}
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-14">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-secondary'}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

// Правая колонка шага «Подпись»: подпись, место, отметки, alt-текст, расширенные настройки.
export function CaptionPanel({
  state,
  onState,
  items,
  index,
  onAlt,
  onTags,
}: {
  state: CaptionState;
  onState: (s: CaptionState) => void;
  items: DraftItem[];
  index: number;
  onAlt: (i: number, text: string) => void;
  onTags: (i: number, tags: DraftTag[]) => void;
}) {
  const { data: me } = useGetCurrentUserQuery();
  const [placeQuery, setPlaceQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const placeQ = useDebounced(placeQuery.trim());
  const userQ = useDebounced(userQuery.trim());
  const places = useSearchLocationsQuery(placeQ, { skip: !placeQ });
  const users = useSearchUsersQuery(userQ, { skip: !userQ });
  const tags = items[index].tags;

  return (
    <div className="flex min-w-0 flex-col overflow-y-auto">
      {me && (
        <div className="flex items-center gap-3 px-4 py-3">
          <UserAvatar user={me} size={28} ring={false} />
          <span className="text-14 font-semibold">{me.userName}</span>
        </div>
      )}
      <div className="px-4">
        <textarea
          aria-label="Подпись"
          placeholder="Добавьте подпись…"
          value={state.caption}
          maxLength={CAPTION_LIMIT}
          onChange={(e) => onState({ ...state, caption: e.target.value })}
          className="h-[168px] w-full resize-none bg-transparent text-16 outline-none placeholder:text-muted-foreground"
        />
        <p className="pb-2 text-right text-12 text-muted-foreground">
          {state.caption.length}/2 200
        </p>
      </div>

      <Section title="Добавить место" icon={<MapPin className="size-4" />}>
        {state.location ? (
          <div className="flex items-center justify-between text-14">
            <span>{state.location.name}</span>
            <button
              type="button"
              aria-label="Убрать место"
              onClick={() => onState({ ...state, location: null })}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <input
              aria-label="Поиск места"
              placeholder="Найти место"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              className={inputClass}
            />
            <ul className="mt-2">
              {places.data?.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full py-1.5 text-left text-14 hover:bg-hover-overlay"
                    onClick={() => onState({ ...state, location: p })}
                  >
                    {p.name}
                    <span className="block text-12 text-muted-foreground">
                      {[p.city, p.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Отметить людей" icon={<UserPlus className="size-4" />}>
        <p className="pb-2 text-12 text-muted-foreground">Отметки для файла {index + 1}</p>
        <div className="flex flex-wrap gap-2 pb-2">
          {tags.map((t) => (
            <span
              key={t.userId}
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-12"
            >
              {t.userName}
              <button
                type="button"
                aria-label={`Убрать отметку ${t.userName}`}
                onClick={() =>
                  onTags(
                    index,
                    tags.filter((x) => x.userId !== t.userId),
                  )
                }
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          aria-label="Поиск людей"
          placeholder="Найти человека"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          className={inputClass}
        />
        <ul className="mt-2">
          {users.data?.items
            .filter((u) => !tags.some((t) => t.userId === u.id))
            .map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 py-1.5 text-left text-14 hover:bg-hover-overlay"
                  onClick={() => {
                    // Координаты клика не собираем — отметка по центру.
                    onTags(index, [
                      ...tags,
                      { userId: u.id, userName: u.userName, x: 0.5, y: 0.5 },
                    ]);
                    setUserQuery('');
                  }}
                >
                  <UserAvatar user={u} size={32} ring={false} />
                  <span>
                    {u.userName}
                    <span className="block text-12 text-muted-foreground">{u.fullName}</span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </Section>

      <Section title="Специальные возможности" icon={<Accessibility className="size-4" />}>
        <p className="pb-2 text-12 text-muted-foreground">
          Альтернативный текст описывает фото для людей с нарушениями зрения.
        </p>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <label key={it.key} className="flex items-center gap-2">
              {!it.isVideo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt="" className="size-11 shrink-0 rounded object-cover" />
              )}
              <input
                aria-label={`Альтернативный текст, файл ${i + 1}`}
                placeholder="Напишите альтернативный текст…"
                value={it.altText}
                onChange={(e) => onAlt(i, e.target.value)}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Расширенные настройки">
        <Switch
          label="Скрыть число отметок «Нравится»"
          checked={state.hideLikeCount}
          onChange={(v) => onState({ ...state, hideLikeCount: v })}
        />
        <Switch
          label="Отключить комментирование"
          checked={state.commentsDisabled}
          onChange={(v) => onState({ ...state, commentsDisabled: v })}
        />
      </Section>
    </div>
  );
}
