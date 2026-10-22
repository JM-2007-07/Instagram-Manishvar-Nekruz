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
        author: { select: userSummarySelect(viewerId) },
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
