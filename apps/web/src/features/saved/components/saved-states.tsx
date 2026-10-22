'use client';

import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetMeQuery } from '@/features/profile/api';

export function SavedSkeleton() {
  return (
    <div aria-label="Загрузка" className="grid grid-cols-3 gap-1">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="aspect-[3/4] animate-pulse bg-muted" />
      ))}
    </div>
  );
}

export function SavedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-14 text-muted-foreground">Не удалось загрузить данные</p>
      <Button onClick={onRetry}>Повторить</Button>
    </div>
  );
}

export function SavedEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-24 items-center justify-center rounded-full border-2 border-foreground">
        <Bookmark className="size-12" />
      </span>
      <h2 className="text-24 font-semibold">{title}</h2>
      <p className="max-w-[360px] text-14 text-muted-foreground">{text}</p>
    </div>
  );
}

// «Сохранённое» видит только владелец: чужое имя в адресе — «страница недоступна».
export function SavedOwnerGate({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const { data: me, isLoading, isError, refetch } = useGetMeQuery();

  if (isLoading) return <SavedSkeleton />;
  if (isError || !me) return <SavedError onRetry={() => void refetch()} />;

  if (me.userName !== username) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-24 font-semibold">К сожалению, эта страница недоступна</h1>
        <Link href="/" className="text-14 text-link">
          Вернуться на главную
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
