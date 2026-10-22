import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type ChatParticipantStatus,
  type ChatRole,
  type ChatType,
} from '@/generated/prisma/client';
import { FollowsService } from '@/follows/follows.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { validationError } from '@/common/validation';

export interface Membership {
  chatId: string;
  type: ChatType;
  role: ChatRole;
  status: ChatParticipantStatus;
}

// Права доступа к чатам. Чужой чат (не участник, вышедший, блокировка в личном чате) — всегда 404.
@Injectable()
export class ChatAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly follows: FollowsService,
  ) {}

  async assertMember(chatId: string, userId: string): Promise<Membership> {
    const row = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: {
        role: true,
        status: true,
        chat: {
          select: {
            type: true,
            participants: {
              where: { userId: { not: userId }, status: { not: 'LEFT' } },
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!row || row.status === 'LEFT') throw new NotFoundException();
    if (row.chat.type === 'DIRECT') {
      for (const other of row.chat.participants) {
        if (!(await this.visibility.canViewProfile(userId, other.userId))) {
          throw new NotFoundException();
        }
      }
    }
    return { chatId, type: row.chat.type, role: row.role, status: row.status };
  }

  // Id всех действующих участников (для рассылки событий).
  async activeUserIds(chatId: string): Promise<string[]> {
    const rows = await this.prisma.chatParticipant.findMany({
      where: { chatId, status: { not: 'LEFT' } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  // Личный чат пары: существующий или новый. Новый чат у получателя — «запрос», если он не подписан на автора.
  async findOrCreateDirect(
    meId: string,
    otherId: string,
  ): Promise<{ chatId: string; created: boolean }> {
    if (meId === otherId) throw validationError('userIds', 'You cannot message yourself');
    if (!(await this.visibility.canViewProfile(meId, otherId))) throw new NotFoundException();
    const directKey = [meId, otherId].sort().join(':');
    const existing = await this.prisma.chat.findUnique({
      where: { directKey },
      select: { id: true },
    });
    if (existing) return { chatId: existing.id, created: false };

    const otherStatus = (await this.follows.isFollowing(otherId, meId)) ? 'ACTIVE' : 'REQUEST';
    try {
      const chat = await this.prisma.chat.create({
        data: {
          type: 'DIRECT',
          createdById: meId,
          directKey,
          participants: {
            create: [
              { userId: meId, status: 'ACTIVE' },
              { userId: otherId, status: otherStatus },
            ],
          },
        },
        select: { id: true },
      });
      return { chatId: chat.id, created: true };
    } catch (e) {
      // Гонка: параллельный запрос уже создал чат этой пары.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const chat = await this.prisma.chat.findUniqueOrThrow({
          where: { directKey },
          select: { id: true },
        });
        return { chatId: chat.id, created: false };
      }
      throw e;
    }
  }
}
