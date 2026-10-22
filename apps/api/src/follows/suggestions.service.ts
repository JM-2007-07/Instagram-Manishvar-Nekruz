import { Injectable } from '@nestjs/common';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { decodeCursor, encodeCursor, type Page } from '@/common/pagination/cursor';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import type { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type { SuggestionDto } from './dto/follows.dto';

// Максимум связей, из которых собираем рекомендации «на него подписаны мои подписки» (запрос ограничен).
const SUGGESTION_SCAN_LIMIT = 500;
const PROFILE_MUTUAL_PREVIEW = 3;

// Рекомендации «на кого подписаться» и общие подписчики.
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
  ) {}

  // --- Общие подписчики --------------------------------------------------------------------------

  // Пользователи, на которых подписан viewer и которые подписаны на target.
  private mutualWhere(viewerId: string, targetId: string): Prisma.UserWhereInput {
    return {
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
    await this.visibility.assertCanViewProfile(viewerId, targetId); // нет/неактивный/блокировка = 404
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
      where: { followerId: viewerId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const followingIds = mine.map((row) => row.followingId);
    const visible = this.visibility.visibleUserWhere(viewerId);
    // Кандидат: виден мне, это не я и я на него ещё не подписан и не запрашивал (любой статус).
    const candidateWhere: Prisma.UserWhereInput = {
      AND: [visible],
      id: { not: viewerId },
      followers: { none: { followerId: viewerId } },
    };

    // candidateId -> кто из моих подписок на него подписан
    const via = new Map<string, string[]>();
    if (followingIds.length > 0) {
      const links = await this.prisma.follow.findMany({
        where: {
          followerId: { in: followingIds },
          status: 'ACCEPTED',
          follower: visible,
          following: candidateWhere,
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
      const groups = await this.prisma.follow.groupBy({
        by: ['followingId'],
        where: {
          status: 'ACCEPTED',
          followingId: { notIn: followedByIds },
          following: candidateWhere,
        },
        _count: { followingId: true },
        orderBy: { _count: { followingId: 'desc' } },
        take: limit - followedByIds.length,
      });
      popularIds.push(...groups.map((group) => group.followingId));
      if (followedByIds.length + popularIds.length < limit) {
        const fresh = await this.prisma.user.findMany({
          where: {
            AND: [candidateWhere],
            id: { notIn: [...followedByIds, ...popularIds] },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit - followedByIds.length - popularIds.length,
          select: { id: true },
        });
        popularIds.push(...fresh.map((user) => user.id));
      }
    }

    const firstFollowers = followedByIds.map((id) => via.get(id)?.[0]);
    const summaryIds = [
      ...new Set([
        ...followedByIds,
        ...popularIds,
        ...firstFollowers.filter((id): id is string => id !== undefined),
      ]),
    ];
    if (summaryIds.length === 0) return [];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: summaryIds } },
      select: userSummarySelect(viewerId),
    });
    const byId = new Map(rows.map((row) => [row.id, this.users.toSummary(row)]));

    const result: SuggestionDto[] = [];
    followedByIds.forEach((id, index) => {
      const user = byId.get(id);
      const firstId = firstFollowers[index];
      const followedBy = firstId ? byId.get(firstId) : undefined;
      if (user && followedBy) result.push({ ...user, reason: 'FOLLOWED_BY', followedBy });
    });
    for (const id of popularIds) {
      const user = byId.get(id);
      if (user) result.push({ ...user, reason: 'POPULAR' });
    }
    return result;
  }
}
