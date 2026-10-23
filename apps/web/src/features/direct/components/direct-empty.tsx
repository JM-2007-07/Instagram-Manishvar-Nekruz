import Link from 'next/link';
import { Send } from 'lucide-react';

// Правая колонка, когда чат не выбран: «Ваши сообщения».
export function DirectEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <span className="flex size-24 items-center justify-center rounded-full border-2 border-foreground">
        <Send className="size-12" aria-hidden />
      </span>
      <h2 className="mt-4 text-20 font-normal">Ваши сообщения</h2>
      <p className="mt-2 text-14 text-muted-foreground">
        Отправляйте личные фото и сообщения другу или группе
      </p>
      <Link
        href="/direct/new/"
        className="mt-4 inline-flex h-8 items-center rounded-lg bg-primary px-4 text-14 font-semibold text-primary-foreground hover:bg-button-primary-hover"
      >
        Отправить сообщение
      </Link>
    </div>
  );
}
