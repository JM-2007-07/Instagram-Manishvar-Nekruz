import { cn } from '@/lib/utils';
import { UserAvatar } from '@/features/users/components/user-avatar';

// Аватар чата. Личный чат и человек — общий UserAvatar; у группы (group) — своё фото, без картинки первая буква.
export function ChatAvatar({
  url,
  name,
  size = 56,
  online = false,
  group = false,
  className,
}: {
  url: string | null;
  name: string;
  size?: number;
  online?: boolean;
  group?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {!group ? (
        <UserAvatar user={{ userName: name, avatarUrl: url }} size={size} />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        <span
          aria-label={name}
          className="flex size-full items-center justify-center rounded-full bg-muted text-14 font-semibold text-muted-foreground uppercase"
        >
          {name.slice(0, 1)}
        </span>
      )}
      {online && (
        <span
          aria-label="В сети"
          className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-background bg-success"
        />
      )}
    </span>
  );
}
