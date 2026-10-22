import { Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type { ChatDto, MessageDto } from './dto/chats.dto';

// Поля сообщения для MessageDto. viewerId нужен userSummarySelect (сейчас не влияет на результат).
export function messageSelect(viewerId: string) {
  return {
    id: true,
    chatId: true,
    type: true,
    text: true,
    clientId: true,
    storyId: true,
    systemData: true,
    editedAt: true,
    createdAt: true,
    sender: { select: userSummarySelect(viewerId) },
    sharedUser: { select: userSummarySelect(viewerId) },
    replyTo: {
      select: { id: true, text: true, unsentAt: true, sender: { select: { userName: true } } },
    },
    reactions: {
      orderBy: { createdAt: 'asc' },
      select: { emoji: true, user: { select: userSummarySelect(viewerId) } },
    },
  } satisfies Prisma.MessageSelect;
}
export type MessageRow = Prisma.MessageGetPayload<{ select: ReturnType<typeof messageSelect> }>;

export function chatSelect(viewerId: string) {
  return {
    id: true,
    type: true,
    title: true,
    lastMessageAt: true,
    participants: {
      where: { status: { not: 'LEFT' } },
      orderBy: { joinedAt: 'asc' },
      select: {
        userId: true,
        role: true,
        status: true,
        mutedUntil: true,
        clearedAt: true,
        lastReadAt: true,
        user: {
          select: {
            ...userSummarySelect(viewerId),
            settings: { select: { showActivityStatus: true } },
          },
        },
      },
    },
  } satisfies Prisma.ChatSelect;
}
export type ChatRow = Prisma.ChatGetPayload<{ select: ReturnType<typeof chatSelect> }>;

// Превращает строки БД в ответы API (Chat, Message из API_CONTRACT §1.4).
@Injectable()
export class ChatPresenter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly realtime: RealtimeService,
  ) {}

  toMessage(row: MessageRow): MessageDto {
    const groups = new Map<string, MessageDto['reactions'][number]>();
    for (const r of row.reactions) {
      const group = groups.get(r.emoji) ?? { emoji: r.emoji, users: [] };
      group.users.push(this.users.toSummary(r.user));
      groups.set(r.emoji, group);
    }
    return {
      id: row.id,
      chatId: row.chatId,
      sender: row.sender ? this.users.toSummary(row.sender) : null,
      type: row.type,
      text: row.text,
      clientId: row.clientId,
      media: [],
      replyTo: row.replyTo
        ? {
            id: row.replyTo.id,
            text: row.replyTo.unsentAt ? null : row.replyTo.text,
            senderName: row.replyTo.sender?.userName ?? '',
          }
        : null,
      sharedPost: null,
      sharedUser: row.sharedUser ? this.users.toSummary(row.sharedUser) : null,
      storyId: row.storyId,
      call: null,
      systemData: (row.systemData as Record<string, unknown> | null) ?? null,
      reactions: [...groups.values()],
      editedAt: row.editedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async loadMessage(messageId: string): Promise<MessageDto | null> {
    const row = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: messageSelect(''),
    });
    return row ? this.toMessage(row) : null;
  }

  // Чат глазами viewer: непрочитанные, «без звука», запрос, последнее видимое сообщение.
  async toChat(row: ChatRow, viewerId: string): Promise<ChatDto> {
    const me = row.participants.find((p) => p.userId === viewerId);
    const after = latest(me?.lastReadAt, me?.clearedAt);
    const [last, unreadCount] = await Promise.all([
      this.prisma.message.findFirst({
        where: {
          chatId: row.id,
          unsentAt: null,
          ...(me?.clearedAt ? { createdAt: { gt: me.clearedAt } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: messageSelect(viewerId),
      }),
      this.prisma.message.count({
        where: {
          chatId: row.id,
          unsentAt: null,
          senderId: { not: viewerId },
          ...(after ? { createdAt: { gt: after } } : {}),
        },
      }),
    ]);
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      avatarUrl: null, // до T1.B1
      participants: row.participants.map((p) => ({
        ...this.users.toSummary(p.user),
        role: p.role,
        isOnline: (p.user.settings?.showActivityStatus ?? true) && this.realtime.isOnline(p.userId),
        lastActiveAt: null,
      })),
      lastMessage: last ? this.toMessage(last) : null,
      unreadCount,
      isMuted: me?.mutedUntil ? me.mutedUntil > new Date() : false,
      isRequest: me?.status === 'REQUEST',
      updatedAt: row.lastMessageAt.toISOString(),
    };
  }

  async loadChat(chatId: string, viewerId: string): Promise<ChatDto> {
    const row = await this.prisma.chat.findUniqueOrThrow({
      where: { id: chatId },
      select: chatSelect(viewerId),
    });
    return this.toChat(row, viewerId);
  }

  // chat:updated каждому участнику: поля зависят от зрителя (непрочитанные, запрос).
  async emitChatUpdated(chatId: string, userIds: string[]): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        const chat = await this.loadChat(chatId, userId);
        this.realtime.emitToUsers([userId], 'chat:updated', { chat });
      }),
    );
  }
}

function latest(a?: Date | null, b?: Date | null): Date | null {
  if (a && b) return a > b ? a : b;
  return a ?? b ?? null;
}
