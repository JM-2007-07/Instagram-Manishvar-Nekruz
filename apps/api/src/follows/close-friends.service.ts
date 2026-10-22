import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { cursorWhere, sliceRows } from '@/privacy/page.util';
import { PrismaService } from '@/prisma/prisma.service';
import type { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';

export const MAX_FAVORITES = 50;

// Близкие друзья (F-SOC-06) и избранные аккаунты (F-SOC-07). Применение — в историях и ленте (модули B).
@Injectable()
export class CloseFriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async addCloseFriend(ownerId: string, friendId: string): Promise<void> {
    await this.assertTarget(ownerId, friendId);
    await this.prisma.closeFriend.createMany({
      data: [{ ownerId, friendId }],
      skipDuplicates: true,
    });
  }

  async removeCloseFriend(ownerId: string, friendId: string): Promise<void> {
    await this.prisma.closeFriend.deleteMany({ where: { ownerId, friendId } });
  }

  async listCloseFriends(ownerId: string, query: CursorQueryDto): Promise<Page<UserSummaryDto>> {
    const rows = await this.prisma.closeFriend.findMany({
      where: { ownerId, friend: { status: 'ACTIVE' }, ...cursorWhere(query, 'friendId') },
      orderBy: [{ createdAt: 'desc' }, { friendId: 'desc' }],
      take: query.limit + 1,
      select: { createdAt: true, friend: { select: userSummarySelect(ownerId) } },
    });
    const page = sliceRows(rows, query.limit, (r) => r.friend.id);
    return {
      items: page.rows.map((r) => this.users.toSummary(r.friend)),
      nextCursor: page.nextCursor,
    };
  }

  async addFavorite(ownerId: string, targetId: string): Promise<void> {
    await this.assertTarget(ownerId, targetId);
    const exists = await this.prisma.favoriteAccount.findUnique({
      where: { ownerId_targetId: { ownerId, targetId } },
      select: { ownerId: true },
    });
    if (exists) return;
    const count = await this.prisma.favoriteAccount.count({ where: { ownerId } });
    if (count >= MAX_FAVORITES) {
      throw new ConflictException({
        code: 'LIMIT_REACHED',
        message: `You can have at most ${MAX_FAVORITES} favorite accounts`,
      });
    }
    await this.prisma.favoriteAccount.createMany({
      data: [{ ownerId, targetId }],
      skipDuplicates: true,
    });
  }

  async removeFavorite(ownerId: string, targetId: string): Promise<void> {
    await this.prisma.favoriteAccount.deleteMany({ where: { ownerId, targetId } });
  }

  // До 50 записей — без пагинации (контракт: UserSummary[]).
  async listFavorites(ownerId: string): Promise<UserSummaryDto[]> {
    const rows = await this.prisma.favoriteAccount.findMany({
      where: { ownerId, target: { status: 'ACTIVE' } },
      orderBy: [{ createdAt: 'desc' }, { targetId: 'desc' }],
      take: MAX_FAVORITES,
      select: { target: { select: userSummarySelect(ownerId) } },
    });
    return rows.map((r) => this.users.toSummary(r.target));
  }

  // Себя нельзя (400); неизвестный, неактивный или заблокированный (в любую сторону) — 404.
  private async assertTarget(ownerId: string, targetId: string): Promise<void> {
    if (ownerId === targetId) throw new BadRequestException('You cannot add yourself');
    const user = await this.prisma.user.findFirst({
      where: {
        id: targetId,
        status: 'ACTIVE',
        emailVerifiedAt: { not: null },
        blocksMade: { none: { blockedId: ownerId } },
        blocksReceived: { none: { blockerId: ownerId } },
      },
      select: { id: true },
    });
    if (!user) throw new NotFoundException();
  }
}
