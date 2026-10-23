import Link from 'next/link';
import { APP_NAME } from '@/lib/config';

// 404 хэштега и места.
export function NotAvailable() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-2xl font-semibold">К сожалению, эта страница недоступна.</h1>
      <p className="text-14 text-muted-foreground">
        Возможно, ссылка неверна или страница была удалена.{' '}
        <Link href="/" className="text-link">
          Вернуться в {APP_NAME}
        </Link>
      </p>
    </div>
  );
}
