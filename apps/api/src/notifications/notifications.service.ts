import { Injectable, Logger } from '@nestjs/common';
import { decodeCursor, encodeCursor, type Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import type { NotificationType } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { userSummarySelect, type UserSummaryRow } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type { BadgesDto, NotificationDto } from './dto/notifications.dto';

export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  storyId?: string;
}

interface Row {
  id: string;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: UserSummaryRow;
  post: {
    shortcode: string;
    media: { media: { id: string; thumbnailKey: string | null } }[];
  } | null;
  comment: { text: string } | null;
}

const GROUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_GROUP_ACTORS = 3;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private unreadChatsCounter: ((userId: string) => Promise<number>) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
    private readonly realtime: RealtimeService,
  ) {}

  // Модуль чатов вызывает это в onModuleInit: notifications.registerUnreadChatsCounter((id) => ...).
  // Пока счётчика нет, unreadChats = 0.
  registerUnreadChatsCounter(counter: (userId: string) => Promise<number>): void {
    this.unreadChatsCounter = counter;
  }

  // Создаёт уведомление и шлёт события notification:new и badges:updated.
  // Вызывать только после успешной транзакции основного действия. Ошибка уведомления
  // не должна ломать основное действие, поэтому здесь она только логируется.
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      await this.createInternal(input);
    } catch (error) {
      this.logger.error(
        `notification ${input.type} failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  // Удаляет непрочитанное уведомление при отмене действия (снятый лайк, отписка).
  async remove(input: CreateNotificationInput): Promise<void> {
    try {
      const { count } = await this.prisma.notification.deleteMany({
        where: {
          recipientId: input.recipientId,
          actorId: input.actorId,
          type: input.type,
          postId: input.postId ?? null,
          commentId: input.commentId ?? null,
          storyId: input.storyId ?? null,
          readAt: null,
        },
      });
      if (count > 0) await this.emitBadges(input.recipientId);
    } catch (error) {
      this.logger.error(
        `notification remove failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async list(userId: string, query: CursorQueryDto): Promise<Page<NotificationDto>> {
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        actor: this.visibility.visibleUserWhere(userId),
        ...(c
          ? {
              OR: [
                { createdAt: { lt: c.createdAt } },
                { createdAt: c.createdAt, id: { lt: c.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: this.rowSelect(userId),
    });
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null;
    return { items: this.group(pageRows), nextCursor };
  }

  // Прочитано всё или всё до upToId включительно (по времени создания).
  async markRead(userId: string, upToId?: string): Promise<void> {
    let upTo: Date | undefined;
    if (upToId) {
      const target = await this.prisma.notification.findFirst({
        where: { id: upToId, recipientId: userId },
        select: { createdAt: true },
      });
      if (!target) return;
      upTo = target.createdAt;
    }
    const { count } = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null, ...(upTo ? { createdAt: { lte: upTo } } : {}) },
      data: { readAt: new Date() },
    });
    if (count > 0) await this.emitBadges(userId); // другие устройства пользователя обновят значки
  }

  async badges(userId: string): Promise<BadgesDto> {
    const [unreadNotifications, followRequests, unreadChats] = await Promise.all([
      this.prisma.notification.count({
        where: {
          recipientId: userId,
          readAt: null,
          actor: this.visibility.visibleUserWhere(userId),
        },
      }),
      this.prisma.follow.count({
        where: {
          followingId: userId,
          status: 'PENDING',
          follower: this.visibility.visibleUserWhere(userId),
        },
      }),
      this.unreadChatsCounter ? this.unreadChatsCounter(userId) : Promise.resolve(0),
    ]);
    return { unreadNotifications, unreadChats, followRequests };
  }

  // --- Вспомогательное ---------------------------------------------------------------------------

  private async createInternal(input: CreateNotificationInput): Promise<void> {
    const { recipientId, actorId, type } = input;
    if (recipientId === actorId) return; // себе — никогда

    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId: recipientId, type } },
      select: { enabled: true },
    });
    if (preference && !preference.enabled) return;

    const hidden = await this.visibility.getHiddenUserIds(recipientId);
    if (hidden.includes(actorId)) return; // блокировка в любую сторону

    const same = {
      recipientId,
      actorId,
      type,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      storyId: input.storyId ?? null,
    };
    const duplicate = await this.prisma.notification.findFirst({
      where: { ...same, readAt: null },
      select: { id: true },
    });
    if (duplicate) return;

    const created = await this.prisma.notification.create({
      data: same,
      select: this.rowSelect(recipientId),
    });
    const [dto] = this.group([created]);
    this.realtime.emitToUsers([recipientId], 'notification:new', { notification: dto });
    await this.emitBadges(recipientId);
  }

  private async emitBadges(userId: string): Promise<void> {
    this.realtime.emitToUsers([userId], 'badges:updated', await this.badges(userId));
  }

  private rowSelect(viewerId: string) {
    return {
      id: true,
      type: true,
      postId: true,
      commentId: true,
      readAt: true,
      createdAt: true,
      actor: { select: userSummarySelect(viewerId) },
      post: {
        select: {
          shortcode: true,
          media: {
            orderBy: { position: 'asc' },
            take: 1,
            select: { media: { select: { id: true, thumbnailKey: true } } },
          },
        },
      },
      comment: { select: { text: true } },
    } as const;
  }

  private toPostPreview(id: string, post: NonNullable<Row['post']>) {
    const cover = post.media[0]?.media;
    return {
      id,
      shortcode: post.shortcode,
      thumbnailUrl: cover
        ? `/api/v1/media/${cover.id}${cover.thumbnailKey ? '?variant=thumb' : ''}`
        : null,
    };
  }

  // Группировка в пределах страницы: одинаковые type + объект (post/comment) в окне 24 часа.
  // Строки приходят новыми сначала; группа получает id и время самого нового.
  private group(rows: Row[]): NotificationDto[] {
    const groups: { head: Row; members: Row[] }[] = [];
    for (const row of rows) {
      const object = row.postId ?? row.commentId;
      const found = object
        ? groups.find(
            (g) =>
              g.head.type === row.type &&
              (g.head.postId ?? g.head.commentId) === object &&
              g.head.createdAt.getTime() - row.createdAt.getTime() <= GROUP_WINDOW_MS,
          )
        : undefined;
      if (found) found.members.push(row);
      else groups.push({ head: row, members: [row] });
    }
    return groups.map(({ head, members }) => {
      const actorRows = new Map<string, UserSummaryRow>();
      for (const m of members) actorRows.set(m.actor.id, m.actor);
      return {
        id: head.id,
        type: head.type,
        actors: [...actorRows.values()]
          .slice(0, MAX_GROUP_ACTORS)
          .map((actor) => this.users.toSummary(actor)),
        actorCount: actorRows.size,
        post: head.postId && head.post ? this.toPostPreview(head.postId, head.post) : null,
        comment:
          head.commentId && head.comment ? { id: head.commentId, text: head.comment.text } : null,
        isRead: members.every((m) => m.readAt !== null),
        createdAt: head.createdAt.toISOString(),
      };
    });
  }
}
