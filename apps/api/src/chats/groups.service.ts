import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { validationError } from '@/common/validation';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { ChatAccessService } from './chat-access.service';
import { ChatPresenter } from './chat.presenter';
import { limitReached, notImplemented } from './chats.errors';
import type { ChatDto, UpdateChatDto } from './dto/chats.dto';
import { MAX_GROUP_SIZE } from './dto/chats.dto';
import { MessagesService } from './messages.service';

// Группы: создание, название, участники, администраторы. Каждое изменение пишет системное сообщение.
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
    private readonly presenter: ChatPresenter,
    private readonly messages: MessagesService,
    private readonly visibility: VisibilityService,
  ) {}

  async createGroup(creatorId: string, userIds: string[], title: string | null): Promise<string> {
    const { chatId, messageId } = await this.prisma.$transaction(async (tx) => {
      const chat = await tx.chat.create({
        data: {
          type: 'GROUP',
          title,
          createdById: creatorId,
          participants: {
            create: [
              { userId: creatorId, role: 'ADMIN' },
              ...userIds.map((userId) => ({ userId })),
            ],
          },
        },
        select: { id: true },
      });
      const id = await this.messages.createSystemInTx(tx, chat.id, creatorId, {
        event: 'CHAT_CREATED',
        userIds,
      });
      return { chatId: chat.id, messageId: id };
    });
    await this.finish(chatId, messageId);
    return chatId;
  }

  // Название и фото: любой участник группы.
  async update(chatId: string, userId: string, dto: UpdateChatDto): Promise<ChatDto> {
    await this.assertGroupMember(chatId, userId);
    if (dto.avatarMediaId) throw notImplemented('Group photo', 'T1.B1');
    if (dto.title === undefined) throw validationError('title', 'title is required');
    const messageId = await this.prisma.$transaction(async (tx) => {
      await tx.chat.update({ where: { id: chatId }, data: { title: dto.title } });
      return this.messages.createSystemInTx(tx, chatId, userId, {
        event: 'TITLE_CHANGED',
        title: dto.title ?? null,
      });
    });
    await this.finish(chatId, messageId);
    return this.presenter.loadChat(chatId, userId);
  }

  async addParticipants(chatId: string, userId: string, userIds: string[]): Promise<ChatDto> {
    await this.assertGroupMember(chatId, userId);
    for (const id of userIds) {
      if (id === userId) throw validationError('userIds', 'userIds must not contain you');
      await this.visibility.assertCanViewProfile(userId, id);
    }
    const active = await this.prisma.chatParticipant.findMany({
      where: { chatId, status: { not: 'LEFT' } },
      select: { userId: true },
    });
    const activeIds = new Set(active.map((p) => p.userId));
    if (userIds.some((id) => activeIds.has(id))) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Already a member' });
    }
    if (activeIds.size + userIds.length > MAX_GROUP_SIZE) throw limitReached();
    const messageId = await this.prisma.$transaction(async (tx) => {
      for (const id of userIds) {
        await tx.chatParticipant.upsert({
          where: { chatId_userId: { chatId, userId: id } },
          create: { chatId, userId: id },
          update: { status: 'ACTIVE', role: 'MEMBER', joinedAt: new Date(), hidden: false },
        });
      }
      return this.messages.createSystemInTx(tx, chatId, userId, { event: 'MEMBER_ADDED', userIds });
    });
    await this.finish(chatId, messageId);
    return this.presenter.loadChat(chatId, userId);
  }

  // Администратор убирает участника или участник выходит сам (actorId === targetId).
  async removeMember(chatId: string, actorId: string, targetId: string): Promise<void> {
    const actor = await this.assertGroupMember(chatId, actorId);
    if (actorId !== targetId && actor.role !== 'ADMIN') throw new ForbiddenException();
    const target = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: targetId } },
      select: { status: true },
    });
    if (!target || target.status === 'LEFT') throw new NotFoundException();

    const messageId = await this.prisma.$transaction(async (tx) => {
      await tx.chatParticipant.update({
        where: { chatId_userId: { chatId, userId: targetId } },
        data: { status: 'LEFT', role: 'MEMBER' },
      });
      const rest = await tx.chatParticipant.findMany({
        where: { chatId, status: { not: 'LEFT' } },
        orderBy: { joinedAt: 'asc' },
        select: { userId: true, role: true },
      });
      if (rest.length === 0) {
        await tx.chat.delete({ where: { id: chatId } }); // все ушли — чат удаляется полностью
        return null;
      }
      if (!rest.some((p) => p.role === 'ADMIN')) {
        await tx.chatParticipant.update({
          where: { chatId_userId: { chatId, userId: rest[0].userId } },
          data: { role: 'ADMIN' },
        });
      }
      return this.messages.createSystemInTx(tx, chatId, actorId, {
        event: actorId === targetId ? 'MEMBER_LEFT' : 'MEMBER_REMOVED',
        userIds: [targetId],
      });
    });
    if (messageId) await this.finish(chatId, messageId);
  }

  async setAdmin(chatId: string, actorId: string, targetId: string, admin: boolean): Promise<void> {
    const actor = await this.assertGroupMember(chatId, actorId);
    if (actor.role !== 'ADMIN') throw new ForbiddenException();
    const target = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: targetId } },
      select: { status: true, role: true },
    });
    if (!target || target.status === 'LEFT') throw new NotFoundException();
    if (!admin && targetId === actorId) {
      const admins = await this.prisma.chatParticipant.count({
        where: { chatId, role: 'ADMIN', status: { not: 'LEFT' } },
      });
      if (admins <= 1) throw validationError('userId', 'The last administrator cannot be removed');
    }
    await this.prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId: targetId } },
      data: { role: admin ? 'ADMIN' : 'MEMBER' },
    });
    await this.presenter.emitChatUpdated(chatId, await this.access.activeUserIds(chatId));
  }

  private async assertGroupMember(chatId: string, userId: string) {
    const member = await this.access.assertMember(chatId, userId);
    if (member.type !== 'GROUP') throw validationError('chatId', 'This is not a group chat');
    return member;
  }

  // После транзакции: сообщение и обновлённый чат — всем действующим участникам.
  private async finish(chatId: string, messageId: string): Promise<void> {
    await this.messages.announce(messageId, chatId);
    await this.presenter.emitChatUpdated(chatId, await this.access.activeUserIds(chatId));
  }
}
