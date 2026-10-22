import type { Prisma } from '@/generated/prisma/client';
import { userSummarySelect } from '@/users/user-summary.select';

// Какие комментарии видит viewer: автор виден (активный, без блокировок в обе стороны — те же условия, что в
// VisibilityService.visibleUserWhere) и комментарий не ждёт одобрения (кроме своего и комментариев к своему посту).
// Чистая функция: нужна и в postSelect (commentCount, previewComments), где нет доступа к сервисам.
export function visibleCommentWhere(viewerId: string): Prisma.CommentWhereInput {
  return {
    author: {
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      blocksMade: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
    },
    OR: [{ isPendingApproval: false }, { authorId: viewerId }, { post: { authorId: viewerId } }],
  };
}

// Поля комментария для CommentDto. toCommentDto(row) собирает ответ.
export function commentSelect(viewerId: string) {
  return {
    id: true,
    postId: true,
    parentId: true,
    text: true,
    pinnedAt: true,
    editedAt: true,
    isPendingApproval: true,
    createdAt: true,
    author: { select: userSummarySelect(viewerId) },
    likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
    _count: { select: { likes: true, replies: { where: visibleCommentWhere(viewerId) } } },
  } satisfies Prisma.CommentSelect;
}

export type CommentRow = Prisma.CommentGetPayload<{ select: ReturnType<typeof commentSelect> }>;
