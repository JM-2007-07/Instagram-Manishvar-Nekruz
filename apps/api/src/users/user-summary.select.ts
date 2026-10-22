import type { Prisma } from '@/generated/prisma/client';

// Поля User для UserSummaryDto. Используется в select/include чужих модулей:
//   author: { select: userSummarySelect(viewerId) }
// viewerId нужен уже сейчас, хотя заглушка его не использует: в T2.B1 сюда добавится выборка активных историй,
// видимых этому зрителю (hasActiveStory, isCloseFriendStory). Сигнатура после C0 не меняется.
export function userSummarySelect(viewerId: string) {
  void viewerId; // заглушка до T2.B1
  return {
    id: true,
    userName: true,
    fullName: true,
    isVerified: true,
    isPrivate: true,
  } satisfies Prisma.UserSelect;
}

export type UserSummaryRow = Prisma.UserGetPayload<{
  select: ReturnType<typeof userSummarySelect>;
}>;
