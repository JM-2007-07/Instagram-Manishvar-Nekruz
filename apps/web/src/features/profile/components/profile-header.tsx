import Link from 'next/link';
import { ArrowLeft, BadgeCheck, ChevronDown, Link2, Settings } from 'lucide-react';
import { DESIGN } from '@/lib/design';
import type { Profile } from '@/lib/api/types';
import { formatCount } from '../format';
import { ProfileActions, ProfileNameActions } from './profile-actions';
import { StoryAvatarLink } from '@/features/stories/components/story-avatar-link';

function mutualText(profile: Profile): string | null {
  const { users, total } = profile.mutualFollowers;
  if (profile.isMe || total === 0) return null;
  const names = users.slice(0, 2).map((u) => u.userName);
  const rest = total - names.length;
  return `Подписаны: ${names.join(', ')}${rest > 0 ? ` и ещё ${rest}` : ''}`;
}

// Шапка профиля как у Instagram (2026, SCREENS §профиль): на компьютере колонка 636 px —
// фото 150 px, справа имя (24/30, жирное), полное имя, счётчики, описание; ниже кнопки 44 px.
// На телефоне — фото 77 px, счётчики столбиками (число над подписью), кнопки 32 px.
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

  const about = (
    <>
      {profile.pronouns && <div className="text-muted-foreground">{profile.pronouns}</div>}
      {profile.bio && <p className="break-words whitespace-pre-line">{profile.bio}</p>}
      {visibleLinks.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-1 font-semibold break-all text-foreground hover:underline"
        >
          <Link2 className="size-4 shrink-0 -rotate-45" aria-hidden="true" />
          {link.title || link.url.replace(/^https?:\/\//, '')}
          {moreLinks > 0 && <span> и ещё {moreLinks}</span>}
        </a>
      ))}
      {mutual && <div className="text-muted-foreground">{mutual}</div>}
    </>
  );

  return (
    <>
      {/* Телефон: своя шапка страницы, как у Instagram (44 px; имя по центру) */}
      <div className="relative flex h-11 items-center px-4 md:hidden">
        {profile.isMe ? (
          <Link href="/accounts/settings/" aria-label="Настройки">
            <Settings className="size-6" />
          </Link>
        ) : (
          <Link href="/" aria-label="Назад">
            <ArrowLeft className="size-6" />
          </Link>
        )}
        <span className="absolute left-1/2 flex max-w-[60%] -translate-x-1/2 items-center gap-1 text-14 font-semibold">
          <span className="truncate">{profile.userName}</span>
          {profile.isMe && <ChevronDown className="size-3 shrink-0" strokeWidth={3} aria-hidden />}
        </span>
      </div>
      <header className="mx-auto w-full max-w-[636px] px-4 pt-5 md:px-0 md:pt-[37px]">
        <div className="flex items-center gap-[37px] md:items-start md:gap-7">
          <div className="shrink-0 pl-2.5 md:hidden">
            <StoryAvatarLink user={profile} size={77} />
          </div>
          <div className="hidden shrink-0 md:block">
            <StoryAvatarLink user={profile} size={DESIGN.profileAvatar} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col md:pt-[10px]">
            <div className="flex items-center gap-2">
              <h1 className="flex min-w-0 items-center gap-1 text-14 font-semibold md:text-24 md:leading-[30px] md:font-bold">
                <span className="truncate">{profile.userName}</span>
                {profile.isVerified && (
                  <BadgeCheck
                    className="size-[18px] shrink-0 fill-primary text-white"
                    aria-label="Подтверждённый аккаунт"
                  />
                )}
              </h1>
              <ProfileNameActions profile={profile} />
            </div>

            {profile.fullName && (
              <div className="mt-[7px] hidden text-14 md:block">{profile.fullName}</div>
            )}

            <ul className="mt-3 flex gap-4 text-14 md:mt-[12px]">
              {counters.map(({ label, value, href }) => {
                const content = (
                  <>
                    <span className="font-semibold">{formatCount(value)}</span>
                    <span className="max-md:block max-md:[overflow-wrap:anywhere]"> {label}</span>
                  </>
                );
                return (
                  <li key={label} className="min-w-0 max-md:flex-1">
                    {href ? (
                      <Link href={href} className="hover:opacity-80">
                        {content}
                      </Link>
                    ) : (
                      <span>{content}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-[19px] hidden flex-col gap-1 text-14 md:flex">{about}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-14 md:hidden">
          {profile.fullName && <div className="font-semibold">{profile.fullName}</div>}
          {about}
        </div>

        <ProfileActions profile={profile} />
      </header>
    </>
  );
}
