import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { decodeCursor, encodeCursor, type Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { FollowsService } from '@/follows/follows.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';

// Блокировки (F-PRV-02). Правила видимости — в VisibilityService; здесь только создание, снятие и список.
@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly follows: FollowsService,
  ) {}

  // Заблокировать. Повторный вызов — без ошибки. Подписки и запросы в обе стороны снимаются в той же транзакции.
  async block(blockerId: string, targetId: string): Promise<void> {
    if (blockerId === targetId) throw new BadRequestException('You cannot block yourself');
    await this.assertUserExists(targetId);
    await this.prisma.$transaction(async (tx) => {
      await tx.block.createMany({
        data: [{ blockerId, blockedId: targetId }],
        skipDuplicates: true,
      });
      await this.follows.removeFollowsBetween(tx, blockerId, targetId);
    });
  }

  // Разблокировать. Подписки не восстанавливаются. Повторный вызов — без ошибки.
  async unblock(blockerId: string, targetId: string): Promise<void> {
    await this.assertUserExists(targetId);
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId: targetId } });
  }

  // Мои заблокированные: новые сверху (createdAt desc, id пользователя desc, ADR 0017).
  async listBlocked(blockerId: string, query: CursorQueryDto): Promise<Page<UserSummaryDto>> {
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.block.findMany({
      where: {
        blockerId,
        blocked: { status: 'ACTIVE' },
        ...(c
          ? {
              OR: [
                { createdAt: { lt: c.createdAt } },
                { createdAt: c.createdAt, blockedId: { lt: c.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { blockedId: 'desc' }],
      take: query.limit + 1,
      select: { createdAt: true, blocked: { select: userSummarySelect(blockerId) } },
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map((row) => this.users.toSummary(row.blocked)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.createdAt, id: last.blocked.id })
          : null,
    };
  }

  private async assertUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    if (!user) throw new NotFoundException();
  }
}
