import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { DESIGN } from '@/lib/design';
import type { Profile } from '@/lib/api/types';
import { formatCount } from '../format';
import { ProfileActions } from './profile-actions';
import { UserAvatar } from '@/features/users/components/user-avatar';

function mutualText(profile: Profile): string | null {
  const { users, total } = profile.mutualFollowers;
  if (profile.isMe || total === 0) return null;
  const names = users.slice(0, 2).map((u) => u.userName);
  const rest = total - names.length;
  return `Подписаны: ${names.join(', ')}${rest > 0 ? ` и ещё ${rest}` : ''}`;
}

export function ProfileHeader({ profile }: { profile: Profile }) {
  const base = `/${profile.userName}/`;
  const mutual = mutualText(profile);
  const visibleLinks = profile.links.slice(0, 1);
  const moreLinks = profile.links.length - visibleLinks.length;

  const counters = [
    { label: 'публикаций', value: profile.postCount, href: null },
    { label: 'подписчиков', value: profile.followerCount, href: `${base}followers/` },
    { label: 'подписок', value: profile.followingCount, href: `${base}following/` },
  ];

  return (
    <header className="flex flex-col gap-6 px-4 py-6 md:flex-row md:gap-20 md:px-5 md:py-[30px]">
      <div className="flex shrink-0 items-center justify-center md:w-[290px]">
        <UserAvatar user={profile} size={DESIGN.profileAvatar} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="flex items-center gap-1 text-20 font-normal">
            {profile.userName}
            {profile.isVerified && (
              <BadgeCheck className="size-4 text-primary" aria-label="Подтверждённый аккаунт" />
            )}
          </h1>
          <ProfileActions profile={profile} />
        </div>

        <ul className="flex gap-6 text-16 md:gap-10">
          {counters.map(({ label, value, href }) => (
            <li key={label}>
              {href ? (
                <Link href={href} className="hover:opacity-80">
                  <span className="font-semibold">{formatCount(value)}</span> {label}
                </Link>
              ) : (
                <span>
                  <span className="font-semibold">{formatCount(value)}</span> {label}
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1 text-14">
          {profile.fullName && <div className="font-semibold">{profile.fullName}</div>}
          {profile.pronouns && <div className="text-muted-foreground">{profile.pronouns}</div>}
          {profile.bio && <p className="break-words whitespace-pre-line">{profile.bio}</p>}
          {visibleLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-semibold break-all text-link-profile"
            >
              {link.title || link.url.replace(/^https?:\/\//, '')}
              {moreLinks > 0 && <span className="text-foreground"> и ещё {moreLinks}</span>}
            </a>
          ))}
          {mutual && <div className="text-muted-foreground">{mutual}</div>}
        </div>
      </div>
    </header>
  );
}
