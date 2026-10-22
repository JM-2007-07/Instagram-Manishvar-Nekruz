'use client';

import { Button } from '@/components/ui/button';

// Ошибка при отрисовке страницы, например API недоступен в (main)/layout.
// Это не «гость»: на вход не отправляем, предлагаем повторить.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <p className="text-16 text-foreground">Не удалось загрузить страницу</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
