'use client';

// ЗАГЛУШКА интерфейса для окна поста (T3.B1). Реализация — T3.B5 (агент comments) заменяет тело, сигнатуры не меняет.
import type { Post } from '@/features/posts/types';

type FormProps = { post: Post; variant?: 'dialog' | 'card'; autoFocus?: boolean };

/** Общий контекст ответа: «Ответить» в списке подставляет @имя в CommentForm. Оборачивает список и форму. */
export function CommentThreadProvider({ children }: { postId: string; children: React.ReactNode }) {
  return <>{children}</>;
}

/** Список комментариев с ответами в окне поста (без подписи автора — её рисует окно поста). */
export function PostComments(props: { post: Post }) {
  void props;
  return null;
}

/** Поле «Добавьте комментарий…» с эмодзи и «Опубликовать». variant card — в карточке ленты. */
export function CommentForm(props: FormProps) {
  void props;
  return null;
}
