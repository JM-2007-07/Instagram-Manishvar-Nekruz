'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { showApiError } from '@/lib/api/errors';
import { useGetSavedInfiniteQuery, useSavePostMutation } from '../api';
import { PostGrid } from './post-grid';
import { SavedEmpty, SavedError, SavedOwnerGate, SavedSkeleton } from './saved-states';

function AllPostsContent() {
  const { data, isLoading, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGetSavedInfiniteQuery();
  const [savePost] = useSavePostMutation();

  if (isLoading) return <SavedSkeleton />;
  if (isError) return <SavedError onRetry={() => void refetch()} />;

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  if (posts.length === 0) {
    return (
      <SavedEmpty
        title="Сохранённых публикаций нет"
        text="Нажмите на закладку под публикацией, чтобы сохранить её."
      />
    );
  }

  return (
    <PostGrid
      posts={posts}
      removeLabel="Удалить из сохранённого"
      onRemove={(post) =>
        savePost({ postId: post.id, saved: false })
          .unwrap()
          .catch((error) => showApiError(error))
      }
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}

export function AllPostsPage({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-[935px] px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/${username}/saved/`} aria-label="Назад к сохранённому">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-20 font-semibold">Все публикации</h1>
      </div>
      <SavedOwnerGate username={username}>
        <AllPostsContent />
      </SavedOwnerGate>
    </div>
  );
}
