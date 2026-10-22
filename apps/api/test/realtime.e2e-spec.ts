import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { RealtimeService } from '@/realtime/realtime.service';
import { SessionService } from '@/common/session/session.service';
import { createTestApp, createUser, ORIGIN, resetDb, type TestUser } from './helpers';

const WAIT_MS = 2500;
const SILENCE_MS = 400;

interface ClientSession {
  sessionId: string;
  cookie: string;
}

describe('Realtime (Socket.IO)', () => {
  let app: INestApplication;
  let sessions: SessionService;
  let realtime: RealtimeService;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    // Нужен реальный порт: Socket.IO-клиент подключается по сети, supertest здесь не подходит.
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    sessions = app.get(SessionService);
    realtime = app.get(RealtimeService);
  });

  beforeEach(async () => {
    await resetDb(app);
  });

  afterEach(() => {
    for (const s of sockets.splice(0)) s.close();
  });

  afterAll(async () => {
    await app.close();
  });

  // Создаёт отдельную сессию пользователя (id нужен для отзыва и закрытия сокета).
  async function newSession(user: TestUser): Promise<ClientSession> {
    const { token, sessionId } = await sessions.create(user.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
    return { sessionId, cookie: `${sessions.cookie}=${token}` };
  }

  function makeSocket(cookie?: string, origin: string | null = ORIGIN): Socket {
    const extraHeaders: Record<string, string> = {};
    if (cookie) extraHeaders.Cookie = cookie;
    if (origin) extraHeaders.Origin = origin;
    const socket = io(url, {
      transports: ['websocket'],
      extraHeaders,
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  }

  function once<T = unknown>(socket: Socket, event: string, ms = WAIT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  // Подключается и ждёт 'connect'; при отказе отклоняет промис ошибкой connect_error.
  function connect(cookie?: string, origin: string | null = ORIGIN): Promise<Socket> {
    const socket = makeSocket(cookie, origin);
    return new Promise<Socket>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), WAIT_MS);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('connect_error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // Ждёт отказа при рукопожатии и возвращает ошибку.
  async function connectFailure(cookie?: string, origin: string | null = ORIGIN): Promise<Error> {
    try {
      await connect(cookie, origin);
    } catch (err) {
      return err as Error;
    }
    throw new Error('socket connected, but was expected to be rejected');
  }

  function expectUnauthenticated(err: Error & { data?: unknown }): void {
    const text = `${err.message} ${JSON.stringify(err.data ?? '')}`;
    expect(text).toContain('UNAUTHENTICATED');
  }

  async function expectSilence(socket: Socket, event: string): Promise<void> {
    let received = false;
    socket.once(event, () => {
      received = true;
    });
    await new Promise((r) => setTimeout(r, SILENCE_MS));
    expect(received).toBe(false);
  }

  describe('рукопожатие', () => {
    it('cookie сессии и верный Origin: подключается', async () => {
      const user = await createUser(app);
      const { cookie } = await newSession(user);
      const socket = await connect(cookie);
      expect(socket.connected).toBe(true);
    });

    it('без cookie: connect_error UNAUTHENTICATED', async () => {
      expectUnauthenticated(await connectFailure());
    });

    it('неверный токен сессии: connect_error UNAUTHENTICATED', async () => {
      expectUnauthenticated(await connectFailure(`${sessions.cookie}=not-a-real-token`));
    });

    it('чужой Origin: отказ при рукопожатии', async () => {
      const user = await createUser(app);
      const { cookie } = await newSession(user);
      await connectFailure(cookie, 'http://evil.example');
    });
  });

  describe('доставка событий', () => {
    it('emitToUsers доходит до обеих вкладок пользователя и не доходит до другого пользователя', async () => {
      const alice = await createUser(app);
      const bob = await createUser(app);
      const tab1 = await connect((await newSession(alice)).cookie);
      const tab2 = await connect((await newSession(alice)).cookie);
      const bobSocket = await connect((await newSession(bob)).cookie);

      const got1 = once(tab1, 'badges:updated');
      const got2 = once(tab2, 'badges:updated');
      const payload = { unreadNotifications: 1, unreadChats: 0, followRequests: 0 };
      realtime.emitToUsers([alice.id], 'badges:updated', payload);

      expect(await got1).toEqual(payload);
      expect(await got2).toEqual(payload);
      await expectSilence(bobSocket, 'badges:updated');
    });
  });

  describe('закрытие сокетов при завершении сессии', () => {
    it('POST /auth/logout закрывает сокет этой сессии, сокет другой сессии остаётся', async () => {
      const alice = await createUser(app);
      const current = await newSession(alice);
      const other = await newSession(alice);
      const currentSocket = await connect(current.cookie);
      const otherSocket = await connect(other.cookie);

      const closed = once(currentSocket, 'disconnect');
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', current.cookie)
        .expect(204);

      await closed;
      expect(currentSocket.connected).toBe(false);
      await new Promise((r) => setTimeout(r, SILENCE_MS));
      expect(otherSocket.connected).toBe(true);
    });

    it('DELETE /auth/sessions/{id} закрывает сокет той сессии, текущий остаётся', async () => {
      const alice = await createUser(app);
      const current = await newSession(alice);
      const other = await newSession(alice);
      const currentSocket = await connect(current.cookie);
      const otherSocket = await connect(other.cookie);

      const closed = once(otherSocket, 'disconnect');
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${other.sessionId}`)
        .set('Origin', ORIGIN)
        .set('Cookie', current.cookie)
        .expect(204);

      await closed;
      expect(otherSocket.connected).toBe(false);
      await new Promise((r) => setTimeout(r, SILENCE_MS));
      expect(currentSocket.connected).toBe(true);
    });

    it('смена пароля закрывает сокеты остальных сессий, текущий остаётся', async () => {
      const alice = await createUser(app);
      const current = await newSession(alice);
      const other = await newSession(alice);
      const currentSocket = await connect(current.cookie);
      const otherSocket = await connect(other.cookie);

      const closed = once(otherSocket, 'disconnect');
      await request(app.getHttpServer())
        .post('/api/v1/auth/password/change')
        .set('Origin', ORIGIN)
        .set('Cookie', current.cookie)
        .send({ currentPassword: alice.password, newPassword: 'Brand-new-pass-9' })
        .expect(204);

      await closed;
      expect(otherSocket.connected).toBe(false);
      await new Promise((r) => setTimeout(r, SILENCE_MS));
      expect(currentSocket.connected).toBe(true);
    });
  });
});
