'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { PostView } from './post-view';

// Окно поста поверх текущей страницы (перехваченный маршрут). Закрытие — назад по истории.
export function PostModal({ shortcode }: { shortcode: string }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent className="max-w-[calc(100vw-32px)] md:w-fit md:max-w-[min(1200px,calc(100vw-96px))]">
        <DialogTitle className="sr-only">Публикация</DialogTitle>
        <DialogDescription className="sr-only">Фото или видео с комментариями</DialogDescription>
        <PostView shortcode={shortcode} variant="modal" onDeleted={() => router.back()} />
      </DialogContent>
    </Dialog>
  );
}
