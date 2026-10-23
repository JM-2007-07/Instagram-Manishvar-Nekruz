'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, Hash, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/features/users/components/search-field';
import {
  EmptyMessage,
  ListError,
  LoadMore,
  UserListSkeleton,
} from '@/features/users/components/list-states';
import { UserListItem } from '@/features/users/components/user-list-item';
import { useDebouncedValue } from '@/features/users/use-debounced-value';
import type { Hashtag, Location, SearchHistoryEntry } from '@/lib/api/types';
import {
  useAddRecentSearchMutation,
  useClearRecentSearchesMutation,
  useGetRecentSearchesInfiniteQuery,
  useFindHashtagsQuery,
  useFindLocationsQuery,
  useRemoveRecentSearchMutation,
} from '../api';
import { useAccountSearch } from '../user-search';

const MAX_QUERY = 50;

// «1 публикация», «2 публикации», «5 публикаций»
export function postsCount(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} публикация`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} публикации`;
  return `${n} публикаций`;
}

const hashtagHref = (tag: Hashtag) => `/explore/tags/${encodeURIComponent(tag.name)}/`;
const locationHref = (place: Location) => `/explore/locations/${place.id}/${place.slug}/`;

// Строка хэштега или места: круглая иконка, заголовок, подпись.
function PlainRow({
  href,
  icon,
  title,
  subtitle,
  onClick,
  trailing,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Link
        href={href}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border">
          {icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-14 font-semibold">{title}</span>
          {subtitle ? (
            <span className="truncate text-14 text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      </Link>
      {trailing}
    </div>
  );
}

function RemoveEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Удалить из недавнего"
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground outline-none hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="size-4" />
    </button>
  );
}

// Содержимое панели «Поиск» (десктоп), страницы /explore/search/ (мобильный) и поиска на «Интересном».
// Пустое поле — «Недавнее» (или idle, например сетка «Интересного»); ввод (через ~300 мс) — аккаунты
// (TanStack Query), хэштеги и места (RTK Query).
export function SearchContent({
  onNavigate,
  idle,
  autoFocus,
}: {
  onNavigate?: () => void;
  /**
   * Вид «Интересного» (сверено с instagram.com 2026-10-23): поле «Поиск» над сеткой (idle). Фокус на поле —
   * режим поиска: сетка скрывается, слева от поля «‹», ниже «Недавнее» или результаты; «‹» или Esc — назад к сетке.
   */
  idle?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim().slice(0, MAX_QUERY), 300);
  const typing = text.trim().length > 0;
  const showResults = typing && q.length > 0;
  const dropdown = !!idle; // вид «Интересного»
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Выход из режима поиска: поле очищается, снова видна сетка.
  function closeSearch() {
    setOpen(false);
    setText('');
    box.current?.querySelector('input')?.blur();
  }
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSearch();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const accounts = useAccountSearch(showResults ? q : '');
  const hashtags = useFindHashtagsQuery(q, { skip: !showResults });
  const locations = useFindLocationsQuery(q, { skip: !showResults });
  const history = useGetRecentSearchesInfiniteQuery(undefined, {
    skip: typing || (dropdown && !open),
  });
  const [addHistory] = useAddRecentSearchMutation();
  const [removeEntry] = useRemoveRecentSearchMutation();
  const [clearHistory, { isLoading: clearing }] = useClearRecentSearchesMutation();

  function remember(body: Parameters<typeof addHistory>[0]) {
    void addHistory(body); // запись истории второстепенна: ошибка не должна мешать переходу
    setOpen(false);
    onNavigate?.();
  }

  // Enter — запрос уходит в историю (тип QUERY).
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = text.trim().slice(0, MAX_QUERY);
    if (query) void addHistory({ type: 'QUERY', query });
  }

  function renderHistoryEntry(entry: SearchHistoryEntry) {
    const remove = <RemoveEntryButton onClick={() => void removeEntry(entry.id)} />;
    if (entry.type === 'USER' && entry.user) {
      return (
        <div key={entry.id} className="flex items-center pr-2">
          <div className="min-w-0 flex-1">
            <UserListItem user={entry.user} onNavigate={onNavigate} />
          </div>
          {remove}
        </div>
      );
    }
    if (entry.type === 'HASHTAG' && entry.hashtag) {
      return (
        <PlainRow
          key={entry.id}
          href={hashtagHref(entry.hashtag)}
          icon={<Hash className="size-5" />}
          title={`#${entry.hashtag.name}`}
          subtitle={postsCount(entry.hashtag.postCount)}
          onClick={onNavigate}
          trailing={remove}
        />
      );
    }
    if (entry.type === 'LOCATION' && entry.location) {
      return (
        <PlainRow
          key={entry.id}
          href={locationHref(entry.location)}
          icon={<MapPin className="size-5" />}
          title={entry.location.name}
          subtitle={entry.location.city}
          onClick={onNavigate}
          trailing={remove}
        />
      );
    }
    if (entry.type === 'QUERY' && entry.query) {
      const query = entry.query;
      return (
        <div key={entry.id} className="flex items-center gap-3 px-4 py-2">
          <button
            type="button"
            onClick={() => setText(query)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border">
              <Clock className="size-5" />
            </span>
            <span className="truncate text-14 font-semibold">{query}</span>
          </button>
          {remove}
        </div>
      );
    }
    return null;
  }

  function renderHistory() {
    if (history.isLoading) return <UserListSkeleton rows={5} />;
    if (history.isError)
      return <ListError error={history.error} onRetry={() => history.refetch()} />;
    const entries = history.data?.pages.flatMap((p) => p.items) ?? [];
    if (entries.length === 0) return <EmptyMessage>Нет недавних запросов</EmptyMessage>;
    return (
      <>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h3 className="text-16 leading-5 font-semibold">Недавнее</h3>
          <Button
            variant="link"
            disabled={clearing}
            onClick={() => void clearHistory()}
            className="h-auto p-0 font-medium text-link"
          >
            Очистить все
          </Button>
        </div>
        {entries.map(renderHistoryEntry)}
        <LoadMore
          hasNextPage={history.hasNextPage}
          isFetching={history.isFetchingNextPage}
          onLoad={() => history.fetchNextPage()}
        />
      </>
    );
  }

  function renderResults() {
    // Пока ждём ответ на новый запрос или идёт debounce — показываем скелетон.
    const pending = accounts.isPending || hashtags.isLoading || locations.isLoading;
    if (q !== text.trim().slice(0, MAX_QUERY) || (pending && !accounts.data))
      return <UserListSkeleton rows={5} />;
    // Аккаунты — главное: их ошибка показывается; хэштеги и места просто пропадают.
    if (accounts.isError)
      return <ListError error={accounts.error} onRetry={() => void accounts.refetch()} />;
    const users = accounts.data?.items ?? [];
    const tags = hashtags.data?.items ?? [];
    const places = locations.data?.items ?? [];
    if (users.length + tags.length + places.length === 0)
      return <EmptyMessage>Ничего не найдено</EmptyMessage>;
    return (
      <>
        {users.map((user) => (
          <UserListItem
            key={user.id}
            user={user}
            onNavigate={() => remember({ type: 'USER', userId: user.id })}
          />
        ))}
        {tags.map((tag) => (
          <PlainRow
            key={tag.name}
            href={hashtagHref(tag)}
            icon={<Hash className="size-5" />}
            title={`#${tag.name}`}
            subtitle={postsCount(tag.postCount)}
            onClick={() => remember({ type: 'HASHTAG', hashtagName: tag.name })}
          />
        ))}
        {places.map((place) => (
          <PlainRow
            key={place.id}
            href={locationHref(place)}
            icon={<MapPin className="size-5" />}
            title={place.name}
            subtitle={[place.city, place.country].filter(Boolean).join(', ')}
            onClick={() => remember({ type: 'LOCATION', locationId: place.id })}
          />
        ))}
      </>
    );
  }

  if (dropdown) {
    // Размеры с instagram.com (1366 px): поле 40 px, над сеткой — 56 % её ширины; в режиме поиска
    // колонка 552 px: «‹» 24 px, поле 500 px, строки 60 px.
    return (
      <div ref={box} className="flex flex-col">
        <div
          className={
            open
              ? 'mx-auto flex w-full max-w-[552px] items-center gap-3 px-4 md:px-2'
              : 'mx-auto w-full px-4 md:w-[56%] md:px-0'
          }
        >
          {open && (
            <button
              type="button"
              aria-label="Назад"
              onClick={closeSearch}
              className="flex size-6 shrink-0 items-center justify-center"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}
          <form onSubmit={handleSubmit} className="min-w-0 flex-1">
            <SearchField
              value={text}
              onChange={(value) => {
                setText(value.slice(0, MAX_QUERY));
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              label="Поиск"
              placeholder="Поиск"
              autoFocus={autoFocus}
            />
          </form>
        </div>
        {open ? (
          <div className="mx-auto mt-5 w-full max-w-[552px]">
            {typing ? renderResults() : renderHistory()}
          </div>
        ) : (
          <div className="mt-6">{idle}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <form onSubmit={handleSubmit} className="px-4 pb-3">
        <SearchField
          value={text}
          onChange={(value) => setText(value.slice(0, MAX_QUERY))}
          label="Поисковый запрос"
          placeholder="Поисковый запрос"
          autoFocus={autoFocus}
        />
      </form>
      <div>{typing ? renderResults() : renderHistory()}</div>
    </div>
  );
}
