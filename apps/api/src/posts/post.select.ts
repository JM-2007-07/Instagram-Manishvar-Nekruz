import { commentSelect, visibleCommentWhere } from '@/comments/comment.select';
import type { Prisma } from '@/generated/prisma/client';
import { locationSelect } from '@/locations/locations.service';
import { mediaItemSelect } from '@/media/media.service';
import { userSummarySelect } from '@/users/user-summary.select';
import { visibleUserCondition } from './visible-user.where';

// Поля публикации для PostDto. Другие модули (collections, chats) берут их так:
//   select: postSelect(viewerId)  ->  posts.toPostDto(row, viewerId)
export function postSelect(viewerId: string) {
  return {
    id: true,
    shortcode: true,
    type: true,
    status: true,
    authorId: true,
    caption: true,
    commentsDisabled: true,
    hideLikeCount: true,
    isArchived: true,
    pinnedAt: true,
    playCount: true,
    editedAt: true,
    publishedAt: true,
    createdAt: true,
    author: { select: userSummarySelect(viewerId) },
    location: { select: locationSelect },
    media: {
      orderBy: { position: 'asc' },
      select: { position: true, altText: true, media: { select: mediaItemSelect } },
    },
    userTags: {
      where: { tagged: visibleUserCondition(viewerId) },
      orderBy: { taggedUserId: 'asc' },
      select: {
        position: true,
        x: true,
        y: true,
        tagged: { select: userSummarySelect(viewerId) },
      },
    },
    collaborators: {
      where: { status: 'ACCEPTED', user: visibleUserCondition(viewerId) },
      select: { user: { select: userSummarySelect(viewerId) } },
    },
    likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
    // До 2 комментариев верхнего уровня для карточки (закреплённые первыми).
    comments: {
      where: { parentId: null, ...visibleCommentWhere(viewerId) },
      orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 2,
      select: commentSelect(viewerId),
    },
    _count: { select: { likes: true, comments: { where: visibleCommentWhere(viewerId) } } },
  } satisfies Prisma.PostSelect;
}

export type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;
