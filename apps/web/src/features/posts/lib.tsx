import Link from 'next/link';

// Относительное время как в Instagram: «5 мин», «5 ч», «2 дн.», «1 нед.».
export function timeAgo(iso: string, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'сейчас';
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} дн.`;
  if (sec < 365 * 86400) return `${Math.floor(sec / (7 * 86400))} нед.`;
  return `${Math.floor(sec / (365 * 86400))} г.`;
}

// Дата для окна поста: «22 октября» (с годом, если не текущий).
export function formatPostDate(iso: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' };
  return d.toLocaleDateString('ru-RU', opts);
}

// Подпись: #хэштеги и @упоминания — ссылки, остальное — обычный текст (не HTML).
export function renderCaption(text: string): React.ReactNode[] {
  return text.split(/([#@][\p{L}\p{N}_.]+)/gu).map((part, i) => {
    if (/^#[\p{L}\p{N}_]/u.test(part)) {
      return (
        <Link
          key={i}
          href={`/explore/tags/${encodeURIComponent(part.slice(1))}/`}
          className="text-link-profile"
        >
          {part}
        </Link>
      );
    }
    if (/^@[\p{L}\p{N}_]/u.test(part)) {
      return (
        <Link key={i} href={`/${part.slice(1).replace(/\.$/, '')}/`} className="text-link-profile">
          {part}
        </Link>
      );
    }
    return part;
  });
}
