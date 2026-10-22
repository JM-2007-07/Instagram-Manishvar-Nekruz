import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { isBoolean, isUUID } from 'class-validator';
import type { Socket } from 'socket.io';
import { RealtimeService, type SocketData } from '@/realtime/realtime.service';
import { ChatAccessService } from './chat-access.service';

const TYPING_INTERVAL_MS = 2000;

type Ack = { ok: true } | { ok: false; code: string };

// Клиент -> сервер: chat:typing. Тот же сервер Socket.IO, что и у RealtimeGateway (одинаковые опции),
// поэтому сессия уже проверена в его middleware и лежит в socket.data.
@WebSocketGateway({ transports: ['websocket'] })
export class ChatsGateway {
  private readonly lastTyping = new Map<string, number>(); // socket.id -> время последнего события

  constructor(
    private readonly access: ChatAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  @SubscribeMessage('chat:typing')
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const { chatId, isTyping } = (body ?? {}) as { chatId?: unknown; isTyping?: unknown };
    if (typeof chatId !== 'string' || !isUUID(chatId) || !isBoolean(isTyping)) {
      return { ok: false, code: 'BAD_REQUEST' };
    }
    const now = Date.now();
    if (isTyping) {
      if (now - (this.lastTyping.get(socket.id) ?? 0) < TYPING_INTERVAL_MS) {
        return { ok: false, code: 'RATE_LIMITED' };
      }
      this.lastTyping.set(socket.id, now);
      socket.once('disconnect', () => this.lastTyping.delete(socket.id));
    }
    const { userId } = socket.data as SocketData;
    try {
      await this.access.assertMember(chatId, userId);
    } catch {
      return { ok: false, code: 'NOT_FOUND' };
    }
    const others = (await this.access.activeUserIds(chatId)).filter((id) => id !== userId);
    this.realtime.emitToUsers(others, 'chat:typing', { chatId, userId, isTyping });
    return { ok: true };
  }
}
