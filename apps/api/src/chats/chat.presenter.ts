import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Prisma } from '@/generated/prisma/client';
import { mediaItemSelect, MediaService } from '@/media/media.service';
import { PostsService } from '@/posts/posts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { StoriesService } from '@/stories/stories.service';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type { PostDto } from '@/posts/dto/posts.dto';
import type { StoryDto } from '@/stories/dto/stories.dto';
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
    sharedPostId: true,
    media: { orderBy: { position: 'asc' }, select: { media: { select: mediaItemSelect } } },
    call: {
      select: {
        id: true,
        chatId: true,
        type: true,
        status: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        initiator: { select: userSummarySelect(viewerId) },
      },
    },
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
    avatarMediaId: true,
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
    private readonly media: MediaService,
    private readonly posts: PostsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Публикация и история в сообщении видны зрителю только по правилам приватности (иначе null).
  // StoriesService берём через ModuleRef: stories зависит от chats, прямая зависимость дала бы цикл.
  private async findVisibleStory(viewerId: string, storyId: string): Promise<StoryDto | null> {
    try {
      return await this.moduleRef.get(StoriesService, { strict: false }).getById(viewerId, storyId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) return null;
      throw error;
    }
  }

  /** История, которой делятся: 404/403, если зритель её не видит. */
  async assertStoryVisible(viewerId: string, storyId: string): Promise<void> {
    await this.moduleRef.get(StoriesService, { strict: false }).getById(viewerId, storyId);
  }

  // Строки БД -> MessageDto для зрителя viewerId (публикации и истории подгружаются с проверкой видимости).
  async toMessages(rows: MessageRow[], viewerId: string): Promise<MessageDto[]> {
    const posts = new Map<string, PostDto | null>();
    const stories = new Map<string, StoryDto | null>();
    for (const row of rows) {
      if (row.sharedPostId && !posts.has(row.sharedPostId)) {
        posts.set(row.sharedPostId, await this.posts.findVisibleById(viewerId, row.sharedPostId));
      }
      if (row.storyId && !stories.has(row.storyId)) {
        stories.set(row.storyId, await this.findVisibleStory(viewerId, row.storyId));
      }
    }
    return rows.map((row) =>
      this.toMessage(
        row,
        row.sharedPostId ? (posts.get(row.sharedPostId) ?? null) : null,
        row.storyId ? (stories.get(row.storyId) ?? null) : null,
      ),
    );
  }

  private toMessage(
    row: MessageRow,
    sharedPost: PostDto | null,
    story: StoryDto | null,
  ): MessageDto {
    return {
      id: row.id,
      chatId: row.chatId,
      sender: row.sender ? this.users.toSummary(row.sender) : null,
      type: row.type,
      text: row.text,
      clientId: row.clientId,
      media: row.media.map((m) => this.media.toMediaItem(m.media)),
      replyTo: row.replyTo
        ? {
            id: row.replyTo.id,
            text: row.replyTo.unsentAt ? null : row.replyTo.text,
            senderName: row.replyTo.sender?.userName ?? '',
          }
        : null,
      sharedPost,
      sharedUser: row.sharedUser ? this.users.toSummary(row.sharedUser) : null,
      storyId: row.storyId,
      story,
      call: row.call
        ? {
            id: row.call.id,
            chatId: row.call.chatId,
            type: row.call.type,
            status: row.call.status,
            initiator: this.users.toSummary(row.call.initiator),
            startedAt: row.call.startedAt.toISOString(),
            answeredAt: row.call.answeredAt?.toISOString() ?? null,
            endedAt: row.call.endedAt?.toISOString() ?? null,
          }
        : null,
      systemData: (row.systemData as Record<string, unknown> | null) ?? null,
      reactions: this.groupReactions(row.reactions),
      editedAt: row.editedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private groupReactions(reactions: MessageRow['reactions']): MessageDto['reactions'] {
    const groups = new Map<string, MessageDto['reactions'][number]>();
    for (const r of reactions) {
      const group = groups.get(r.emoji) ?? { emoji: r.emoji, users: [] };
      group.users.push(this.users.toSummary(r.user));
      groups.set(r.emoji, group);
    }
    return [...groups.values()];
  }

  async loadMessage(messageId: string, viewerId: string): Promise<MessageDto | null> {
    const row = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: messageSelect(viewerId),
    });
    return row ? (await this.toMessages([row], viewerId))[0] : null;
  }

  async loadReactions(messageId: string, viewerId: string): Promise<MessageDto['reactions']> {
    const rows = await this.prisma.messageReaction.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' },
      select: { emoji: true, user: { select: userSummarySelect(viewerId) } },
    });
    return this.groupReactions(rows);
  }

  // Событие с сообщением каждому участнику отдельно: публикации и истории зависят от зрителя.
  async emitMessage(
    event: 'message:new' | 'message:updated',
    messageId: string,
    userIds: string[],
  ): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        const message = await this.loadMessage(messageId, userId);
        if (message) this.realtime.emitToUsers([userId], event, { message });
      }),
    );
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
      avatarUrl: row.avatarMediaId ? `/api/v1/media/${row.avatarMediaId}?variant=thumb` : null,
      participants: row.participants.map((p) => ({
        ...this.users.toSummary(p.user),
        role: p.role,
        isOnline: (p.user.settings?.showActivityStatus ?? true) && this.realtime.isOnline(p.userId),
        lastActiveAt: null,
      })),
      lastMessage: last ? (await this.toMessages([last], viewerId))[0] : null,
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
