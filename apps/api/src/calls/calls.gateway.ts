import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Socket } from 'socket.io';
import type { SocketData } from '@/realtime/realtime.service';
import { CallsService, SIGNAL_KINDS, SIGNAL_MAX_BYTES, type SignalKind } from './calls.service';

type Ack = { ok: true } | { ok: false; code: string };

// Тот же Socket.IO-сервер, что у RealtimeGateway (одинаковые настройки): обработчик клиентских событий звонков.
// Сессию сокета уже проверил RealtimeGateway; пользователь — только из socket.data.
@WebSocketGateway({ transports: ['websocket'] })
export class CallsGateway {
  constructor(private readonly calls: CallsService) {}

  @SubscribeMessage('call:signal')
  async onSignal(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const { userId } = socket.data as SocketData;
    const input = parseSignal(body);
    if (!userId || !input) return { ok: false, code: 'BAD_REQUEST' };
    const delivered = await this.calls.relaySignal(userId, input);
    return delivered ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
  }
}

function parseSignal(
  body: unknown,
): { callId: string; toUserId: string; kind: SignalKind; payload: unknown } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { callId, toUserId, kind, payload } = body as Record<string, unknown>;
  if (typeof callId !== 'string' || !isUUID(callId)) return null;
  if (typeof toUserId !== 'string' || !isUUID(toUserId)) return null;
  if (!SIGNAL_KINDS.includes(kind as SignalKind)) return null;
  if (payload === undefined || JSON.stringify(payload).length > SIGNAL_MAX_BYTES) return null;
  return { callId, toUserId, kind: kind as SignalKind, payload };
}
