import Link from 'next/link';

/** Текст комментария: @имя → профиль, #тег → страница тега, остальное — обычный текст. */
export function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@[\w.]+|#[\p{L}\d_]+)/u);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          return (
            <Link key={i} href={`/${part.slice(1)}/`} className="text-link-profile">
              {part}
            </Link>
          );
        }
        if (part.startsWith('#') && part.length > 1) {
          return (
            <Link key={i} href={`/explore/tags/${part.slice(1)}/`} className="text-link-profile">
              {part}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}

/** Короткое время как в Instagram: «5 мин», «5 ч», «2 д», «3 нед». */
export function shortTime(iso: string, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'сейчас';
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} д`;
  return `${Math.floor(sec / 604800)} нед`;
}

/** «1 отметка "Нравится"» / «2 отметки…» / «5 отметок…». */
export function likesLabel(n: number): string {
  const last = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  const word = teen
    ? 'отметок'
    : last === 1
      ? 'отметка'
      : last >= 2 && last <= 4
        ? 'отметки'
        : 'отметок';
  return `${n} ${word} "Нравится"`;
}
