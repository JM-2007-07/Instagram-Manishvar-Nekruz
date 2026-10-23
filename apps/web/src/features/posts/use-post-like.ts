'use client';

import { useState } from 'react';
import { useLikePostMutation } from './api';
import type { Post } from './types';

// Лайк оптимистично: меняем локальное состояние сразу, при ошибке откатываем (§6.5).
export function usePostLike(post: Pick<Post, 'id' | 'isLikedByMe' | 'likeCount'>) {
  const [liked, setLiked] = useState(post.isLikedByMe);
  const [count, setCount] = useState(post.likeCount);
  const [likePost] = useLikePostMutation();

  async function setLike(next: boolean) {
    if (next === liked) return;
    const prev = { liked, count };
    setLiked(next);
    setCount((c) => (c === null ? c : c + (next ? 1 : -1)));
    try {
      await likePost({ postId: post.id, liked: next }).unwrap();
    } catch {
      setLiked(prev.liked);
      setCount(prev.count);
    }
  }

  return { liked, count, setLike };
}
