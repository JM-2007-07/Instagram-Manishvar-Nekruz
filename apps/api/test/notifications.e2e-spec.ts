import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';
import { createPost } from './helpers/posts';

describe('Notifications: создание, список, прочитано, значки', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: NotificationsService;
  let emit: jest.SpyInstance;
  let me: TestUser;
  let bob: TestUser;
  let meCookie: string;
  let bobCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    service = app.get(NotificationsService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    emit = jest.spyOn(app.get(RealtimeService), 'emitToUsers');
    me = await createUser(app, { userName: 'alice' });
    bob = await createUser(app, { userName: 'bob' });
    meCookie = await loginAs(app, me);
    bobCookie = await loginAs(app, bob);
  });

  afterEach(() => {
    emit.mockRestore();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, cookie: string | null = meCookie) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const post = (path: string, cookie: string | null = meCookie) => {
    const req = request(app.getHttpServer()).post(`/api/v1${path}`).set(withOrigin());
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const events = () => emit.mock.calls.map((c) => c[1] as string);
  const count = () => prisma.notification.count();

  it.each([
    ['get', '/notifications'],
    ['post', '/notifications/read'],
    ['get', '/me/badges'],
  ] as const)('%s %s без сессии -> 401', async (method, path) => {
    const res = method === 'get' ? await get(path, null) : await post(path, null);
    expect(res.status).toBe(401);
  });

  it('подписка создаёт уведомление и события notification:new и badges:updated', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/users/${me.id}/follow`)
      .set(withOrigin())
      .set('Cookie', bobCookie)
      .expect(200);

    expect(await count()).toBe(1);
    expect(events()).toEqual(['notification:new', 'badges:updated']);
    expect(emit.mock.calls[0][0]).toEqual([me.id]);
    const payload = emit.mock.calls[1][2] as { unreadNotifications: number };
    expect(payload.unreadNotifications).toBe(1);

    const list = (await get('/notifications').expect(200)).body;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      type: 'FOLLOW',
      actorCount: 1,
      isRead: false,
      post: null,
      comment: null,
    });
    expect(list.items[0].actors[0].userName).toBe('bob');
  });

  it('отписка удаляет непрочитанное уведомление', async () => {
    const put = () =>
      request(app.getHttpServer())
        .put(`/api/v1/users/${me.id}/follow`)
        .set(withOrigin())
        .set('Cookie', bobCookie);
    await put().expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/${me.id}/follow`)
      .set(withOrigin())
      .set('Cookie', bobCookie)
      .expect(204);
    expect(await count()).toBe(0);
  });

  it('себя не уведомляет', async () => {
    await service.create({ recipientId: me.id, actorId: me.id, type: 'FOLLOW' });
    expect(await count()).toBe(0);
  });

  it('выключенный тип не создаёт уведомление', async () => {
    await prisma.notificationPreference.create({
      data: { userId: me.id, type: 'FOLLOW', enabled: false },
    });
    await service.create({ recipientId: me.id, actorId: bob.id, type: 'FOLLOW' });
    expect(await count()).toBe(0);
    await service.create({ recipientId: me.id, actorId: bob.id, type: 'POST_LIKE' });
    expect(await count()).toBe(1);
  });

  it('блокировка в любую сторону не создаёт уведомление', async () => {
    await prisma.block.create({ data: { blockerId: me.id, blockedId: bob.id } });
    await service.create({ recipientId: me.id, actorId: bob.id, type: 'FOLLOW' });
    await service.create({ recipientId: bob.id, actorId: me.id, type: 'FOLLOW' });
    expect(await count()).toBe(0);
  });

  it('лайки одного поста группируются: actors до 3 и actorCount', async () => {
    // Пост настоящий: у Notification.postId теперь внешний ключ на Post.
    const postId = (await createPost(app, me)).id;
    const others = [];
    for (let i = 0; i < 4; i++) others.push(await createUser(app, { userName: `fan${i}` }));
    for (const user of [bob, ...others]) {
      await service.create({ recipientId: me.id, actorId: user.id, type: 'POST_LIKE', postId });
    }
    const list = (await get('/notifications').expect(200)).body;
    expect(list.items).toHaveLength(1);
    expect(list.items[0].actorCount).toBe(5);
    expect(list.items[0].actors).toHaveLength(3);
    expect(list.items[0].post.id).toBe(postId);
  });

  it('курсорная пагинация', async () => {
    for (let i = 0; i < 3; i++) {
      const user = await createUser(app, { userName: `u${i}` });
      await service.create({ recipientId: me.id, actorId: user.id, type: 'FOLLOW' });
    }
    const first = (await get('/notifications?limit=2').expect(200)).body;
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = (
      await get(`/notifications?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`).expect(200)
    ).body;
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('чужие уведомления не видны', async () => {
    await service.create({ recipientId: me.id, actorId: bob.id, type: 'FOLLOW' });
    const list = (await get('/notifications', bobCookie).expect(200)).body;
    expect(list.items).toHaveLength(0);
  });

  it('POST /notifications/read отмечает прочитанными, badges обнуляются', async () => {
    await service.create({ recipientId: me.id, actorId: bob.id, type: 'FOLLOW' });
    expect((await get('/me/badges').expect(200)).body).toEqual({
      unreadNotifications: 1,
      unreadChats: 0,
      followRequests: 0,
    });
    await post('/notifications/read').send({}).expect(204);
    expect((await get('/me/badges').expect(200)).body.unreadNotifications).toBe(0);
    const list = (await get('/notifications').expect(200)).body;
    expect(list.items[0].isRead).toBe(true);
  });

  it('upToId отмечает только старые, а невалидный upToId -> 400', async () => {
    const carol = await createUser(app, { userName: 'carol' });
    await service.create({ recipientId: me.id, actorId: bob.id, type: 'FOLLOW' });
    await service.create({ recipientId: me.id, actorId: carol.id, type: 'FOLLOW' });
    const list = (await get('/notifications').expect(200)).body;
    const oldest = list.items[1].id as string;
    await post('/notifications/read').send({ upToId: oldest }).expect(204);
    expect((await get('/me/badges').expect(200)).body.unreadNotifications).toBe(1);
    await post('/notifications/read').send({ upToId: 'nope' }).expect(400);
  });

  it('badges.followRequests считает входящие запросы', async () => {
    await prisma.user.update({ where: { id: me.id }, data: { isPrivate: true } });
    await prisma.follow.create({
      data: { followerId: bob.id, followingId: me.id, status: 'PENDING' },
    });
    expect((await get('/me/badges').expect(200)).body.followRequests).toBe(1);
  });

  it('GET /notifications: превью поста (shortcode, миниатюра) и текста комментария', async () => {
    const p = await createPost(app, me);
    const c = await prisma.comment.create({
      data: { postId: p.id, authorId: me.id, text: 'hello' },
      select: { id: true },
    });
    await prisma.notification.create({
      data: { recipientId: me.id, actorId: bob.id, type: 'POST_LIKE', postId: p.id },
    });
    await prisma.notification.create({
      data: {
        recipientId: me.id,
        actorId: bob.id,
        type: 'COMMENT_LIKE',
        postId: p.id,
        commentId: c.id,
      },
    });
    const res = await get('/notifications').expect(200);
    const like = res.body.items.find((i: { type: string }) => i.type === 'POST_LIKE');
    const cl = res.body.items.find((i: { type: string }) => i.type === 'COMMENT_LIKE');
    expect(like.post.shortcode).toBe(p.shortcode);
    expect(like.post.thumbnailUrl).toMatch(/^\/api\/v1\/media\//);
    expect(cl.comment).toEqual({ id: c.id, text: 'hello' });
  });

  it('удаление поста каскадно удаляет его уведомления', async () => {
    const p = await createPost(app, me);
    await prisma.notification.create({
      data: { recipientId: me.id, actorId: bob.id, type: 'POST_LIKE', postId: p.id },
    });
    await prisma.post.delete({ where: { id: p.id } });
    expect(await count()).toBe(0);
  });
});
