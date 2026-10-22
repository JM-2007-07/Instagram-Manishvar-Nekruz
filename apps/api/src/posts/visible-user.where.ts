import type { Prisma } from '@/generated/prisma/client';

// Пользователь, которого видит viewer: активный, с подтверждённой почтой, без блокировок в обе стороны.
// Дублирует VisibilityService.visibleUserWhere (модуль privacy): нужна чистой функцией в select'ах,
// где нет доступа к сервисам (postSelect, visibleCommentWhere).
export function visibleUserCondition(viewerId: string): Prisma.UserWhereInput {
  return {
    status: 'ACTIVE',
    emailVerifiedAt: { not: null },
    blocksMade: { none: { blockedId: viewerId } },
    blocksReceived: { none: { blockerId: viewerId } },
  };
}
