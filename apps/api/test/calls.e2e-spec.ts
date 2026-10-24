import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, loginAs, ORIGIN, resetDb, withOrigin } from './helpers';
import { resetThrottler } from './helpers/throttler';

const WAIT_MS = 2500;
const SILENCE_MS = 400;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Calls', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.close();
  });
  afterAll(async () => {
    await app.close();
  });

  function connect(cookie: string): Promise<Socket> {
    const socket = io(url, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie, Origin: ORIGIN },
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), WAIT_MS);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('connect_error', reject);
    });
  }

  function once<T = unknown>(socket: Socket, event: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), WAIT_MS);
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  function emitAck(
    socket: Socket,
    event: string,
    data: unknown,
  ): Promise<{ ok: boolean; code?: string }> {
    return socket.timeout(WAIT_MS).emitWithAck(event, data);
  }

  async function setup() {
    const alice = await createUser(app);
    const bob = await createUser(app);
    const carol = await createUser(app);
    const chat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
        createdById: alice.id,
        directKey: [alice.id, bob.id].sort().join(':'),
        participants: { create: [{ userId: alice.id }, { userId: bob.id }] },
      },
      select: { id: true },
    });
    return {
      alice,
      bob,
      carol,
      chatId: chat.id,
      a: await loginAs(app, alice),
      b: await loginAs(app, bob),
      c: await loginAs(app, carol),
    };
  }

  const api = (method: 'get' | 'post', path: string, cookie: string | null) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`);
    return cookie ? req.set(withOrigin({ Cookie: cookie })) : req.set(withOrigin());
  };

  describe('REST', () => {
    it('без сессии: 401', async () => {
      expect((await api('get', '/calls/ice-servers', null)).status).toBe(401);
      expect((await api('post', `/calls/${UNKNOWN_ID}/accept`, null)).status).toBe(401);
    });

    it('ice-servers: STUN из настроек, TURN без секрета не отдаётся', async () => {
      const { a } = await setup();
      const res = await api('get', '/calls/ice-servers', a);
      expect(res.status).toBe(200);
      expect(res.body.iceServers[0].urls.length).toBeGreaterThan(0);
      expect(JSON.stringify(res.body)).not.toContain('credential');
    });

    it('основной сценарий: звонок -> принять -> завершить, события доходят', async () => {
      const { alice, bob, chatId, a, b } = await setup();
      const bobSocket = await connect(b);
      const incoming = once<{ call: { id: string; status: string } }>(bobSocket, 'call:incoming');
      const started = await api('post', `/chats/${chatId}/calls`, a).send({ type: 'VIDEO' });
      expect(started.status).toBe(201);
      expect(started.body.status).toBe('RINGING');
      expect(started.body.initiator.id).toBe(alice.id);
      expect((await incoming).call.id).toBe(started.body.id);

      // Занято: второй звонок в том же чате.
      const busy = await api('post', `/chats/${chatId}/calls`, b).send({ type: 'AUDIO' });
      expect(busy.status).toBe(409);

      // Инициатор не может принять свой звонок.
      expect((await api('post', `/calls/${started.body.id}/accept`, a)).status).toBe(404);

      const accepted = once<{ callId: string; userId: string }>(bobSocket, 'call:accepted');
      const accept = await api('post', `/calls/${started.body.id}/accept`, b);
      expect(accept.status).toBe(200);
      expect(accept.body.status).toBe('ONGOING');
      expect(await accepted).toEqual({ callId: started.body.id, userId: bob.id });

      // Повторное принятие — 409.
      expect((await api('post', `/calls/${started.body.id}/accept`, b)).status).toBe(409);

      const ended = once<{ call: { status: string } }>(bobSocket, 'call:ended');
      const end = await api('post', `/calls/${started.body.id}/end`, a);
      expect(end.status).toBe(200);
      expect(end.body.status).toBe('ENDED');
      expect((await ended).call.status).toBe('ENDED');
      expect((await api('get', `/calls/${started.body.id}`, b)).body.endedAt).not.toBeNull();
    });

    it('новый звонок завершает свой брошенный (закрыли вкладку посреди разговора)', async () => {
      const { chatId, a, b } = await setup();
      const first = await api('post', `/chats/${chatId}/calls`, a).send({ type: 'VIDEO' });
      expect((await api('post', `/calls/${first.body.id}/accept`, b)).status).toBe(200);

      // alice обновила страницу и звонит снова: старый ONGOING-звонок не мешает.
      const second = await api('post', `/chats/${chatId}/calls`, a).send({ type: 'AUDIO' });
      expect(second.status).toBe(201);
      expect((await api('get', `/calls/${first.body.id}`, a)).body.status).toBe('ENDED');
      await api('post', `/calls/${second.body.id}/end`, a);
    });

    it('отклонить: DECLINED; чужой звонок и неизвестный id: 404', async () => {
      const { chatId, a, b, c } = await setup();
      const started = await api('post', `/chats/${chatId}/calls`, a).send({ type: 'AUDIO' });
      expect((await api('post', `/calls/${started.body.id}/decline`, c)).status).toBe(404);
      expect((await api('get', `/calls/${started.body.id}`, c)).status).toBe(404);
      expect((await api('get', `/calls/${UNKNOWN_ID}`, a)).status).toBe(404);
      expect((await api('post', `/calls/${started.body.id}/decline`, b)).status).toBe(204);
      expect((await api('get', `/calls/${started.body.id}`, a)).body.status).toBe('DECLINED');
    });

    it('не участник чата, блокировка, неверный type: 404 / 404 / 400', async () => {
      const { alice, bob, chatId, a, c } = await setup();
      expect((await api('post', `/chats/${chatId}/calls`, c).send({ type: 'AUDIO' })).status).toBe(
        404,
      );
      expect((await api('post', `/chats/${chatId}/calls`, a).send({ type: 'FAX' })).status).toBe(
        400,
      );

      await prisma.block.create({ data: { blockerId: bob.id, blockedId: alice.id } });
      expect((await api('post', `/chats/${chatId}/calls`, a).send({ type: 'AUDIO' })).status).toBe(
        404,
      );
    });
  });

  describe('call:signal', () => {
    it('участники обмениваются сигналами; посторонний и неверные данные отклоняются', async () => {
      const { alice, bob, carol, chatId, a, b, c } = await setup();
      const started = await api('post', `/chats/${chatId}/calls`, a).send({ type: 'VIDEO' });
      const callId = started.body.id as string;
      const [sa, sb, sc] = await Promise.all([connect(a), connect(b), connect(c)]);

      const received = once<Record<string, unknown>>(sb, 'call:signal');
      const ack = await emitAck(sa, 'call:signal', {
        callId,
        toUserId: bob.id,
        kind: 'offer',
        payload: { sdp: 'v=0' },
      });
      expect(ack).toEqual({ ok: true });
      expect(await received).toEqual({
        callId,
        fromUserId: alice.id,
        kind: 'offer',
        payload: { sdp: 'v=0' },
      });

      // Не участник звонка не может слать и не получает.
      const outsider = await emitAck(sc, 'call:signal', {
        callId,
        toUserId: bob.id,
        kind: 'ice',
        payload: {},
      });
      expect(outsider.ok).toBe(false);
      const toOutsider = await emitAck(sa, 'call:signal', {
        callId,
        toUserId: carol.id,
        kind: 'ice',
        payload: {},
      });
      expect(toOutsider.ok).toBe(false);

      // Неверный kind и слишком большой payload.
      expect(
        (await emitAck(sa, 'call:signal', { callId, toUserId: bob.id, kind: 'x', payload: {} }))
          .code,
      ).toBe('BAD_REQUEST');
      const big = await emitAck(sa, 'call:signal', {
        callId,
        toUserId: bob.id,
        kind: 'offer',
        payload: { sdp: 'a'.repeat(70 * 1024) },
      });
      expect(big).toEqual({ ok: false, code: 'BAD_REQUEST' });

      // После завершения сигналы не принимаются.
      await api('post', `/calls/${callId}/end`, a);
      const late = await emitAck(sa, 'call:signal', {
        callId,
        toUserId: bob.id,
        kind: 'ice',
        payload: {},
      });
      expect(late.ok).toBe(false);
      await new Promise((r) => setTimeout(r, SILENCE_MS));
    });
  });
});
