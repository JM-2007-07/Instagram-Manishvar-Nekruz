import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

// Единое место правил приватности (IMPLEMENTATION_PLAN §3.1). Сигнатуры методов не меняются.
// Сервис читает Block и Follow напрямую через Prisma и не зависит от FollowsService:
// так нет циклической зависимости privacy <-> follows (FollowsService сам использует VisibilityService).
// Пока реализованы блокировки и закрытые аккаунты; ограничение/скрытие/аудитория историй — T4.A3 / T2.B1.
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  // Есть ли блокировка между пользователями хотя бы в одну сторону.
  private async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { blockerId: true },
    });
    return block !== null;
  }

  // Можно ли viewer смотреть профиль owner (шапку, счётчики): нет блокировки в любую сторону.
  // Владелец должен быть ACTIVE с подтверждённым email — те же условия, что в visibleUserWhere.
  async canViewProfile(viewerId: string, ownerId: string): Promise<boolean> {
    if (viewerId === ownerId) return true;
    if (await this.isBlockedEitherWay(viewerId, ownerId)) return false;
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    return owner !== null;
  }

  // Можно ли viewer смотреть контент owner (посты, истории): свой, или (нет блокировки) и
  // (аккаунт открытый или viewer — ACCEPTED-подписчик).
  async canViewContent(viewerId: string, ownerId: string): Promise<boolean> {
    return (await this.contentDenial(viewerId, ownerId)) === null;
  }

  // Бросает 404, если профиль недоступен (блокировка, неактивный или неподтверждённый владелец).
  async assertCanViewProfile(viewerId: string, ownerId: string): Promise<void> {
    if (!(await this.canViewProfile(viewerId, ownerId))) throw new NotFoundException();
  }

  // Бросает 404 (блокировка или недоступный пользователь) или 403 PRIVATE_ACCOUNT (закрытый аккаунт).
  async assertCanViewContent(viewerId: string, ownerId: string): Promise<void> {
    const denial = await this.contentDenial(viewerId, ownerId);
    if (denial === 'NOT_FOUND') throw new NotFoundException();
    if (denial === 'PRIVATE') {
      throw new ForbiddenException({ code: 'PRIVATE_ACCOUNT', message: 'This account is private' });
    }
  }

  // Почему контент недоступен: null — доступен, NOT_FOUND — блокировка/нет активного подтверждённого пользователя, PRIVATE — закрытый аккаунт.
  private async contentDenial(
    viewerId: string,
    ownerId: string,
  ): Promise<null | 'NOT_FOUND' | 'PRIVATE'> {
    if (viewerId === ownerId) return null;
    if (await this.isBlockedEitherWay(viewerId, ownerId)) return 'NOT_FOUND';
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { isPrivate: true },
    });
    if (!owner) return 'NOT_FOUND';
    if (!owner.isPrivate) return null;
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      select: { status: true },
    });
    return follow?.status === 'ACCEPTED' ? null : 'PRIVATE';
  }

  // Id пользователей, чьё содержимое viewer не должен видеть в списках: кого он заблокировал и кто заблокировал его.
  async getHiddenUserIds(viewerId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const block of blocks)
      ids.add(block.blockerId === viewerId ? block.blockedId : block.blockerId);
    return [...ids];
  }

  // Условие для where по User: «этих пользователей viewer может видеть в выдаче» —
  // активные подтверждённые аккаунты без блокировок в обе стороны. Синхронно (relation-фильтры).
  visibleUserWhere(viewerId: string): Prisma.UserWhereInput {
    return {
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      blocksMade: { none: { blockedId: viewerId } }, // пользователь не блокировал viewer
      blocksReceived: { none: { blockerId: viewerId } }, // viewer не блокировал пользователя
    };
  }

  // Условие для where по автору контента (посты, истории, комментарии): автор виден viewer
  // и viewer может смотреть его контент — это он сам, или открытый аккаунт, или viewer — ACCEPTED-подписчик.
  visibleAuthorWhere(viewerId: string): Prisma.UserWhereInput {
    return {
      AND: [
        this.visibleUserWhere(viewerId),
        {
          OR: [
            { id: viewerId },
            { isPrivate: false },
            { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } },
          ],
        },
      ],
    };
  }
}
