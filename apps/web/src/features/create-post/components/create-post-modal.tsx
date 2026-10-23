'use client';

import { useRouter } from 'next/navigation';
import { CreatePostDialog } from './create-post-dialog';

// Окно поверх текущей страницы (перехват маршрута): закрытие возвращает назад.
export function CreatePostModal() {
  const router = useRouter();
  return <CreatePostDialog onClose={() => router.back()} />;
}

// Прямой заход на /create: после закрытия — на главную.
export function CreatePostPage() {
  const router = useRouter();
  return <CreatePostDialog onClose={() => router.push('/')} />;
}
