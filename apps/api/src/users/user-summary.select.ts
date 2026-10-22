import type { Prisma } from '@/generated/prisma/client';

// Поля User для UserSummaryDto. Используется в select/include чужих модулей:
//   author: { select: userSummarySelect(viewerId) }
// viewerId нужен для кольца вокруг аватара: stories — активные истории, которые видит этот зритель
// (hasActiveStory, isCloseFriendStory считает UsersService.toSummary).
export function userSummarySelect(viewerId: string) {
  return {
    id: true,
    userName: true,
    fullName: true,
    isVerified: true,
    isPrivate: true,
    avatarMediaId: true,
    // Не истёкшие истории, видимые viewer: свои; чужие — если аккаунт открыт или viewer подписан,
    // viewer не в «скрыть от», а для CLOSE_FRIENDS — в близких друзьях. CLOSE_FRIENDS сортируются первыми.
    stories: {
      where: {
        expiresAt: { gt: new Date() },
        OR: [
          { authorId: viewerId },
          {
            author: {
              OR: [
                { isPrivate: false },
                { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } },
              ],
              storyHiddenFrom: { none: { viewerId } },
            },
            OR: [
              { audience: 'EVERYONE' },
              { author: { closeFriends: { some: { friendId: viewerId } } } },
            ],
          },
        ],
      },
      orderBy: { audience: 'asc' },
      take: 1,
      select: { audience: true },
    },
  } satisfies Prisma.UserSelect;
}

export type UserSummaryRow = Prisma.UserGetPayload<{
  select: ReturnType<typeof userSummarySelect>;
}>;
