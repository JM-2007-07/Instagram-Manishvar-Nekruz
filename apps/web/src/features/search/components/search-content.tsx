'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, Hash, MapPin, X } from 'lucide-react';
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
  useAddSearchHistoryMutation,
  useClearSearchHistoryMutation,
  useGetSearchHistoryInfiniteQuery,
  useRemoveSearchHistoryEntryMutation,
  useSearchQuery,
} from '../api';

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

// Содержимое панели «Поиск» (десктоп) и страницы /explore/search/ (мобильный).
// Пустое поле — «Недавнее»; ввод (через ~300 мс) — аккаунты, хэштеги, места.
export function SearchContent({ onNavigate }: { onNavigate?: () => void }) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim().slice(0, MAX_QUERY), 300);
  const typing = text.trim().length > 0;
  const showResults = typing && q.length > 0;

  const results = useSearchQuery(q, { skip: !showResults });
  const history = useGetSearchHistoryInfiniteQuery(undefined, { skip: typing });
  const [addHistory] = useAddSearchHistoryMutation();
  const [removeEntry] = useRemoveSearchHistoryEntryMutation();
  const [clearHistory, { isLoading: clearing }] = useClearSearchHistoryMutation();

  function remember(body: Parameters<typeof addHistory>[0]) {
    void addHistory(body); // запись истории второстепенна: ошибка не должна мешать переходу
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
    if (q !== text.trim().slice(0, MAX_QUERY) || results.isLoading)
      return <UserListSkeleton rows={5} />;
    if (results.isError)
      return <ListError error={results.error} onRetry={() => results.refetch()} />;
    const { users, hashtags, locations } = results.data ?? {
      users: [],
      hashtags: [],
      locations: [],
    };
    if (users.length + hashtags.length + locations.length === 0)
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
        {hashtags.map((tag) => (
          <PlainRow
            key={tag.name}
            href={hashtagHref(tag)}
            icon={<Hash className="size-5" />}
            title={`#${tag.name}`}
            subtitle={postsCount(tag.postCount)}
            onClick={() => remember({ type: 'HASHTAG', hashtagName: tag.name })}
          />
        ))}
        {locations.map((place) => (
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

  return (
    <div className="flex flex-col">
      <form onSubmit={handleSubmit} className="px-4 pb-3">
        <SearchField
          value={text}
          onChange={(value) => setText(value.slice(0, MAX_QUERY))}
          label="Поисковый запрос"
          placeholder="Поисковый запрос"
        />
      </form>
      <div>{typing ? renderResults() : renderHistory()}</div>
    </div>
  );
}
