import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

interface Item {
  id: string;
  userName: string;
  followStatus?: string;
  requestedAt?: string;
  reason?: string;
}

describe('Follows: подписки, запросы, списки, рекомендации', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notify: jest.SpyInstance;
  let me: TestUser;
  let cookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    notify = jest.spyOn(app.get(NotificationsService), 'create');
    me = await createUser(app, { userName: 'alice' });
    cookie = await loginAs(app, me);
  });

  afterEach(() => {
    notify.mockRestore();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const get = (path: string, c: string | null = cookie) => {
    const req = request(server()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (
    method: 'patch' | 'put' | 'post' | 'delete',
    path: string,
    c: string | null = cookie,
  ) => {
    const req = request(server())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const follow = (id: string, c: string | null = cookie) => send('put', `/users/${id}/follow`, c);
  // Прямая запись связи в обход API — для подготовки данных.
  const link = (followerId: string, followingId: string, status: 'ACCEPTED' | 'PENDING') =>
    prisma.follow.create({
      data: {
        followerId,
        followingId,
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : null,
      },
    });
  const rel = (followerId: string, followingId: string) =>
    prisma.follow.findFirst({ where: { followerId, followingId } });
  const profile = async (id: string, c: string | null = cookie) =>
    (await get(`/users/${id}`, c).expect(200)).body;
  const notificationTypes = () => notify.mock.calls.map((c) => (c[0] as { type: string }).type);

  describe('без сессии', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    it.each([
      ['put', `/users/${id}/follow`],
      ['delete', `/users/${id}/follow`],
      ['get', `/users/${id}/followers`],
      ['get', `/users/${id}/following`],
      ['delete', `/me/followers/${id}`],
      ['get', '/me/follow-requests'],
      ['post', `/me/follow-requests/${id}/accept`],
      ['delete', `/me/follow-requests/${id}`],
      ['get', '/users/suggestions'],
    ] as const)('%s %s -> 401', async (method, path) => {
      const res =
        method === 'get'
          ? await get(path, null).expect(401)
          : await send(method, path, null).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('PUT /users/{id}/follow', () => {
    it('открытый аккаунт -> ACCEPTED, уведомление FOLLOW', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const res = await follow(bob.id).expect(200);
      expect(res.body).toEqual({ status: 'ACCEPTED' });
      expect((await rel(me.id, bob.id))?.status).toBe('ACCEPTED');
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FOLLOW', actorId: me.id, recipientId: bob.id }),
      );
    });

    it('закрытый аккаунт -> PENDING, уведомление FOLLOW_REQUEST', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const res = await follow(priv.id).expect(200);
      expect(res.body).toEqual({ status: 'PENDING' });
      expect((await rel(me.id, priv.id))?.status).toBe('PENDING');
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FOLLOW_REQUEST', actorId: me.id, recipientId: priv.id }),
      );
    });

    it('повторный PUT идемпотентен: одна запись, без второго уведомления', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await follow(bob.id).expect(200);
      const again = await follow(bob.id).expect(200);
      expect(again.body).toEqual({ status: 'ACCEPTED' });
      expect(await prisma.follow.count({ where: { followerId: me.id } })).toBe(1);
      expect(notificationTypes().filter((t) => t === 'FOLLOW')).toHaveLength(1);
    });

    it('повторный PUT на закрытый остаётся PENDING', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      await follow(priv.id).expect(200);
      const again = await follow(priv.id).expect(200);
      expect(again.body).toEqual({ status: 'PENDING' });
      expect(notificationTypes().filter((t) => t === 'FOLLOW_REQUEST')).toHaveLength(1);
    });

    it('на себя -> 400', async () => {
      await follow(me.id).expect(400);
      expect(await prisma.follow.count()).toBe(0);
    });

    it('неизвестный id -> 404', async () => {
      const res = await follow('00000000-0000-4000-8000-000000000000').expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('не-UUID -> 400 VALIDATION_ERROR', async () => {
      const res = await follow('not-a-uuid').expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('без Origin -> 403 CSRF_REJECTED', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const res = await request(server())
        .put(`/api/v1/users/${bob.id}/follow`)
        .set('Cookie', cookie)
        .expect(403);
      expect(res.body.code).toBe('CSRF_REJECTED');
    });

    it('61-я подписка за час -> 429 RATE_LIMITED', async () => {
      const targets = await Promise.all(Array.from({ length: 61 }, () => createUser(app)));
      for (const t of targets.slice(0, 60)) await follow(t.id).expect(200);
      const res = await follow(targets[60].id).expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
    });
  });

  describe('DELETE /users/{id}/follow', () => {
    it('отписка: связь удалена, счётчик уменьшился', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await follow(bob.id).expect(200);
      expect((await profile(bob.id)).followerCount).toBe(1);
      await send('delete', `/users/${bob.id}/follow`).expect(204);
      expect(await rel(me.id, bob.id)).toBeNull();
      expect((await profile(bob.id)).followerCount).toBe(0);
    });

    it('отменяет запрос (PENDING)', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      await follow(priv.id).expect(200);
      await send('delete', `/users/${priv.id}/follow`).expect(204);
      expect(await rel(me.id, priv.id)).toBeNull();
      expect((await profile(priv.id)).followStatus).toBe('NONE');
    });

    it('идемпотентен: без подписки тоже 204', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await send('delete', `/users/${bob.id}/follow`).expect(204);
      await send('delete', `/users/${bob.id}/follow`).expect(204);
    });

    it('неизвестный id -> 404; не-UUID -> 400', async () => {
      await send('delete', '/users/00000000-0000-4000-8000-000000000000/follow').expect(404);
      await send('delete', '/users/not-a-uuid/follow').expect(400);
    });
  });

  describe('профиль: followStatus и счётчики', () => {
    it('NONE -> FOLLOWING / REQUESTED, followerCount и followingCount считают только ACCEPTED', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      expect(await profile(bob.id)).toMatchObject({ followStatus: 'NONE', followerCount: 0 });

      await follow(bob.id).expect(200);
      await follow(priv.id).expect(200);

      expect(await profile(bob.id)).toMatchObject({ followStatus: 'FOLLOWING', followerCount: 1 });
      // PENDING не входит в счётчик подписчиков
      expect(await profile(priv.id)).toMatchObject({ followStatus: 'REQUESTED', followerCount: 0 });
      expect(await profile(me.id)).toMatchObject({ followingCount: 1 });
      expect((await get('/me').expect(200)).body.followingCount).toBe(1);
    });

    it('followsMe=true, если он подписан на меня', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await link(bob.id, me.id, 'ACCEPTED');
      expect((await profile(bob.id)).followsMe).toBe(true);
      expect((await get('/me').expect(200)).body.followerCount).toBe(1);
    });
  });

  describe('счётчики и неактивные', () => {
    it('followerCount и followingCount не учитывают BANNED', async () => {
      const bannedFan = await createUser(app, { userName: 'bannedfan' });
      const bannedIdol = await createUser(app, { userName: 'bannedidol' });
      const fan = await createUser(app, { userName: 'fan' });
      await link(bannedFan.id, me.id, 'ACCEPTED');
      await link(fan.id, me.id, 'ACCEPTED');
      await link(me.id, bannedIdol.id, 'ACCEPTED');
      await prisma.user.updateMany({
        where: { id: { in: [bannedFan.id, bannedIdol.id] } },
        data: { status: 'BANNED' },
      });

      const body = (await get('/me').expect(200)).body;
      expect(body.followerCount).toBe(1);
      expect(body.followingCount).toBe(0);
      const viewer = await createUser(app, { userName: 'viewer' });
      const other = await profile(me.id, await loginAs(app, viewer));
      expect(other.followerCount).toBe(1);
    });
  });

  describe('canViewContent', () => {
    it('закрытый: false для неподписанного и для PENDING, true для ACCEPTED', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      expect((await profile(priv.id)).canViewContent).toBe(false);

      await follow(priv.id).expect(200);
      expect((await profile(priv.id)).canViewContent).toBe(false);

      await send('post', `/me/follow-requests/${me.id}/accept`, await loginAs(app, priv)).expect(
        204,
      );
      expect((await profile(priv.id)).canViewContent).toBe(true);
    });

    it('открытый: true для неподписанного', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      expect((await profile(bob.id)).canViewContent).toBe(true);
    });
  });

  describe('GET /users/{id}/followers и /following', () => {
    it('курсор: страницы без дублей, nextCursor=null в конце', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const fans = await Promise.all(Array.from({ length: 5 }, () => createUser(app)));
      for (const f of fans) await link(f.id, bob.id, 'ACCEPTED');

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res: request.Response = await get(
          `/users/${bob.id}/followers?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        ).expect(200);
        expect(res.body.items.length).toBeLessThanOrEqual(2);
        seen.push(...res.body.items.map((i: Item) => i.id));
        cursor = res.body.nextCursor;
        pages++;
      } while (cursor && pages < 10);

      expect(pages).toBe(3);
      expect(cursor).toBeNull();
      expect(new Set(seen).size).toBe(5);
      expect([...seen].sort()).toEqual(fans.map((f) => f.id).sort());
    });

    it('форма элемента: UserSummary + followStatus относительно меня', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const carol = await createUser(app, { userName: 'carol' });
      const dave = await createUser(app, { userName: 'dave' });
      await link(carol.id, bob.id, 'ACCEPTED');
      await link(dave.id, bob.id, 'ACCEPTED');
      await link(me.id, carol.id, 'ACCEPTED');

      const res = await get(`/users/${bob.id}/followers`).expect(200);
      const byName = Object.fromEntries(res.body.items.map((i: Item) => [i.userName, i]));
      expect(byName.carol).toMatchObject({ id: carol.id, followStatus: 'FOLLOWING' });
      expect(byName.dave).toMatchObject({ id: dave.id, followStatus: 'NONE' });
      expect(byName.carol).toHaveProperty('avatarUrl');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('PENDING-запросы не попадают в список подписчиков', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const pending = await createUser(app, { userName: 'pending' });
      await link(pending.id, priv.id, 'PENDING');
      await link(me.id, priv.id, 'ACCEPTED');
      const res = await get(`/users/${priv.id}/followers`).expect(200);
      expect(res.body.items.map((i: Item) => i.userName)).toEqual(['alice']);
    });

    it('фильтр q по имени', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const anna = await createUser(app, { userName: 'anna.smith' });
      const john = await createUser(app, { userName: 'john' });
      await link(anna.id, bob.id, 'ACCEPTED');
      await link(john.id, bob.id, 'ACCEPTED');
      const res = await get(`/users/${bob.id}/followers?q=ann`).expect(200);
      expect(res.body.items.map((i: Item) => i.userName)).toEqual(['anna.smith']);
    });

    it('/following: список тех, на кого подписан пользователь', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const carol = await createUser(app, { userName: 'carol' });
      await link(bob.id, carol.id, 'ACCEPTED');
      const res = await get(`/users/${bob.id}/following`).expect(200);
      expect(res.body.items.map((i: Item) => i.id)).toEqual([carol.id]);
      expect(res.body.nextCursor).toBeNull();
    });

    it('пустой список: items=[] и nextCursor=null', async () => {
      const res = await get(`/users/${me.id}/followers`).expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('закрытый аккаунт: неподписанному 403 PRIVATE_ACCOUNT, подписчику и владельцу 200', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      for (const path of ['followers', 'following']) {
        const res = await get(`/users/${priv.id}/${path}`).expect(403);
        expect(res.body.code).toBe('PRIVATE_ACCOUNT');
      }
      await link(me.id, priv.id, 'PENDING');
      await get(`/users/${priv.id}/followers`).expect(403);

      await prisma.follow.updateMany({
        where: { followerId: me.id, followingId: priv.id },
        data: { status: 'ACCEPTED' },
      });
      await get(`/users/${priv.id}/followers`).expect(200);
      await get(`/users/${priv.id}/following`).expect(200);
      await get(`/users/${priv.id}/followers`, await loginAs(app, priv)).expect(200);
    });

    it('неизвестный id -> 404; не-UUID и limit вне 1..50 -> 400', async () => {
      await get('/users/00000000-0000-4000-8000-000000000000/followers').expect(404);
      await get('/users/not-a-uuid/followers').expect(400);
      const res = await get(`/users/${me.id}/followers?limit=51`).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      await get(`/users/${me.id}/followers?limit=0`).expect(400);
    });
  });

  describe('DELETE /me/followers/{id}', () => {
    it('удаляет подписчика: счётчик и доступ к закрытому контенту', async () => {
      await send('patch', '/me').send({ isPrivate: true }).expect(200);
      const bob = await createUser(app, { userName: 'bob' });
      await link(bob.id, me.id, 'ACCEPTED');
      const bobCookie = await loginAs(app, bob);
      expect((await profile(me.id, bobCookie)).canViewContent).toBe(true);

      await send('delete', `/me/followers/${bob.id}`).expect(204);
      expect(await rel(bob.id, me.id)).toBeNull();
      expect((await get('/me').expect(200)).body.followerCount).toBe(0);
      expect((await profile(me.id, bobCookie)).canViewContent).toBe(false);
    });

    it('идемпотентность не требуется: не подписчик -> 404', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await send('delete', `/me/followers/${bob.id}`).expect(404);
    });

    it('не трогает мою подписку на него (обратное направление)', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await link(me.id, bob.id, 'ACCEPTED');
      await send('delete', `/me/followers/${bob.id}`).expect(404);
      expect(await rel(me.id, bob.id)).not.toBeNull();
    });
  });

  describe('запросы на подписку', () => {
    let priv: TestUser;
    let privCookie: string;
    let bob: TestUser;

    beforeEach(async () => {
      priv = await createUser(app, { userName: 'secret', isPrivate: true });
      privCookie = await loginAs(app, priv);
      bob = await createUser(app, { userName: 'bob' });
      await follow(priv.id).expect(200);
      await follow(priv.id, await loginAs(app, bob)).expect(200);
      notify.mockClear();
    });

    it('GET /me/follow-requests: список входящих с requestedAt', async () => {
      const res = await get('/me/follow-requests', privCookie).expect(200);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.items.map((i: Item) => i.userName).sort()).toEqual(['alice', 'bob']);
      expect(typeof res.body.items[0].requestedAt).toBe('string');
    });

    it('чужие исходящие запросы не видны: у отправителя список пуст', async () => {
      const res = await get('/me/follow-requests').expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('принять: ACCEPTED, счётчики, уведомление FOLLOW_ACCEPTED подписчику', async () => {
      await send('post', `/me/follow-requests/${me.id}/accept`, privCookie).expect(204);
      expect((await rel(me.id, priv.id))?.status).toBe('ACCEPTED');
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FOLLOW_ACCEPTED', actorId: priv.id, recipientId: me.id }),
      );
      expect(await profile(priv.id)).toMatchObject({ followerCount: 1, followStatus: 'FOLLOWING' });
      const list = await get('/me/follow-requests', privCookie).expect(200);
      expect(list.body.items.map((i: Item) => i.userName)).toEqual(['bob']);
    });

    it('отклонить: запись удалена, уведомления нет, статус NONE', async () => {
      await send('delete', `/me/follow-requests/${me.id}`, privCookie).expect(204);
      expect(await rel(me.id, priv.id)).toBeNull();
      expect(notify).not.toHaveBeenCalled();
      expect((await profile(priv.id)).followStatus).toBe('NONE');
    });

    it('принять или отклонить несуществующий запрос -> 404', async () => {
      const carol = await createUser(app, { userName: 'carol' });
      await send('post', `/me/follow-requests/${carol.id}/accept`, privCookie).expect(404);
      await send('delete', `/me/follow-requests/${carol.id}`, privCookie).expect(404);
    });

    it('чужой запрос принять нельзя: 404, статус не меняется', async () => {
      // bob пытается принять запрос alice к priv
      const bobCookie = await loginAs(app, bob);
      await send('post', `/me/follow-requests/${me.id}/accept`, bobCookie).expect(404);
      await send('delete', `/me/follow-requests/${me.id}`, bobCookie).expect(404);
      expect((await rel(me.id, priv.id))?.status).toBe('PENDING');
    });

    it('уже принятый запрос повторно принять -> 404', async () => {
      await send('post', `/me/follow-requests/${me.id}/accept`, privCookie).expect(204);
      await send('post', `/me/follow-requests/${me.id}/accept`, privCookie).expect(404);
    });

    it('не-UUID -> 400', async () => {
      await send('post', '/me/follow-requests/not-a-uuid/accept', privCookie).expect(400);
    });

    it('PATCH /me { isPrivate: false } принимает все запросы', async () => {
      await send('patch', '/me', privCookie).send({ isPrivate: false }).expect(200);
      expect(
        await prisma.follow.count({ where: { followingId: priv.id, status: 'PENDING' } }),
      ).toBe(0);
      expect(
        await prisma.follow.count({ where: { followingId: priv.id, status: 'ACCEPTED' } }),
      ).toBe(2);
      expect((await get('/me', privCookie).expect(200)).body.followerCount).toBe(2);
      expect((await get('/me/follow-requests', privCookie).expect(200)).body.items).toEqual([]);
      expect(notificationTypes().filter((t) => t === 'FOLLOW_ACCEPTED')).toHaveLength(2);
    });

    it('курсор списка запросов: страницы без дублей', async () => {
      const extra = await Promise.all(Array.from({ length: 3 }, () => createUser(app)));
      for (const u of extra) await link(u.id, priv.id, 'PENDING');
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res: request.Response = await get(
          `/me/follow-requests?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          privCookie,
        ).expect(200);
        seen.push(...res.body.items.map((i: Item) => i.id));
        cursor = res.body.nextCursor;
        pages++;
      } while (cursor && pages < 10);
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });
  });

  describe('GET /users/suggestions', () => {
    it('без себя и без тех, на кого уже подписан', async () => {
      const followed = await createUser(app, { userName: 'followed' });
      const other1 = await createUser(app, { userName: 'other1' });
      const other2 = await createUser(app, { userName: 'other2' });
      await link(me.id, followed.id, 'ACCEPTED');

      const res = await get('/users/suggestions').expect(200);
      const ids = (res.body as Item[]).map((i) => i.id);
      expect(ids).not.toContain(me.id);
      expect(ids).not.toContain(followed.id);
      expect(ids).toEqual(expect.arrayContaining([other1.id, other2.id]));
      for (const item of res.body as Item[]) {
        expect(['FOLLOWED_BY', 'POPULAR']).toContain(item.reason);
      }
    });

    it('уважает limit', async () => {
      await Promise.all(Array.from({ length: 4 }, () => createUser(app)));
      const res = await get('/users/suggestions?limit=2').expect(200);
      expect(res.body).toHaveLength(2);
    });

    it('не предлагает пользователей, на которых отправлен запрос', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      await follow(priv.id).expect(200);
      const ids = ((await get('/users/suggestions').expect(200)).body as Item[]).map((i) => i.id);
      expect(ids).not.toContain(priv.id);
    });

    it('FOLLOWED_BY: reason и followedBy — тот, на кого я подписан и кто подписан на кандидата', async () => {
      const friend = await createUser(app, { userName: 'friend' });
      const target = await createUser(app, { userName: 'target' });
      await link(me.id, friend.id, 'ACCEPTED');
      await link(friend.id, target.id, 'ACCEPTED');

      const res = await get('/users/suggestions').expect(200);
      const item = (
        res.body as Array<Item & { followedBy?: { id: string; userName: string } }>
      ).find((i) => i.id === target.id);
      expect(item).toMatchObject({
        reason: 'FOLLOWED_BY',
        followedBy: { id: friend.id, userName: 'friend' },
      });
    });

    it('забаненный, на которого я подписан, не попадает в followedBy', async () => {
      const banned = await createUser(app, { userName: 'banned' });
      const target = await createUser(app, { userName: 'target' });
      await link(me.id, banned.id, 'ACCEPTED');
      await link(banned.id, target.id, 'ACCEPTED');
      await prisma.user.update({ where: { id: banned.id }, data: { status: 'BANNED' } });

      const res = await get('/users/suggestions').expect(200);
      const body = res.body as Array<Item & { followedBy?: { id: string } }>;
      expect(body.some((i) => i.followedBy?.id === banned.id)).toBe(false);
      expect(body.find((i) => i.id === target.id)?.reason).not.toBe('FOLLOWED_BY');
    });
  });
});
