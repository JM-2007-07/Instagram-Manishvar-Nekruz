import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { SessionService } from '@/common/session/session.service';
import { ChatsService } from '@/chats/chats.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { createTestApp, createUser, loginAs, ORIGIN, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

interface ChatBody {
  id: string;
  type: string;
  isRequest: boolean;
  unreadCount: number;
  isMuted: boolean;
  participants: { id: string; role: string }[];
  lastMessage: { id: string; text: string | null } | null;
}
interface MessageBody {
  id: string;
  text: string | null;
  editedAt: string | null;
  replyTo: { id: string } | null;
  reactions: { emoji: string }[];
}

describe('Chats: Direct', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let realtime: RealtimeService;
  let emit: jest.SpyInstance;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let a: string; // cookie alice
  let b: string;
  let c: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    realtime = app.get(RealtimeService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    emit = jest.spyOn(realtime, 'emitToUsers');
    alice = await createUser(app, { userName: 'alice' });
    bob = await createUser(app, { userName: 'bob' });
    carol = await createUser(app, { userName: 'carol' });
    [a, b, c] = [await loginAs(app, alice), await loginAs(app, bob), await loginAs(app, carol)];
  });

  afterEach(() => emit.mockRestore());
  afterAll(() => app.close());

  const api = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    cookie: string | null,
  ) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`);
    if (method !== 'get') req.set(withOrigin());
    return cookie ? req.set('Cookie', cookie) : req;
  };

  async function directChat(cookie: string, otherId: string): Promise<ChatBody> {
    const res = await api('post', '/chats', cookie)
      .send({ userIds: [otherId] })
      .expect((r) => expect([200, 201]).toContain(r.status));
    return res.body as ChatBody;
  }

  async function say(
    cookie: string,
    chatId: string,
    text: string,
    extra: object = {},
  ): Promise<MessageBody> {
    const res = await api('post', `/chats/${chatId}/messages`, cookie)
      .send({ type: 'TEXT', text, clientId: `c-${Math.random()}`, ...extra })
      .expect(201);
    return res.body as MessageBody;
  }

  const events = (name: string) => emit.mock.calls.filter((call) => call[1] === name);

  describe('личный чат', () => {
    it('без сессии 401; создание: 201, повтор и встречный запрос возвращают тот же чат (200)', async () => {
      await api('get', '/chats', null).expect(401);
      const first = await api('post', '/chats', a)
        .send({ userIds: [bob.id] })
        .expect(201);
      const again = await api('post', '/chats', a)
        .send({ userIds: [bob.id] })
        .expect(200);
      const reverse = await api('post', '/chats', b)
        .send({ userIds: [alice.id] })
        .expect(200);
      expect((again.body as ChatBody).id).toBe((first.body as ChatBody).id);
      expect((reverse.body as ChatBody).id).toBe((first.body as ChatBody).id);
      expect(await prisma.chat.count()).toBe(1);
    });

    it('нельзя писать себе (400) и несуществующему (404)', async () => {
      await api('post', '/chats', a)
        .send({ userIds: [alice.id] })
        .expect(400);
      await api('post', '/chats', a)
        .send({ userIds: ['00000000-0000-4000-8000-000000000000'] })
        .expect(404);
    });

    it('не участник получает 404 на чат, сообщения, отправку и «прочитано»', async () => {
      const chat = await directChat(a, bob.id);
      const msg = await say(a, chat.id, 'secret');
      await api('get', `/chats/${chat.id}`, c).expect(404);
      await api('get', `/chats/${chat.id}/messages`, c).expect(404);
      await api('post', `/chats/${chat.id}/messages`, c)
        .send({ type: 'TEXT', text: 'hi', clientId: 'x' })
        .expect(404);
      await api('post', `/chats/${chat.id}/read`, c).send({ messageId: msg.id }).expect(404);
      await api('delete', `/chats/${chat.id}/messages/${msg.id}`, c).expect(404);
    });
  });

  describe('сообщения', () => {
    it('отправка, список (новые сначала, курсор), событие message:new обоим', async () => {
      const chat = await directChat(a, bob.id);
      const m1 = await say(a, chat.id, 'one');
      await say(b, chat.id, 'two');
      const m3 = await say(a, chat.id, 'three');

      const sent = events('message:new');
      expect(sent).toHaveLength(3);
      expect([...(sent[0][0] as string[])].sort()).toEqual([alice.id, bob.id].sort());

      const page1 = await api('get', `/chats/${chat.id}/messages?limit=2`, b).expect(200);
      const body1 = page1.body as { items: MessageBody[]; nextCursor: string | null };
      expect(body1.items.map((m) => m.text)).toEqual(['three', 'two']);
      expect(body1.items[0].id).toBe(m3.id);
      expect(body1.nextCursor).not.toBeNull();
      const page2 = await api(
        'get',
        `/chats/${chat.id}/messages?limit=2&cursor=${body1.nextCursor}`,
        b,
      ).expect(200);
      const body2 = page2.body as { items: MessageBody[]; nextCursor: string | null };
      expect(body2.items.map((m) => m.id)).toEqual([m1.id]);
      expect(body2.nextCursor).toBeNull();
    });

    it('повтор с тем же clientId не создаёт дубликат; пустой текст и текст > 1000 — 400', async () => {
      const chat = await directChat(a, bob.id);
      const body = { type: 'TEXT', text: 'hi', clientId: 'same' };
      const r1 = await api('post', `/chats/${chat.id}/messages`, a).send(body).expect(201);
      const r2 = await api('post', `/chats/${chat.id}/messages`, a).send(body).expect(201);
      expect((r2.body as MessageBody).id).toBe((r1.body as MessageBody).id);
      expect(await prisma.message.count()).toBe(1);
      await api('post', `/chats/${chat.id}/messages`, a)
        .send({ type: 'TEXT', text: '   ', clientId: 'e' })
        .expect(400);
      await api('post', `/chats/${chat.id}/messages`, a)
        .send({ type: 'TEXT', text: 'x'.repeat(1001), clientId: 'l' })
        .expect(400);
    });

    it('ответ на сообщение другого чата — 404; медиа пока 400 NOT_IMPLEMENTED', async () => {
      const chat = await directChat(a, bob.id);
      const other = await directChat(a, carol.id);
      const foreign = await say(a, other.id, 'x');
      await api('post', `/chats/${chat.id}/messages`, a)
        .send({ type: 'TEXT', text: 'r', clientId: 'r1', replyToId: foreign.id })
        .expect(404);
      const mine = await say(a, chat.id, 'q');
      const reply = await say(b, chat.id, 'a', { replyToId: mine.id });
      expect(reply.replyTo?.id).toBe(mine.id);
      const media = await api('post', `/chats/${chat.id}/messages`, a)
        .send({ type: 'MEDIA', clientId: 'm1' })
        .expect(400);
      expect((media.body as { code: string }).code).toBe('NOT_IMPLEMENTED');
    });

    it('правка: только автор (403), в течение 15 минут (409), событие message:updated', async () => {
      const chat = await directChat(a, bob.id);
      const msg = await say(a, chat.id, 'old');
      await api('patch', `/chats/${chat.id}/messages/${msg.id}`, b)
        .send({ text: 'hack' })
        .expect(403);
      const ok = await api('patch', `/chats/${chat.id}/messages/${msg.id}`, a)
        .send({ text: 'new' })
        .expect(200);
      expect((ok.body as MessageBody).text).toBe('new');
      expect((ok.body as MessageBody).editedAt).not.toBeNull();
      expect(events('message:updated')).toHaveLength(1);

      await prisma.message.update({
        where: { id: msg.id },
        data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
      });
      const late = await api('patch', `/chats/${chat.id}/messages/${msg.id}`, a)
        .send({ text: 'late' })
        .expect(409);
      expect((late.body as { code: string }).code).toBe('EDIT_WINDOW_EXPIRED');
    });

    it('отмена отправки: только автор, пропадает из списка, событие message:unsent', async () => {
      const chat = await directChat(a, bob.id);
      const msg = await say(a, chat.id, 'oops');
      await api('delete', `/chats/${chat.id}/messages/${msg.id}`, b).expect(403);
      await api('delete', `/chats/${chat.id}/messages/${msg.id}`, a).expect(204);
      const list = await api('get', `/chats/${chat.id}/messages`, b).expect(200);
      expect((list.body as { items: unknown[] }).items).toHaveLength(0);
      expect(events('message:unsent')).toHaveLength(1);
      expect(events('message:unsent')[0][2]).toEqual({ chatId: chat.id, messageId: msg.id });
    });

    it('реакции: поставить, заменить (одна на пользователя), снять; не эмодзи — 400', async () => {
      const chat = await directChat(a, bob.id);
      const msg = await say(a, chat.id, 'hi');
      const path = `/chats/${chat.id}/messages/${msg.id}/reaction`;
      await api('put', path, b).send({ emoji: 'abc' }).expect(400);
      await api('put', path, b).send({ emoji: '❤️' }).expect(204);
      await api('put', path, b).send({ emoji: '🔥' }).expect(204);
      let list = await api('get', `/chats/${chat.id}/messages`, a).expect(200);
      let first = (list.body as { items: MessageBody[] }).items[0];
      expect(first.reactions.map((r) => r.emoji)).toEqual(['🔥']);
      expect(events('message:reaction')).toHaveLength(2);
      await api('delete', path, b).expect(204);
      list = await api('get', `/chats/${chat.id}/messages`, a).expect(200);
      first = (list.body as { items: MessageBody[] }).items[0];
      expect(first.reactions).toHaveLength(0);
      await api('put', path, c).send({ emoji: '❤️' }).expect(404);
    });
  });

  describe('прочитано, непрочитанные, mute, удаление у себя', () => {
    it('непрочитанные считаются, «прочитано» обнуляет и шлёт chat:read; countUnreadChats', async () => {
      const chat = await directChat(a, bob.id);
      await api('post', `/chats/${chat.id}/accept`, b).expect(204);
      await say(a, chat.id, 'one');
      const last = await say(a, chat.id, 'two');
      const chats = app.get(ChatsService);
      expect(await chats.countUnreadChats(bob.id)).toBe(1);
      expect(await chats.countUnreadChats(alice.id)).toBe(0);

      let got = await api('get', `/chats/${chat.id}`, b).expect(200);
      expect((got.body as ChatBody).unreadCount).toBe(2);

      await api('post', `/chats/${chat.id}/read`, b).send({ messageId: last.id }).expect(204);
      got = await api('get', `/chats/${chat.id}`, b).expect(200);
      expect((got.body as ChatBody).unreadCount).toBe(0);
      expect(await chats.countUnreadChats(bob.id)).toBe(0);
      const read = events('chat:read');
      expect(read).toHaveLength(1);
      expect(read[0][2]).toEqual({ chatId: chat.id, userId: bob.id, messageId: last.id });
      await api('post', `/chats/${chat.id}/read`, b)
        .send({ messageId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
    });

    it('mute и unmute', async () => {
      const chat = await directChat(a, bob.id);
      await api('put', `/chats/${chat.id}/mute`, a).send({}).expect(204);
      let got = await api('get', `/chats/${chat.id}`, a).expect(200);
      expect((got.body as ChatBody).isMuted).toBe(true);
      await api('delete', `/chats/${chat.id}/mute`, a).expect(204);
      got = await api('get', `/chats/${chat.id}`, a).expect(200);
      expect((got.body as ChatBody).isMuted).toBe(false);
    });

    it('удаление чата скрывает его только у меня; новое сообщение возвращает чат без старых', async () => {
      const chat = await directChat(a, bob.id);
      await say(a, chat.id, 'old');
      await api('delete', `/chats/${chat.id}`, a).expect(204);
      const mine = await api('get', '/chats', a).expect(200);
      expect((mine.body as { items: unknown[] }).items).toHaveLength(0);
      const his = await api('get', '/chats?folder=REQUESTS', b).expect(200);
      expect((his.body as { items: unknown[] }).items).toHaveLength(1);

      await say(b, chat.id, 'new');
      const back = await api('get', '/chats', a).expect(200);
      expect((back.body as { items: unknown[] }).items).toHaveLength(1);
      const msgs = await api('get', `/chats/${chat.id}/messages`, a).expect(200);
      expect((msgs.body as { items: MessageBody[] }).items.map((m) => m.text)).toEqual(['new']);
    });
  });

  describe('запросы на переписку', () => {
    it('от неподписанного — в «Запросах»; принять — в «Основном»; ответ тоже принимает', async () => {
      const chat = await directChat(a, bob.id);
      await say(a, chat.id, 'hello');
      let primary = await api('get', '/chats', b).expect(200);
      let requests = await api('get', '/chats?folder=REQUESTS', b).expect(200);
      expect((primary.body as { items: unknown[] }).items).toHaveLength(0);
      const reqItems = (requests.body as { items: ChatBody[] }).items;
      expect(reqItems).toHaveLength(1);
      expect(reqItems[0].isRequest).toBe(true);

      await api('post', `/chats/${chat.id}/accept`, b).expect(204);
      primary = await api('get', '/chats', b).expect(200);
      requests = await api('get', '/chats?folder=REQUESTS', b).expect(200);
      expect((primary.body as { items: ChatBody[] }).items[0].isRequest).toBe(false);
      expect((requests.body as { items: unknown[] }).items).toHaveLength(0);

      const other = await directChat(a, carol.id);
      await say(a, other.id, 'hey');
      await say(c, other.id, 'reply');
      const cPrimary = await api('get', '/chats', c).expect(200);
      expect((cPrimary.body as { items: unknown[] }).items).toHaveLength(1);
    });

    it('если получатель подписан на автора — сразу «Основное»', async () => {
      await prisma.follow.create({
        data: { followerId: bob.id, followingId: alice.id, status: 'ACCEPTED' },
      });
      const chat = await directChat(a, bob.id);
      await say(a, chat.id, 'hi');
      const primary = await api('get', '/chats', b).expect(200);
      expect((primary.body as { items: unknown[] }).items).toHaveLength(1);
    });

    it('пока запрос не принят, отправитель не видит «прочитано»', async () => {
      const chat = await directChat(a, bob.id);
      const msg = await say(a, chat.id, 'hello');
      await api('post', `/chats/${chat.id}/read`, b).send({ messageId: msg.id }).expect(204);
      const read = events('chat:read');
      expect(read).toHaveLength(1);
      expect(read[0][0]).toEqual([bob.id]);
    });
  });

  describe('блокировка', () => {
    it('нельзя создать чат, писать и читать чат с заблокировавшим; чат пропадает из списка', async () => {
      const chat = await directChat(a, bob.id);
      await say(a, chat.id, 'before');
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: alice.id } });

      await api('post', '/chats', a)
        .send({ userIds: [bob.id] })
        .expect(404);
      await api('post', `/chats/${chat.id}/messages`, a)
        .send({ type: 'TEXT', text: 'x', clientId: 'b1' })
        .expect(404);
      await api('post', `/chats/${chat.id}/messages`, b)
        .send({ type: 'TEXT', text: 'x', clientId: 'b2' })
        .expect(404);
      await api('get', `/chats/${chat.id}/messages`, a).expect(404);
      const list = await api('get', '/chats?folder=REQUESTS', b).expect(200);
      expect((list.body as { items: unknown[] }).items).toHaveLength(0);
    });
  });

  describe('группы', () => {
    async function group(cookie: string, ids: string[], title = 'Team'): Promise<ChatBody> {
      const res = await api('post', '/chats', cookie).send({ userIds: ids, title }).expect(201);
      return res.body as ChatBody;
    }

    it('создание: создатель — ADMIN, участники — MEMBER, системное сообщение', async () => {
      const chat = await group(a, [bob.id, carol.id]);
      expect(chat.type).toBe('GROUP');
      const roles = Object.fromEntries(chat.participants.map((p) => [p.id, p.role]));
      expect(roles).toEqual({ [alice.id]: 'ADMIN', [bob.id]: 'MEMBER', [carol.id]: 'MEMBER' });
      const msgs = await api('get', `/chats/${chat.id}/messages`, b).expect(200);
      expect((msgs.body as { items: unknown[] }).items).toHaveLength(1);
      expect(events('chat:updated').length).toBeGreaterThan(0);
    });

    it('переименование любым участником; администраторов назначает только администратор', async () => {
      const chat = await group(a, [bob.id, carol.id]);
      const renamed = await api('patch', `/chats/${chat.id}`, b).send({ title: 'New' }).expect(200);
      expect((renamed.body as { title: string }).title).toBe('New');
      await api('put', `/chats/${chat.id}/participants/${carol.id}/admin`, b).expect(403);
      await api('put', `/chats/${chat.id}/participants/${carol.id}/admin`, a).expect(204);
      await api('delete', `/chats/${chat.id}/participants/${carol.id}/admin`, a).expect(204);
    });

    it('добавить участника: повтор — 409; убрать чужого может только администратор', async () => {
      const dave = await createUser(app, { userName: 'dave' });
      const eve = await createUser(app, { userName: 'eve' });
      // Группа — от двух собеседников: с одним userId POST /chats создаёт личный чат (контракт).
      const chat = await group(a, [bob.id, eve.id]);
      const added = await api('post', `/chats/${chat.id}/participants`, b)
        .send({ userIds: [carol.id] })
        .expect(201);
      expect((added.body as ChatBody).participants).toHaveLength(4);
      await api('post', `/chats/${chat.id}/participants`, a)
        .send({ userIds: [carol.id] })
        .expect(409);
      await api('delete', `/chats/${chat.id}/participants/${carol.id}`, b).expect(403);
      await api('delete', `/chats/${chat.id}/participants/${carol.id}`, a).expect(204);
      await api('get', `/chats/${chat.id}`, c).expect(404);
      await api('post', `/chats/${chat.id}/participants`, c)
        .send({ userIds: [dave.id] })
        .expect(404);
    });

    it('выход: последний администратор передаёт роль; когда все вышли — чат удалён', async () => {
      const chat = await group(a, [bob.id, carol.id]);
      await api('delete', `/chats/${chat.id}/participants/${alice.id}`, a).expect(204);
      await api('get', `/chats/${chat.id}`, a).expect(404);
      const rest = await api('get', `/chats/${chat.id}`, b).expect(200);
      const roles = (rest.body as ChatBody).participants.map((p) => p.role);
      expect(roles.filter((r) => r === 'ADMIN')).toHaveLength(1);
      await api('delete', `/chats/${chat.id}`, b).expect(204);
      await api('delete', `/chats/${chat.id}`, c).expect(204);
      expect(await prisma.chat.count()).toBe(0);
    });
  });

  describe('ChatsService для историй и /messages/share', () => {
    it('sendSystemMessage создаёт STORY_REPLY в личном чате', async () => {
      const storyId = '11111111-1111-4111-8111-111111111111';
      const dto = await app.get(ChatsService).sendSystemMessage({
        senderId: alice.id,
        recipientId: bob.id,
        type: 'STORY_REPLY',
        storyId,
        text: 'nice',
      });
      expect(dto.type).toBe('STORY_REPLY');
      expect(dto.storyId).toBe(storyId);
      const chat = await directChat(b, alice.id);
      expect(chat.lastMessage?.id).toBe(dto.id);
    });

    it('поделиться профилем в чат и пользователю; публикация — 400 NOT_IMPLEMENTED', async () => {
      const chat = await directChat(a, bob.id);
      const res = await api('post', '/messages/share', a)
        .send({ chatIds: [chat.id], userIds: [carol.id], userId: bob.id })
        .expect(201);
      expect((res.body as { messages: unknown[] }).messages).toHaveLength(2);
      await api('post', '/messages/share', a)
        .send({ chatIds: [chat.id], postId: '11111111-1111-4111-8111-111111111111' })
        .expect(400);
    });
  });

  describe('chat:typing (Socket.IO)', () => {
    let url: string;
    const sockets: Socket[] = [];

    beforeAll(async () => {
      await app.listen(0, '127.0.0.1');
      url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    afterEach(() => {
      for (const s of sockets.splice(0)) s.close();
    });

    async function connect(user: TestUser): Promise<Socket> {
      const sessions = app.get(SessionService);
      const { token } = await sessions.create(user.id, { ipAddress: '127.0.0.1', userAgent: 'j' });
      const socket = io(url, {
        transports: ['websocket'],
        extraHeaders: { Cookie: `${sessions.cookie}=${token}`, Origin: ORIGIN },
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      return socket;
    }

    it('участник шлёт typing -> собеседник получает chat:typing; чужой чат — NOT_FOUND', async () => {
      const chat = await directChat(a, bob.id);
      emit.mockRestore(); // нужна настоящая доставка
      const sa = await connect(alice);
      const sb = await connect(bob);
      const got = new Promise<unknown>((resolve) => sb.once('chat:typing', resolve));
      const ack = (await sa.emitWithAck('chat:typing', { chatId: chat.id, isTyping: true })) as {
        ok: boolean;
      };
      expect(ack.ok).toBe(true);
      expect(await got).toEqual({ chatId: chat.id, userId: alice.id, isTyping: true });

      const sc = await connect(carol);
      const denied = (await sc.emitWithAck('chat:typing', {
        chatId: chat.id,
        isTyping: false,
      })) as { ok: boolean; code?: string };
      expect(denied).toEqual({ ok: false, code: 'NOT_FOUND' });
    });
  });
});
