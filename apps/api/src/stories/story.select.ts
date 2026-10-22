import type { Prisma } from '@/generated/prisma/client';
import { mediaItemSelect } from '@/media/media.service';
import { userSummarySelect } from '@/users/user-summary.select';

// Поля истории для StoryDto с учётом зрителя: просмотрел ли, лайкнул ли, его ответы на стикеры.
export function storySelect(viewerId: string) {
  return {
    id: true,
    authorId: true,
    audience: true,
    durationSec: true,
    createdAt: true,
    expiresAt: true,
    author: { select: userSummarySelect(viewerId) },
    media: { select: mediaItemSelect },
    sharedPost: {
      select: {
        id: true,
        shortcode: true,
        status: true,
        isArchived: true,
        authorId: true,
        // Поля для проверки видимости поста зрителю (см. isSharedPostVisible).
        author: {
          select: {
            ...userSummarySelect(viewerId),
            status: true,
            emailVerifiedAt: true,
            followers: {
              where: { followerId: viewerId, status: 'ACCEPTED' },
              take: 1,
              select: { followerId: true },
            },
            blocksMade: { where: { blockedId: viewerId }, take: 1, select: { blockedId: true } },
            blocksReceived: {
              where: { blockerId: viewerId },
              take: 1,
              select: { blockerId: true },
            },
          },
        },
        media: {
          orderBy: { position: 'asc' },
          take: 1,
          select: { media: { select: { id: true, thumbnailKey: true } } },
        },
      },
    },
    stickers: {
      orderBy: { id: 'asc' },
      select: {
        id: true,
        type: true,
        x: true,
        y: true,
        width: true,
        height: true,
        rotation: true,
        data: true,
        responses: { where: { userId: viewerId }, select: { value: true }, take: 1 },
      },
    },
    views: { where: { viewerId }, select: { viewerId: true }, take: 1 },
    likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
    _count: { select: { views: true, likes: true } },
  } satisfies Prisma.StorySelect;
}

export type StoryRow = Prisma.StoryGetPayload<{ select: ReturnType<typeof storySelect> }>;

// Виден ли зрителю пост, которым поделились в истории: опубликован, не в архиве, автор активен,
// нет блокировок, а закрытый автор — только своим подписчикам. Автор поста видит свой пост всегда.
export function isSharedPostVisible(post: NonNullable<StoryRow['sharedPost']>, viewerId: string) {
  if (post.authorId === viewerId) return true;
  const author = post.author;
  if (post.status !== 'PUBLISHED' || post.isArchived) return false;
  if (author.status !== 'ACTIVE' || !author.emailVerifiedAt) return false;
  if (author.blocksMade.length > 0 || author.blocksReceived.length > 0) return false;
  return !author.isPrivate || author.followers.length > 0;
}
