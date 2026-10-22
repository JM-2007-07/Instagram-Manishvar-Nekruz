import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { decodeCursor, encodeCursor, type Page } from '@/common/pagination/cursor';
import { FollowStatus, Prisma } from '@/generated/prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import type { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect, type UserSummaryRow } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type {
  FollowListItemDto,
  FollowListQueryDto,
  FollowRequestItemDto,
  FollowStatusValue,
  SuggestionDto,
} from './dto/follows.dto';

// Максимум связей, из которых собираем рекомендации «на него подписаны мои подписки» (запрос ограничен).
const SUGGESTION_SCAN_LIMIT = 500;
const PROFILE_MUTUAL_PREVIEW = 3;

// Сторона списка: 'follower' — кто подписан на владельца; 'following' — на кого подписан владелец.
type Side = 'follower' | 'following';
interface Row {
  createdAt: Date;
  user: UserSummaryRow;
}

// Подписки. Публичные методы для других модулей (ленты, истории, privacy):
//   getFollowingIds(userId)           — id, на кого userId подписан (только ACCEPTED);
//   isFollowing(viewerId, ownerId)    — подписан ли viewer на owner (только ACCEPTED);
//   removeFollowsBetween(tx, a, b)    — удалить подписки в обе стороны (для блокировки).
@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Публичные методы для других модулей -------------------------------------------------------

  async getFollowingIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    return rows.map((row) => row.followingId);
  }

  async isFollowing(viewerId: string, ownerId: string): Promise<boolean> {
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      select: { status: true },
    });
    return row?.status === 'ACCEPTED';
  }

  // Удаляет подписки между двумя пользователями в обе стороны (вызывает блокировка, T1.A5).
  async removeFollowsBetween(
    tx: Prisma.TransactionClient,
    userA: string,
    userB: string,
  ): Promise<void> {
    await tx.follow.deleteMany({
      where: {
        OR: [
          { followerId: userA, followingId: userB },
          { followerId: userB, followingId: userA },
        ],
      },
    });
  }

  // Открытие аккаунта принимает все запросы. Вызывается внутри транзакции смены isPrivate;
  // возвращает подписчиков, которым после коммита нужно отправить FOLLOW_ACCEPTED (notifyAccepted).
  async acceptAllPending(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const pending = await tx.follow.findMany({
      where: { followingId: userId, status: 'PENDING' },
      select: { followerId: true },
    });
    await tx.follow.updateMany({
      where: { followingId: userId, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    return pending.map((row) => row.followerId);
  }

  async notifyAccepted(ownerId: string, followerIds: string[]): Promise<void> {
    for (const followerId of followerIds) {
      await this.notifications.create({
        recipientId: followerId,
        actorId: ownerId,
        type: 'FOLLOW_ACCEPTED',
      });
    }
  }

  // --- Подписка / отписка ------------------------------------------------------------------------

  async follow(viewerId: string, targetId: string): Promise<{ status: 'ACCEPTED' | 'PENDING' }> {
    if (viewerId === targetId) throw new BadRequestException('You cannot follow yourself');
    const target = await this.findActiveUser(targetId);
    await this.visibility.assertCanViewProfile(viewerId, targetId); // блокировка = 404

    const key = { followerId_followingId: { followerId: viewerId, followingId: targetId } };
    const existing = await this.prisma.follow.findUnique({ where: key, select: { status: true } });
    if (existing) return { status: existing.status };

    const status = target.isPrivate ? FollowStatus.PENDING : FollowStatus.ACCEPTED;
    try {
      await this.prisma.follow.create({
        data: {
          followerId: viewerId,
          followingId: targetId,
          status,
          acceptedAt: status === 'ACCEPTED' ? new Date() : null,
        },
      });
    } catch (error) {
      // Параллельный повторный PUT: связь уже создана — это не ошибка.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const again = await this.prisma.follow.findUnique({ where: key, select: { status: true } });
        if (again) return { status: again.status };
      }
      throw error;
    }

    await this.notifications.create({
      recipientId: targetId,
      actorId: viewerId,
      type: status === 'ACCEPTED' ? 'FOLLOW' : 'FOLLOW_REQUEST',
    });
    return { status };
  }

  // Отписка или отмена запроса. Повторный вызов — без ошибки; неизвестный пользователь — 404.
  async unfollow(viewerId: string, targetId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();
    await this.prisma.follow.deleteMany({ where: { followerId: viewerId, followingId: targetId } });
  }

  // --- Мои подписчики и запросы ------------------------------------------------------------------

  async removeFollower(ownerId: string, followerId: string): Promise<void> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId: ownerId, status: 'ACCEPTED' },
    });
    if (count === 0) throw new NotFoundException();
    // Уведомление удалённому подписчику не отправляется (F-SOC-04).
  }

  async listRequests(ownerId: string, query: CursorQueryDto): Promise<Page<FollowRequestItemDto>> {
    const page = await this.listRows('follower', ownerId, 'PENDING', ownerId, query);
    return {
      items: page.items.map((row) => ({
        ...this.users.toSummary(row.user),
        requestedAt: row.createdAt,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async acceptRequest(ownerId: string, followerId: string): Promise<void> {
    const { count } = await this.prisma.follow.updateMany({
      where: { followerId, followingId: ownerId, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException();
    await this.notifications.create({
      recipientId: followerId,
      actorId: ownerId,
      type: 'FOLLOW_ACCEPTED',
    });
  }

  async rejectRequest(ownerId: string, followerId: string): Promise<void> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId: ownerId, status: 'PENDING' },
    });
    if (count === 0) throw new NotFoundException();
  }

  // --- Списки подписчиков / подписок -------------------------------------------------------------

  listFollowers(
    viewerId: string,
    userId: string,
    query: FollowListQueryDto,
  ): Promise<Page<FollowListItemDto>> {
    return this.listPublic('follower', viewerId, userId, query);
  }

  listFollowing(
    viewerId: string,
    userId: string,
    query: FollowListQueryDto,
  ): Promise<Page<FollowListItemDto>> {
    return this.listPublic('following', viewerId, userId, query);
  }

  private async listPublic(
    side: Side,
    viewerId: string,
    userId: string,
    query: FollowListQueryDto,
  ): Promise<Page<FollowListItemDto>> {
    await this.findActiveUser(userId);
    await this.visibility.assertCanViewProfile(viewerId, userId);
    await this.visibility.assertCanViewContent(viewerId, userId); // закрытый аккаунт = 403

    const page = await this.listRows(side, userId, 'ACCEPTED', viewerId, query);
    const statuses = await this.followStatuses(
      viewerId,
      page.items.map((row) => row.user.id),
    );
    return {
      items: page.items.map((row) => ({
        ...this.users.toSummary(row.user),
        followStatus: statuses.get(row.user.id) ?? 'NONE',
      })),
      nextCursor: page.nextCursor,
    };
  }

  // Моя подписка на каждого из ids: FOLLOWING / REQUESTED; отсутствие в карте = NONE.
  private async followStatuses(
    viewerId: string,
    ids: string[],
  ): Promise<Map<string, FollowStatusValue>> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: ids } },
      select: { followingId: true, status: true },
    });
    return new Map(
      rows.map((row): [string, FollowStatusValue] => [
        row.followingId,
        row.status === 'ACCEPTED' ? 'FOLLOWING' : 'REQUESTED',
      ]),
    );
  }

  // Страница связей владельца. Порядок: createdAt desc, затем id пользователя из списка desc (ADR 0017).
  private async listRows(
    side: Side,
    ownerId: string,
    status: FollowStatus,
    viewerId: string,
    query: { cursor?: string; limit: number; q?: string },
  ): Promise<Page<Row>> {
    const q = query.q;
    const userWhere: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      AND: [this.visibility.visibleUserWhere(viewerId)],
      ...(q
        ? {
            OR: [
              { userName: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const take = query.limit + 1;
    const select = userSummarySelect(viewerId);

    let rows: Row[];
    if (side === 'follower') {
      const found = await this.prisma.follow.findMany({
        where: {
          followingId: ownerId,
          status,
          follower: userWhere,
          ...(c
            ? {
                OR: [
                  { createdAt: { lt: c.createdAt } },
                  { createdAt: c.createdAt, followerId: { lt: c.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
        take,
        select: { createdAt: true, follower: { select } },
      });
      rows = found.map((r) => ({ createdAt: r.createdAt, user: r.follower }));
    } else {
      const found = await this.prisma.follow.findMany({
        where: {
          followerId: ownerId,
          status,
          following: userWhere,
          ...(c
            ? {
                OR: [
                  { createdAt: { lt: c.createdAt } },
                  { createdAt: c.createdAt, followingId: { lt: c.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
        take,
        select: { createdAt: true, following: { select } },
      });
      rows = found.map((r) => ({ createdAt: r.createdAt, user: r.following }));
    }

    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.user.id })
        : null;
    return { items, nextCursor };
  }

  // --- Общие подписчики --------------------------------------------------------------------------

  // Пользователи, на которых подписан viewer и которые подписаны на target.
  private mutualWhere(viewerId: string, targetId: string): Prisma.UserWhereInput {
    return {
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      AND: [this.visibility.visibleUserWhere(viewerId)],
      followers: { some: { followerId: viewerId, status: 'ACCEPTED' } },
      following: { some: { followingId: targetId, status: 'ACCEPTED' } },
    };
  }

  async listMutualFollowers(
    viewerId: string,
    targetId: string,
    query: CursorQueryDto,
  ): Promise<Page<UserSummaryDto>> {
    await this.findActiveUser(targetId);
    await this.visibility.assertCanViewProfile(viewerId, targetId);
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.user.findMany({
      where: {
        AND: [
          this.mutualWhere(viewerId, targetId),
          c
            ? {
                OR: [
                  { createdAt: { lt: c.createdAt } },
                  { createdAt: c.createdAt, id: { lt: c.id } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: { createdAt: true, ...userSummarySelect(viewerId) },
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map((user) => this.users.toSummary(user)),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  // Для Profile.mutualFollowers: первые несколько и общее число.
  async mutualPreview(
    viewerId: string,
    targetId: string,
  ): Promise<{ users: UserSummaryDto[]; total: number }> {
    if (viewerId === targetId) return { users: [], total: 0 };
    const where = this.mutualWhere(viewerId, targetId);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PROFILE_MUTUAL_PREVIEW,
        select: userSummarySelect(viewerId),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: rows.map((user) => this.users.toSummary(user)), total };
  }

  // --- Рекомендации ------------------------------------------------------------------------------

  // 1) FOLLOWED_BY — на кого подписаны мои подписки; 2) POPULAR — больше всего подписчиков;
  // 3) если мало — новые аккаунты (тоже POPULAR). Уже отслеживаемые и запрошенные исключаются.
  async suggestions(viewerId: string, limit: number): Promise<SuggestionDto[]> {
    const mine = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true, status: true },
    });
    const exclude = [viewerId, ...mine.map((row) => row.followingId)];
    const followingIds = mine.filter((r) => r.status === 'ACCEPTED').map((r) => r.followingId);
    const userWhere: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      AND: [this.visibility.visibleUserWhere(viewerId)],
    };

    // candidateId -> кто из моих подписок на него подписан
    const via = new Map<string, string[]>();
    if (followingIds.length > 0) {
      const links = await this.prisma.follow.findMany({
        where: {
          followerId: { in: followingIds },
          status: 'ACCEPTED',
          followingId: { notIn: exclude },
          following: userWhere,
        },
        orderBy: { createdAt: 'desc' },
        take: SUGGESTION_SCAN_LIMIT,
        select: { followerId: true, followingId: true },
      });
      for (const link of links) {
        via.set(link.followingId, [...(via.get(link.followingId) ?? []), link.followerId]);
      }
    }
    const followedByIds = [...via.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, limit)
      .map(([id]) => id);

    const popularIds: string[] = [];
    if (followedByIds.length < limit) {
      const taken = [...exclude, ...followedByIds];
      const groups = await this.prisma.follow.groupBy({
        by: ['followingId'],
        where: { status: 'ACCEPTED', followingId: { notIn: taken }, following: userWhere },
        _count: { followingId: true },
        orderBy: { _count: { followingId: 'desc' } },
        take: limit - followedByIds.length,
      });
      popularIds.push(...groups.map((group) => group.followingId));
      if (followedByIds.length + popularIds.length < limit) {
        const fresh = await this.prisma.user.findMany({
          where: { ...userWhere, id: { notIn: [...taken, ...popularIds] } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit - followedByIds.length - popularIds.length,
          select: { id: true },
        });
        popularIds.push(...fresh.map((user) => user.id));
      }
    }

    const firstFollowers = followedByIds.map((id) => via.get(id)?.[0] ?? '');
    const summaryIds = [...new Set([...followedByIds, ...popularIds, ...firstFollowers])];
    if (summaryIds.length === 0) return [];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: summaryIds } },
      select: userSummarySelect(viewerId),
    });
    const byId = new Map(rows.map((row) => [row.id, this.users.toSummary(row)]));

    const result: SuggestionDto[] = [];
    followedByIds.forEach((id, index) => {
      const user = byId.get(id);
      const followedBy = byId.get(firstFollowers[index]);
      if (user && followedBy) result.push({ ...user, reason: 'FOLLOWED_BY', followedBy });
    });
    for (const id of popularIds) {
      const user = byId.get(id);
      if (user) result.push({ ...user, reason: 'POPULAR' });
    }
    return result;
  }

  // --- Вспомогательное ---------------------------------------------------------------------------

  // Активный подтверждённый пользователь или 404.
  private async findActiveUser(id: string): Promise<{ id: string; isPrivate: boolean }> {
    const user = await this.prisma.user.findFirst({
      where: { id, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { id: true, isPrivate: true },
    });
    if (!user) throw new NotFoundException();
    return user;
  }
}
