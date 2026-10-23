'use client';

import Link from 'next/link';
import { Camera, Clapperboard, Copy, Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Schemas } from '@/lib/api/types';
import { DESIGN } from '@/lib/design';
import { EmptyOrError } from './empty-or-error';

type Post = Schemas['PostDto'];

type Props = {
  pages: { items: Post[] }[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  emptyTitle: string;
  emptyHint?: string;
};

function Tile({ post }: { post: Post }) {
  const first = post.items[0]?.media;
  const preview = first?.thumbnailUrl ?? (first?.kind === 'IMAGE' ? first.url : null);
  return (
    <Link
      href={`/p/${post.shortcode}/`}
      className="group relative block aspect-[3/4] overflow-hidden bg-background-secondary"
      aria-label={post.caption ? post.caption.slice(0, 80) : 'Открыть публикацию'}
    >
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={post.items[0]?.altText ?? 'Публикация'}
          className="size-full object-cover"
          loading="lazy"
        />
      )}
      <span className="absolute top-2 right-2 text-white">
        {post.type === 'REEL' ? (
          <Clapperboard className="size-5" />
        ) : post.items.length > 1 ? (
          <Copy className="size-5" />
        ) : null}
      </span>
      <span className="absolute inset-0 hidden items-center justify-center gap-6 bg-black/30 font-semibold text-white group-focus-visible:flex group-hover:flex">
        {post.likeCount !== null && (
          <span className="flex items-center gap-1">
            <Heart className="size-5 fill-current" /> {post.likeCount}
          </span>
        )}
        <span className="flex items-center gap-1">
          <MessageCircle className="size-5 fill-current" /> {post.commentCount}
        </span>
      </span>
    </Link>
  );
}

export function PostTiles(props: Props) {
  const { pages, isLoading, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    props;
  const posts = pages?.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-3" style={{ gap: DESIGN.gridGap }} aria-busy="true">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse bg-background-secondary" />
        ))}
      </div>
    );
  }
  if (isError) return <EmptyOrError onRetry={refetch} />;
  if (posts.length === 0) {
    return <EmptyOrError icon={Camera} title={props.emptyTitle} hint={props.emptyHint} />;
  }
  return (
    <>
      <div className="grid grid-cols-3" style={{ gap: DESIGN.gridGap }}>
        {posts.map((post) => (
          <Tile key={post.id} post={post} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center py-6">
          <Button variant="secondary" onClick={fetchNextPage} disabled={isFetchingNextPage}>
            Показать ещё
          </Button>
        </div>
      )}
    </>
  );
}
