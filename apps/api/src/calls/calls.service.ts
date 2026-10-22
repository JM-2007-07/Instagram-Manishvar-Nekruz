import { ConflictException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Env } from '@/config/env';
import type { Prisma } from '@/generated/prisma/client';
import { MessagesService } from '@/chats/messages.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type { CallDto, IceServersDto } from './calls.dto';

const RING_TIMEOUT_MS = 30_000; // без ответа 30 с -> MISSED
const STALE_RINGING_MS = 60_000; // RINGING старше минуты — «зависший» (сервер перезапускался)
const STALE_ONGOING_MS = 12 * 60 * 60 * 1000;
const TURN_TTL_SECONDS = 60 * 60;
export const SIGNAL_MAX_BYTES = 64 * 1024; // размер payload сигнала WebRTC (REALTIME.md)
export const SIGNAL_KINDS = ['offer', 'answer', 'ice'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

function callSelect(viewerId: string) {
  return {
    id: true,
    chatId: true,
    type: true,
    status: true,
    startedAt: true,
    answeredAt: true,
    endedAt: true,
    initiator: { select: userSummarySelect(viewerId) },
    participants: { select: { userId: true } },
  } satisfies Prisma.CallSelect;
}
type CallRow = Prisma.CallGetPayload<{ select: ReturnType<typeof callSelect> }>;

// Звонки 1:1 (ADR 0015). SDP и ICE не сохраняются: сервер только пересылает их через Socket.IO.
@Injectable()
export class CallsService implements OnModuleDestroy {
  private readonly stunUrls: string[];
  private readonly turnUrls: string[];
  private readonly turnSecret: string;
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly realtime: RealtimeService,
    private readonly users: UsersService,
    private readonly messages: MessagesService,
    config: ConfigService<Env, true>,
  ) {
    this.stunUrls = splitList(config.get('STUN_URLS', { infer: true }));
    this.turnUrls = splitList(config.get('TURN_URLS', { infer: true }));
    this.turnSecret = config.get('TURN_SHARED_SECRET', { infer: true }) ?? '';
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  // STUN всегда; TURN — с временными учётными данными (схема coturn use-auth-secret), если задан секрет.
  iceServers(userId: string): IceServersDto {
    const iceServers: IceServersDto['iceServers'] = [];
    if (this.stunUrls.length > 0) iceServers.push({ urls: this.stunUrls });
    if (this.turnUrls.length > 0 && this.turnSecret) {
      const expires = Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS;
      const username = `${expires}:${userId}`;
      const credential = createHmac('sha1', this.turnSecret).update(username).digest('base64');
      iceServers.push({ urls: this.turnUrls, username, credential });
    }
    return { iceServers };
  }

  async start(userId: string, chatId: string, type: 'AUDIO' | 'VIDEO'): Promise<CallDto> {
    // Не участник чата неотличим от несуществующего чата.
    const members = await this.prisma.chatParticipant.findMany({
      where: { chatId },
      select: { userId: true, status: true },
    });
    const me = members.find((member) => member.userId === userId);
    if (!me || me.status !== 'ACTIVE') throw new NotFoundException();
    const others = members.filter(
      (member) => member.userId !== userId && member.status === 'ACTIVE',
    );
    if (others.length === 0) throw new NotFoundException();

    for (const other of others) {
      // Блокировка в любую сторону -> 404 (не раскрываем, кто кого заблокировал).
      await this.visibility.assertCanViewProfile(userId, other.userId);
    }

    const everyone = [userId, ...others.map((other) => other.userId)];
    const now = Date.now();
    const busy = await this.prisma.call.findFirst({
      where: {
        participants: { some: { userId: { in: everyone } } },
        OR: [
          { status: 'RINGING', startedAt: { gt: new Date(now - STALE_RINGING_MS) } },
          { status: 'ONGOING', startedAt: { gt: new Date(now - STALE_ONGOING_MS) } },
        ],
      },
      select: { id: true },
    });
    if (busy) {
      throw new ConflictException({
        code: 'CALL_BUSY',
        message: 'Someone in this chat is already on a call',
      });
    }

    const call = await this.prisma.call.create({
      data: {
        chatId,
        initiatorId: userId,
        type,
        participants: {
          create: everyone.map((id) => ({
            userId: id,
            joinedAt: id === userId ? new Date() : null,
          })),
        },
      },
      select: callSelect(userId),
    });
    const dto = this.toDto(call);
    this.realtime.emitToUsers(everyone, 'call:incoming', { call: dto });
    this.scheduleMissed(call.id);
    return dto;
  }

  async accept(userId: string, callId: string): Promise<CallDto> {
    const call = await this.findForParticipant(userId, callId);
    if (call.initiator.id === userId) throw new NotFoundException();
    const now = new Date();
    const updated = await this.prisma.call.updateMany({
      where: { id: callId, status: 'RINGING' },
      data: { status: 'ONGOING', answeredAt: now },
    });
    if (updated.count === 0) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Call is no longer ringing' });
    }
    await this.prisma.callParticipant.update({
      where: { callId_userId: { callId, userId } },
      data: { joinedAt: now },
    });
    this.clearTimer(callId);
    const fresh = await this.findForParticipant(userId, callId);
    this.realtime.emitToUsers(participantIds(fresh), 'call:accepted', { callId, userId });
    return this.toDto(fresh);
  }

  async decline(userId: string, callId: string): Promise<void> {
    const call = await this.findForParticipant(userId, callId);
    if (call.initiator.id === userId) throw new NotFoundException();
    const updated = await this.prisma.call.updateMany({
      where: { id: callId, status: 'RINGING' },
      data: { status: 'DECLINED', endedAt: new Date() },
    });
    if (updated.count === 0) return; // уже принят, отменён или пропущен
    this.clearTimer(callId);
    const fresh = await this.findForParticipant(userId, callId);
    this.realtime.emitToUsers(participantIds(fresh), 'call:declined', { callId, userId });
    this.realtime.emitToUsers(participantIds(fresh), 'call:ended', { call: this.toDto(fresh) });
    await this.recordInChat(fresh);
  }

  // Завершить может любой участник. Повторный вызов безопасен. Отмена звонка без ответа = MISSED.
  async end(userId: string, callId: string): Promise<CallDto> {
    const call = await this.findForParticipant(userId, callId);
    const now = new Date();
    const ended = await this.prisma.call.updateMany({
      where: { id: callId, status: 'ONGOING' },
      data: { status: 'ENDED', endedAt: now },
    });
    const missed =
      ended.count === 0
        ? await this.prisma.call.updateMany({
            where: { id: callId, status: 'RINGING' },
            data: { status: 'MISSED', endedAt: now },
          })
        : { count: 0 };
    await this.prisma.callParticipant.updateMany({
      where: { callId, userId, leftAt: null },
      data: { leftAt: now },
    });
    const fresh = await this.findForParticipant(userId, callId);
    if (ended.count + missed.count > 0) {
      this.clearTimer(callId);
      this.realtime.emitToUsers(participantIds(call), 'call:ended', { call: this.toDto(fresh) });
      await this.recordInChat(fresh);
    }
    return this.toDto(fresh);
  }

  async get(userId: string, callId: string): Promise<CallDto> {
    return this.toDto(await this.findForParticipant(userId, callId));
  }

  // Пересылка сигнала WebRTC: оба — участники звонка, звонок идёт. false — нельзя.
  async relaySignal(
    fromUserId: string,
    input: { callId: string; toUserId: string; kind: SignalKind; payload: unknown },
  ): Promise<boolean> {
    if (input.toUserId === fromUserId) return false;
    const call = await this.prisma.call.findFirst({
      where: {
        id: input.callId,
        status: { in: ['RINGING', 'ONGOING'] },
        AND: [
          { participants: { some: { userId: fromUserId } } },
          { participants: { some: { userId: input.toUserId } } },
        ],
      },
      select: { id: true },
    });
    if (!call) return false;
    this.realtime.emitToUsers([input.toUserId], 'call:signal', {
      callId: input.callId,
      fromUserId,
      kind: input.kind,
      payload: input.payload,
    });
    return true;
  }

  private scheduleMissed(callId: string): void {
    const timer = setTimeout(() => {
      this.timers.delete(callId);
      void this.markMissed(callId);
    }, RING_TIMEOUT_MS);
    timer.unref();
    this.timers.set(callId, timer);
  }

  private async markMissed(callId: string): Promise<void> {
    const updated = await this.prisma.call.updateMany({
      where: { id: callId, status: 'RINGING' },
      data: { status: 'MISSED', endedAt: new Date() },
    });
    if (updated.count === 0) return;
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: callSelect(''),
    });
    if (call) {
      this.realtime.emitToUsers(participantIds(call), 'call:ended', { call: this.toDto(call) });
      await this.recordInChat(call);
    }
  }

  // Сообщение о звонке в чате (CALL) — после того, как звонок завершён, отклонён или пропущен.
  // Ошибка записи не должна ломать сам звонок.
  private async recordInChat(call: CallRow): Promise<void> {
    try {
      await this.messages.createCallMessage(call.chatId, call.initiator.id, call.id);
    } catch {
      // сообщение о звонке второстепенно
    }
  }

  private clearTimer(callId: string): void {
    const timer = this.timers.get(callId);
    if (timer) clearTimeout(timer);
    this.timers.delete(callId);
  }

  // Чужой звонок неотличим от несуществующего.
  private async findForParticipant(userId: string, callId: string): Promise<CallRow> {
    const call = await this.prisma.call.findFirst({
      where: { id: callId, participants: { some: { userId } } },
      select: callSelect(userId),
    });
    if (!call) throw new NotFoundException();
    return call;
  }

  private toDto(call: CallRow): CallDto {
    return {
      id: call.id,
      chatId: call.chatId,
      type: call.type,
      status: call.status,
      initiator: this.users.toSummary(call.initiator),
      startedAt: call.startedAt.toISOString(),
      answeredAt: call.answeredAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
    };
  }
}

function participantIds(call: CallRow): string[] {
  return call.participants.map((participant) => participant.userId);
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
