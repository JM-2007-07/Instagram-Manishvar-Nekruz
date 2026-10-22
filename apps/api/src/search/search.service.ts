import { Injectable, NotFoundException } from '@nestjs/common';
import {
  decodeCursor,
  decodeOffsetCursor,
  encodeCursor,
  encodeOffsetCursor,
} from '@/common/pagination/cursor';
import type { Page } from '@/common/pagination/cursor';
import { validationError } from '@/common/validation';
import type { FollowListItemDto } from '@/follows/dto/follows.dto';
import { FollowsService } from '@/follows/follows.service';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import type { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type {
  AddSearchHistoryDto,
  SearchHistoryEntryDto,
  SearchHistoryQueryDto,
  SearchHistoryTypeValue,
  SearchResultDto,
  SearchUsersQueryDto,
} from './dto/search.dto';

const MAX_HISTORY_PER_TYPE = 50; // 📝 лимит из спецификации поиска
const SUGGESTION_LIMIT = 10;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly follows: FollowsService,
    private readonly visibility: VisibilityService,
  ) {}

  // --- Поиск ---------------------------------------------------------------------------------

  // Хэштеги и места появятся вместе с модулями tags и locations — пока пустые массивы.
  async searchAll(viewerId: string, q: string): Promise<SearchResultDto> {
    const rows = await this.findUsers(viewerId, q, 0, SUGGESTION_LIMIT);
    return {
      users: rows.map((row) => this.users.toSummary(row)),
      hashtags: [],
      locations: [],
    };
  }

  async mentions(viewerId: string, q: string): Promise<UserSummaryDto[]> {
    const rows = await this.findUsers(viewerId, q, 0, SUGGESTION_LIMIT);
    return rows.map((row) => this.users.toSummary(row));
  }

  // Выдача по релевантности: нет стабильного createdAt, поэтому курсор — смещение (ADR 0017).
  async searchUsers(
    viewerId: string,
    query: SearchUsersQueryDto,
  ): Promise<Page<FollowListItemDto>> {
    const offset = query.cursor ? decodeOffsetCursor(query.cursor) : 0;
    const rows = await this.findUsers(viewerId, query.q, offset, query.limit + 1);
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: pageRows.map((row) => row.id) } },
      select: { followingId: true, status: true },
    });
    const statusById = new Map(follows.map((row) => [row.followingId, row.status]));

    return {
      items: pageRows.map((row) => {
        const status = statusById.get(row.id);
        return {
          ...this.users.toSummary(row),
          followStatus:
            status === undefined ? 'NONE' : status === 'ACCEPTED' ? 'FOLLOWING' : 'REQUESTED',
        };
      }),
      nextCursor: hasMore ? encodeOffsetCursor(offset + query.limit) : null,
    };
  }

  // Совпадение по вхождению userName/fullName (без учёта регистра; email не участвует).
  // Порядок: сначала те, на кого viewer подписан, потом остальные; внутри группы — по числу подписчиков.
  // Итоговый список = группа подписок + группа остальных, поэтому skip/take применяем к объединению.
  private async findUsers(viewerId: string, q: string, skip: number, take: number) {
    const followingIds = await this.follows.getFollowingIds(viewerId);
    const match: Prisma.UserWhereInput = {
      AND: [
        this.visibility.visibleUserWhere(viewerId),
        {
          OR: [
            { userName: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    };
    const select = userSummarySelect(viewerId);
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { followers: { _count: 'desc' } },
      { id: 'asc' },
    ];
    const followedWhere: Prisma.UserWhereInput = { AND: [match, { id: { in: followingIds } }] };
    const othersWhere: Prisma.UserWhereInput = { AND: [match, { id: { notIn: followingIds } }] };

    const followedCount = await this.prisma.user.count({ where: followedWhere });
    const followed =
      skip < followedCount
        ? await this.prisma.user.findMany({ where: followedWhere, orderBy, skip, take, select })
        : [];
    const rest = take - followed.length;
    if (rest <= 0) return followed;
    const others = await this.prisma.user.findMany({
      where: othersWhere,
      orderBy,
      skip: Math.max(skip - followedCount, 0),
      take: rest,
      select,
    });
    return [...followed, ...others];
  }

  // --- История поиска ------------------------------------------------------------------------

  async listHistory(
    viewerId: string,
    query: SearchHistoryQueryDto,
  ): Promise<Page<SearchHistoryEntryDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.SearchHistoryEntryWhereInput = {
      AND: [
        { userId: viewerId },
        query.type ? { type: query.type } : {},
        // Найденные пользователи, которые теперь заблокированы или удалены, из истории исчезают.
        {
          OR: [
            { type: { not: 'USER' } },
            { targetUser: this.visibility.visibleUserWhere(viewerId) },
          ],
        },
        cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {},
      ],
    };
    const rows = await this.prisma.searchHistoryEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: this.entrySelect(viewerId),
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    return {
      items: pageRows.map((row) => this.toEntry(row)),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  async addHistory(viewerId: string, dto: AddSearchHistoryDto): Promise<SearchHistoryEntryDto> {
    const select = this.entrySelect(viewerId);
    const now = new Date();

    if (dto.type === 'QUERY') {
      if (!dto.query) throw validationError('query', 'query is required for type QUERY');
      const query = dto.query;
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.searchHistoryEntry.upsert({
          where: { userId_type_query: { userId: viewerId, type: 'QUERY', query } },
          create: { userId: viewerId, type: 'QUERY', query },
          update: { createdAt: now },
          select,
        });
        await this.trimHistory(tx, viewerId, 'QUERY');
        return saved;
      });
      return this.toEntry(row);
    }

    if (dto.type === 'USER') {
      if (!dto.userId) throw validationError('userId', 'userId is required for type USER');
      const targetUserId = dto.userId;
      const target = await this.prisma.user.findFirst({
        where: { AND: [{ id: targetUserId }, this.visibility.visibleUserWhere(viewerId)] },
        select: { id: true },
      });
      if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.searchHistoryEntry.upsert({
          where: { userId_type_targetUserId: { userId: viewerId, type: 'USER', targetUserId } },
          create: { userId: viewerId, type: 'USER', targetUserId },
          update: { createdAt: now },
          select,
        });
        await this.trimHistory(tx, viewerId, 'USER');
        return saved;
      });
      return this.toEntry(row);
    }

    // HASHTAG и LOCATION появятся после модулей tags и locations.
    throw validationError('type', 'Only QUERY and USER are supported');
  }

  async removeHistoryEntry(viewerId: string, entryId: string): Promise<void> {
    const result = await this.prisma.searchHistoryEntry.deleteMany({
      where: { id: entryId, userId: viewerId },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Search history entry not found' });
    }
  }

  async clearHistory(viewerId: string, type?: SearchHistoryTypeValue): Promise<void> {
    await this.prisma.searchHistoryEntry.deleteMany({
      where: { userId: viewerId, ...(type ? { type } : {}) },
    });
  }

  // Оставляет 50 свежих записей типа, остальные удаляет.
  private async trimHistory(
    tx: Prisma.TransactionClient,
    userId: string,
    type: SearchHistoryTypeValue,
  ): Promise<void> {
    const old = await tx.searchHistoryEntry.findMany({
      where: { userId, type },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: MAX_HISTORY_PER_TYPE,
      select: { id: true },
    });
    if (old.length === 0) return;
    await tx.searchHistoryEntry.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  }

  private entrySelect(viewerId: string) {
    return {
      id: true,
      type: true,
      query: true,
      createdAt: true,
      targetUser: { select: userSummarySelect(viewerId) },
    } satisfies Prisma.SearchHistoryEntrySelect;
  }

  private toEntry(
    row: Prisma.SearchHistoryEntryGetPayload<{ select: ReturnType<SearchService['entrySelect']> }>,
  ): SearchHistoryEntryDto {
    return {
      id: row.id,
      type: row.type,
      ...(row.query !== null ? { query: row.query } : {}),
      ...(row.targetUser ? { user: this.users.toSummary(row.targetUser) } : {}),
      createdAt: row.createdAt,
    };
  }
}
