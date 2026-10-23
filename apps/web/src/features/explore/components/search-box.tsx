'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Hash, MapPin, Search, X } from 'lucide-react';
import { UserAvatar } from '@/components/temp/student-a';
import { DESIGN } from '@/lib/design';
import {
  useAddSearchHistoryMutation,
  useClearSearchHistoryMutation,
  useGetSearchHistoryQuery,
  useRemoveSearchHistoryEntryMutation,
  useSearchQuery,
  type AddSearchHistory,
} from '../api';
import type { Schemas } from '@/lib/api/types';

type User = Schemas['UserSummaryDto'];
type Tag = Schemas['HashtagDto'];
type Place = Schemas['LocationDto'];

// Строка результата: ссылка + запись в историю по клику.
function Row({
  href,
  icon,
  title,
  subtitle,
  onPick,
  onRemove,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center hover:bg-hover-overlay">
      <Link
        href={href}
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2"
      >
        {icon}
        <span className="min-w-0">
          <span className="block truncate text-14 font-semibold">{title}</span>
          {subtitle && (
            <span className="block truncate text-14 text-muted-foreground">{subtitle}</span>
          )}
        </span>
      </Link>
      {onRemove && (
        <button
          type="button"
          aria-label="Удалить из истории"
          onClick={onRemove}
          className="px-4 py-2"
        >
          <X className="size-4 text-icon-secondary" />
        </button>
      )}
    </div>
  );
}

const circle =
  'flex size-11 shrink-0 items-center justify-center rounded-full border border-stroke bg-background-secondary';

// Строка поиска «Интересного» с выпадающей панелью (F-SRC-02, F-SRC-03).
export function SearchBox() {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Задержка 300 мс: запрос уходит, когда пользователь перестал печатать.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  // Клик вне блока закрывает панель.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const searching = text.trim().length > 0;
  const results = useSearchQuery(debounced, { skip: !debounced || !searching });
  const history = useGetSearchHistoryQuery(undefined, { skip: !open || searching });
  const [add] = useAddSearchHistoryMutation();
  const [remove] = useRemoveSearchHistoryEntryMutation();
  const [clear] = useClearSearchHistoryMutation();

  const pick = (body: AddSearchHistory) => {
    setOpen(false);
    add(body);
  };

  const entries = history.data?.items ?? [];
  const found = results.data;
  const nothing = found && !found.users.length && !found.hashtags.length && !found.locations.length;

  return (
    <div
      ref={box}
      className="relative mx-4 w-auto md:mx-auto md:w-full"
      style={{ maxWidth: DESIGN.searchWidth }}
    >
      <div
        className="flex items-center gap-3 rounded-[25px] bg-background-secondary px-4"
        style={{ height: DESIGN.searchHeight }}
      >
        <Search className="size-4 shrink-0 text-icon-secondary" aria-hidden />
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Поиск"
          aria-label="Поиск"
          maxLength={50}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-20 max-h-[480px] overflow-y-auto rounded-lg bg-background-elevated py-2 shadow-[var(--shadow-strong)]">
          {!searching && (
            <>
              <div className="flex items-center justify-between px-4 py-2">
                <h2 className="text-base font-semibold">Недавнее</h2>
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clear()}
                    className="text-14 font-semibold text-link"
                  >
                    Очистить все
                  </button>
                )}
              </div>
              {entries.length === 0 && !history.isLoading && (
                <p className="px-4 py-6 text-center text-14 text-muted-foreground">
                  Нет недавних запросов.
                </p>
              )}
              {entries.map((e) => {
                const del = () => remove(e.id);
                if (e.user)
                  return (
                    <Row
                      key={e.id}
                      href={`/${e.user.userName}/`}
                      onPick={() => setOpen(false)}
                      onRemove={del}
                      icon={<UserAvatar user={e.user} size={44} ring={false} />}
                      title={e.user.userName}
                      subtitle={e.user.fullName}
                    />
                  );
                if (e.hashtag)
                  return (
                    <Row
                      key={e.id}
                      href={`/explore/tags/${e.hashtag.name}/`}
                      onPick={() => setOpen(false)}
                      onRemove={del}
                      icon={
                        <span className={circle}>
                          <Hash className="size-5" />
                        </span>
                      }
                      title={`#${e.hashtag.name}`}
                      subtitle={`${e.hashtag.postCount} публикаций`}
                    />
                  );
                if (e.location)
                  return (
                    <Row
                      key={e.id}
                      href={`/explore/locations/${e.location.id}/${e.location.slug}/`}
                      onPick={() => setOpen(false)}
                      onRemove={del}
                      icon={
                        <span className={circle}>
                          <MapPin className="size-5" />
                        </span>
                      }
                      title={e.location.name}
                      subtitle={e.location.city}
                    />
                  );
                return (
                  <Row
                    key={e.id}
                    href={`/explore/`}
                    onPick={() => setText(e.query ?? '')}
                    onRemove={del}
                    icon={
                      <span className={circle}>
                        <Search className="size-5" />
                      </span>
                    }
                    title={e.query ?? ''}
                  />
                );
              })}
            </>
          )}

          {searching && (
            <>
              {results.isFetching && !found && (
                <p className="px-4 py-6 text-center text-14 text-muted-foreground">Поиск…</p>
              )}
              {nothing && (
                <p className="px-4 py-6 text-center text-14 text-muted-foreground">
                  Ничего не найдено.
                </p>
              )}
              {found?.users.map((u: User) => (
                <Row
                  key={u.id}
                  href={`/${u.userName}/`}
                  onPick={() => pick({ type: 'USER', userId: u.id })}
                  icon={<UserAvatar user={u} size={44} ring={false} />}
                  title={u.userName}
                  subtitle={u.fullName}
                />
              ))}
              {found?.hashtags.map((t: Tag) => (
                <Row
                  key={t.name}
                  href={`/explore/tags/${t.name}/`}
                  onPick={() => pick({ type: 'HASHTAG', hashtagName: t.name })}
                  icon={
                    <span className={circle}>
                      <Hash className="size-5" />
                    </span>
                  }
                  title={`#${t.name}`}
                  subtitle={`${t.postCount} публикаций`}
                />
              ))}
              {found?.locations.map((l: Place) => (
                <Row
                  key={l.id}
                  href={`/explore/locations/${l.id}/${l.slug}/`}
                  onPick={() => pick({ type: 'LOCATION', locationId: l.id })}
                  icon={
                    <span className={circle}>
                      <MapPin className="size-5" />
                    </span>
                  }
                  title={l.name}
                  subtitle={l.city}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
