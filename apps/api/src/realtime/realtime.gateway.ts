import { ConfigService } from '@nestjs/config';
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SessionService } from '@/common/session/session.service';
import type { Env } from '@/config/env';
import { RealtimeService, userRoom, type SocketData } from './realtime.service';

// Шлюз на порту API, путь /socket.io/. Только websocket (ADR 0013): cookie приходит в одном рукопожатии.
@WebSocketGateway({ transports: ['websocket'] })
export class RealtimeGateway implements OnGatewayInit {
  private readonly webOrigin: string;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly sessions: SessionService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  afterInit(server: Server): void {
    this.realtime.attach(server);
    server.use((socket, next) => {
      void this.authenticate(socket).then(
        () => next(),
        () => next(unauthenticated()),
      );
    });
    server.on('connection', (socket) => {
      const data = socket.data as SocketData;
      void socket.join(userRoom(data.userId));
    });
  }

  // Чужой Origin или нет живой сессии — одна и та же ошибка, без подробностей.
  private async authenticate(socket: Socket): Promise<void> {
    if (socket.handshake.headers.origin !== this.webOrigin) throw new Error('bad origin');
    const token = readCookie(socket.handshake.headers.cookie, this.sessions.cookie);
    if (!token) throw new Error('no cookie');
    const user = await this.sessions.validate(token);
    if (!user) throw new Error('no session');
    const data: SocketData = { userId: user.id, sessionId: user.sessionId };
    Object.assign(socket.data as object, data);
  }
}

function unauthenticated(): Error & { data: { code: string } } {
  return Object.assign(new Error('UNAUTHENTICATED'), { data: { code: 'UNAUTHENTICATED' } });
}

function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
