import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decodeCursor, encodeCursor, type Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { validationError } from '@/common/validation';
import type { MessageType, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { ChatAccessService } from './chat-access.service';
import { ChatPresenter, messageSelect } from './chat.presenter';
import { notImplemented } from './chats.errors';
import type { MessageDto, SendMessageDto, ShareMessageDto } from './dto/chats.dto';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

interface NewMessage {
  type: MessageType;
  text?: string | null;
  clientId?: string;
  replyToId?: string;
  sharedUserId?: string;
  storyId?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
    private readonly presenter: ChatPresenter,
    private readonly visibility: VisibilityService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(chatId: string, userId: string, query: CursorQueryDto): Promise<Page<MessageDto>> {
    await this.access.assertMember(chatId, userId);
    const me = await this.prisma.chatParticipant.findUniqueOrThrow({
      where: { chatId_userId: { chatId, userId } },
      select: { clearedAt: true },
    });
    const conditions: Prisma.MessageWhereInput[] = [{ chatId, unsentAt: null }];
    if (me.clearedAt) conditions.push({ createdAt: { gt: me.clearedAt } });
    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      conditions.push({
        OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
      });
    }
    const rows = await this.prisma.message.findMany({
      where: { AND: conditions },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: messageSelect(userId),
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.presenter.toMessage(row)),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  async send(chatId: string, userId: string, dto: SendMessageDto): Promise<MessageDto> {
    await this.access.assertMember(chatId, userId);
    if (dto.type === 'MEDIA' || dto.type === 'VOICE') {
      throw notImplemented('Media messages', 'T1.B1');
    }
    if (dto.type === 'SHARE_POST') throw notImplemented('Sharing a post', 'T1.B4');
    if (dto.type === 'SHARE_STORY') throw notImplemented('Sharing a story', 'T2.B1');

    const message: NewMessage = { type: dto.type, clientId: dto.clientId };
    if (dto.type === 'TEXT') {
      const text = dto.text?.trim();
      if (!text) throw validationError('text', 'text must not be empty');
      message.text = text;
    } else {
      if (!dto.sharedUserId) throw validationError('sharedUserId', 'sharedUserId is required');
      await this.visibility.assertCanViewProfile(userId, dto.sharedUserId);
      message.sharedUserId = dto.sharedUserId;
      message.text = dto.text?.trim() || null;
    }
    if (dto.replyToId) {
      const target = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, chatId, unsentAt: null },
        select: { id: true },
      });
      if (!target) throw new NotFoundException();
      message.replyToId = target.id;
    }
    return this.post(chatId, userId, message);
  }

  // Поделиться профилем сразу в несколько чатов (F-INT-11). Публикация и история — после модулей B.
  async share(userId: string, dto: ShareMessageDto): Promise<{ messages: MessageDto[] }> {
    if (dto.postId) throw notImplemented('Sharing a post', 'T1.B4');
    if (dto.storyId) throw notImplemented('Sharing a story', 'T2.B1');
    if (!dto.userId) throw validationError('userId', 'userId is required');
    if (!dto.userIds?.length && !dto.chatIds?.length) {
      throw validationError('userIds', 'userIds or chatIds is required');
    }
    await this.visibility.assertCanViewProfile(userId, dto.userId);
    const chatIds = new Set<string>();
    for (const chatId of dto.chatIds ?? []) {
      await this.access.assertMember(chatId, userId);
      chatIds.add(chatId);
    }
    for (const otherId of dto.userIds ?? []) {
      chatIds.add((await this.access.findOrCreateDirect(userId, otherId)).chatId);
    }
    const messages: MessageDto[] = [];
    for (const chatId of chatIds) {
      messages.push(
        await this.post(chatId, userId, {
          type: 'SHARE_PROFILE',
          sharedUserId: dto.userId,
          text: dto.text?.trim() || null,
        }),
      );
    }
    return { messages };
  }

  // Ответ или реакция на историю: сообщение в личном чате с автором истории (вызывает модуль stories).
  async sendSystemMessage(input: {
    senderId: string;
    recipientId: string;
    type: 'STORY_REPLY' | 'STORY_REACTION';
    storyId: string;
    text?: string;
  }): Promise<MessageDto> {
    const { chatId } = await this.access.findOrCreateDirect(input.senderId, input.recipientId);
    return this.post(chatId, input.senderId, {
      type: input.type,
      storyId: input.storyId,
      text: input.text?.trim() || null,
    });
  }

  async edit(chatId: string, messageId: string, userId: string, text: string): Promise<MessageDto> {
    await this.access.assertMember(chatId, userId);
    const message = await this.ownMessage(chatId, messageId, userId);
    if (message.type !== 'TEXT') throw validationError('messageId', 'Only text can be edited');
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ConflictException({
        code: 'EDIT_WINDOW_EXPIRED',
        message: 'Messages can be edited within 15 minutes',
      });
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
    });
    const dto = await this.presenter.loadMessage(messageId);
    if (!dto) throw new NotFoundException();
    this.realtime.emitToUsers(await this.access.activeUserIds(chatId), 'message:updated', {
      message: dto,
    });
    return dto;
  }

  // «Отменить отправку»: сообщение исчезает у всех, текст и реакции удаляются.
  async unsend(chatId: string, messageId: string, userId: string): Promise<void> {
    await this.access.assertMember(chatId, userId);
    await this.ownMessage(chatId, messageId, userId);
    await this.prisma.$transaction([
      this.prisma.messageReaction.deleteMany({ where: { messageId } }),
      this.prisma.messageMedia.deleteMany({ where: { messageId } }),
      this.prisma.message.update({
        where: { id: messageId },
        data: { unsentAt: new Date(), text: null },
      }),
    ]);
    this.realtime.emitToUsers(await this.access.activeUserIds(chatId), 'message:unsent', {
      chatId,
      messageId,
    });
  }

  async react(chatId: string, messageId: string, userId: string, emoji: string): Promise<void> {
    await this.access.assertMember(chatId, userId);
    await this.visibleMessage(chatId, messageId);
    await this.prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji, createdAt: new Date() },
    });
    await this.emitReactions(chatId, messageId);
  }

  async unreact(chatId: string, messageId: string, userId: string): Promise<void> {
    await this.access.assertMember(chatId, userId);
    await this.visibleMessage(chatId, messageId);
    await this.prisma.messageReaction.deleteMany({ where: { messageId, userId } });
    await this.emitReactions(chatId, messageId);
  }

  // Системное сообщение группы ("добавил(а)", "вышел(а)"): создаётся в транзакции вызывающего, объявляется после неё.
  async createSystemInTx(
    tx: Prisma.TransactionClient,
    chatId: string,
    actorId: string,
    systemData: Prisma.InputJsonObject,
  ): Promise<string> {
    const now = new Date();
    const message = await tx.message.create({
      data: { chatId, senderId: actorId, type: 'SYSTEM', systemData, createdAt: now },
      select: { id: true },
    });
    await tx.chat.update({ where: { id: chatId }, data: { lastMessageAt: now } });
    return message.id;
  }

  async announce(messageId: string, chatId: string): Promise<void> {
    const dto = await this.presenter.loadMessage(messageId);
    if (dto) {
      this.realtime.emitToUsers(await this.access.activeUserIds(chatId), 'message:new', {
        message: dto,
      });
    }
  }

  // --- внутренние --------------------------------------------------------------------------------

  private async post(chatId: string, senderId: string, data: NewMessage): Promise<MessageDto> {
    if (data.clientId) {
      const dup = await this.prisma.message.findFirst({
        where: { chatId, senderId, clientId: data.clientId },
        select: { id: true },
      });
      const dupDto = dup ? await this.presenter.loadMessage(dup.id) : null;
      if (dupDto) return dupDto;
    }
    const now = new Date();
    const { id, accepted } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { chatId, senderId, ...data, createdAt: now },
        select: { id: true },
      });
      await tx.chat.update({ where: { id: chatId }, data: { lastMessageAt: now } });
      await tx.chatParticipant.updateMany({ where: { chatId }, data: { hidden: false } });
      // Ответ получателя на запрос = принятие запроса.
      const promoted = await tx.chatParticipant.updateMany({
        where: { chatId, userId: senderId, status: 'REQUEST' },
        data: { status: 'ACTIVE' },
      });
      return { id: created.id, accepted: promoted.count > 0 };
    });
    const dto = await this.presenter.loadMessage(id);
    if (!dto) throw new NotFoundException();
    const userIds = await this.access.activeUserIds(chatId);
    this.realtime.emitToUsers(userIds, 'message:new', { message: dto });
    if (accepted) await this.presenter.emitChatUpdated(chatId, userIds);
    return dto;
  }

  // Своё неотменённое сообщение чата; чужое — 403, нет такого — 404.
  private async ownMessage(chatId: string, messageId: string, userId: string) {
    const message = await this.visibleMessage(chatId, messageId);
    if (message.senderId !== userId) throw new ForbiddenException();
    return message;
  }

  private async visibleMessage(chatId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, chatId, unsentAt: null },
      select: { id: true, senderId: true, type: true, createdAt: true },
    });
    if (!message) throw new NotFoundException();
    return message;
  }

  private async emitReactions(chatId: string, messageId: string): Promise<void> {
    const dto = await this.presenter.loadMessage(messageId);
    this.realtime.emitToUsers(await this.access.activeUserIds(chatId), 'message:reaction', {
      chatId,
      messageId,
      reactions: dto?.reactions ?? [],
    });
  }
}
