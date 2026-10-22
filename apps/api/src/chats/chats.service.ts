import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { decodeCursor, encodeCursor, type Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { validationError } from '@/common/validation';
import type { Prisma } from '@/generated/prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { ChatAccessService } from './chat-access.service';
import { ChatPresenter, chatSelect } from './chat.presenter';
import type { ChatDto, CreateChatDto, MessageDto } from './dto/chats.dto';
import { MAX_GROUP_SIZE } from './dto/chats.dto';
import { limitReached } from './chats.errors';
import { GroupsService } from './groups.service';
import { MessagesService } from './messages.service';

const FOREVER = new Date('9999-12-31T00:00:00.000Z');

// Чаты пользователя. Публичные методы для других модулей:
//   countUnreadChats(userId)  — число чатов «Основное» с непрочитанными (значок unreadChats в GET /me/badges);
//   sendSystemMessage(input)  — ответ/реакция на историю: сообщение STORY_REPLY / STORY_REACTION в личном чате.
@Injectable()
export class ChatsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
    private readonly presenter: ChatPresenter,
    private readonly messages: MessagesService,
    private readonly groups: GroupsService,
    private readonly visibility: VisibilityService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // Значок unreadChats в GET /me/badges считает этот сервис; notifications не импортирует chats (нет цикла модулей).
  onModuleInit(): void {
    this.notifications.registerUnreadChatsCounter((userId) => this.countUnreadChats(userId));
  }

  async list(
    userId: string,
    query: CursorQueryDto & { folder: 'PRIMARY' | 'REQUESTS' },
  ): Promise<Page<ChatDto>> {
    const hidden = await this.visibility.getHiddenUserIds(userId);
    const status = query.folder === 'REQUESTS' ? 'REQUEST' : 'ACTIVE';
    const conditions: Prisma.ChatWhereInput[] = [
      { participants: { some: { userId, status, hidden: false } } },
      // Личный чат виден, когда в нём есть сообщения; чат с заблокированным/заблокировавшим не показываем.
      { OR: [{ type: 'GROUP' }, { messages: { some: {} } }] },
      { NOT: { type: 'DIRECT', participants: { some: { userId: { in: hidden } } } } },
    ];
    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      conditions.push({
        OR: [
          { lastMessageAt: { lt: c.createdAt } },
          { lastMessageAt: c.createdAt, id: { lt: c.id } },
        ],
      });
    }
    const rows = await this.prisma.chat.findMany({
      where: { AND: conditions },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: chatSelect(userId),
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: await Promise.all(page.map((row) => this.presenter.toChat(row, userId))),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.lastMessageAt, id: last.id })
          : null,
    };
  }

  async get(chatId: string, userId: string): Promise<ChatDto> {
    await this.access.assertMember(chatId, userId);
    return this.presenter.loadChat(chatId, userId);
  }

  // Один id — личный чат (существующий или новый), несколько — группа.
  async create(userId: string, dto: CreateChatDto): Promise<{ chat: ChatDto; created: boolean }> {
    if (dto.userIds.length === 1) {
      const { chatId, created } = await this.access.findOrCreateDirect(userId, dto.userIds[0]);
      return { chat: await this.presenter.loadChat(chatId, userId), created };
    }
    if (dto.userIds.includes(userId))
      throw validationError('userIds', 'userIds must not contain you');
    if (dto.userIds.length + 1 > MAX_GROUP_SIZE) throw limitReached();
    for (const id of dto.userIds) await this.visibility.assertCanViewProfile(userId, id);
    const chatId = await this.groups.createGroup(userId, dto.userIds, dto.title ?? null);
    return { chat: await this.presenter.loadChat(chatId, userId), created: true };
  }

  // «Принять» запрос: чат переходит в «Основное».
  async accept(chatId: string, userId: string): Promise<void> {
    const m = await this.access.assertMember(chatId, userId);
    if (m.status !== 'REQUEST') return;
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { status: 'ACTIVE' },
    });
    await this.presenter.emitChatUpdated(chatId, await this.access.activeUserIds(chatId));
  }

  // «Удалить чат» — только у себя. Для группы это ещё и выход.
  async deleteForMe(chatId: string, userId: string): Promise<void> {
    const m = await this.access.assertMember(chatId, userId);
    if (m.type === 'GROUP') await this.groups.removeMember(chatId, userId, userId);
    await this.prisma.chatParticipant
      .update({
        where: { chatId_userId: { chatId, userId } },
        data: { clearedAt: new Date(), hidden: true },
      })
      .catch(() => undefined); // группа могла удалиться целиком, когда вышел последний участник
  }

  async mute(chatId: string, userId: string, until?: Date): Promise<void> {
    await this.access.assertMember(chatId, userId);
    if (until && until <= new Date()) throw validationError('until', 'until must be in the future');
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { mutedUntil: until ?? FOREVER },
    });
  }

  async unmute(chatId: string, userId: string): Promise<void> {
    await this.access.assertMember(chatId, userId);
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { mutedUntil: null },
    });
  }

  // «Прочитано» до сообщения messageId включительно. Назад не двигается.
  async markRead(chatId: string, userId: string, messageId: string): Promise<void> {
    const m = await this.access.assertMember(chatId, userId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, chatId },
      select: { id: true, createdAt: true },
    });
    if (!message) throw new NotFoundException();
    const advanced = await this.prisma.chatParticipant.updateMany({
      where: {
        chatId,
        userId,
        OR: [{ lastReadAt: null }, { lastReadAt: { lt: message.createdAt } }],
      },
      data: { lastReadMessageId: message.id, lastReadAt: message.createdAt },
    });
    if (advanced.count === 0) return;
    // До принятия запроса отправитель не видит «прочитано»; свои вкладки узнают всегда.
    const everyone = await this.access.activeUserIds(chatId);
    const targets = m.status === 'REQUEST' ? [userId] : everyone;
    this.realtime.emitToUsers(targets, 'chat:read', { chatId, userId, messageId: message.id });
  }

  // Сколько чатов «Основное» содержат непрочитанные сообщения (не от меня, не отменённые, после «прочитано»/очистки).
  async countUnreadChats(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM chat_participants cp
      WHERE cp."userId" = ${userId}::uuid AND cp.status::text = 'ACTIVE' AND cp.hidden = false
        AND EXISTS (
          SELECT 1 FROM messages m
          WHERE m."chatId" = cp."chatId" AND m."unsentAt" IS NULL
            AND m."senderId" IS DISTINCT FROM cp."userId"
            AND m."createdAt" > GREATEST(
              COALESCE(cp."lastReadAt", '-infinity'::timestamp),
              COALESCE(cp."clearedAt", '-infinity'::timestamp))
        )`;
    return Number(rows[0]?.count ?? 0);
  }

  sendSystemMessage(input: {
    senderId: string;
    recipientId: string;
    type: 'STORY_REPLY' | 'STORY_REACTION';
    storyId: string;
    text?: string;
  }): Promise<MessageDto> {
    return this.messages.sendSystemMessage(input);
  }
}
