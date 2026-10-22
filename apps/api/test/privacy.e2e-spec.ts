import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

interface Item {
  id: string;
  userName: string;
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Privacy: блокировки и закрытые аккаунты', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: TestUser;
  let bob: TestUser;
  let aliceCookie: string;
  let bobCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    alice = await createUser(app, { userName: 'alice' });
    bob = await createUser(app, { userName: 'bob' });
    aliceCookie = await loginAs(app, alice);
    bobCookie = await loginAs(app, bob);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, c: string | null = aliceCookie) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (method: 'put' | 'delete', path: string, c: string | null = aliceCookie) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const block = (id: string, c: string | null = aliceCookie) =>
    send('put', `/users/${id}/block`, c);
  const link = (followerId: string, followingId: string, status: 'ACCEPTED' | 'PENDING') =>
    prisma.follow.create({
      data: {
        followerId,
        followingId,
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : null,
      },
    });
  const followCount = () => prisma.follow.count();
  const ids = (body: { items: Item[] }) => body.items.map((i) => i.id);

  describe('без сессии', () => {
    it.each([
      ['put', `/users/${UNKNOWN_ID}/block`],
      ['delete', `/users/${UNKNOWN_ID}/block`],
      ['get', '/me/blocked'],
    ] as const)('%s %s -> 401', async (method, path) => {
      const res =
        method === 'get'
          ? await get(path, null).expect(401)
          : await send(method, path, null).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('PUT /users/{id}/block', () => {
    it('блокирует: 204, запись создана', async () => {
      await block(bob.id).expect(204);
      expect(await prisma.block.count({ where: { blockerId: alice.id, blockedId: bob.id } })).toBe(
        1,
      );
    });

    it('идемпотентен: повторный PUT -> 204, одна запись', async () => {
      await block(bob.id).expect(204);
      await block(bob.id).expect(204);
      expect(await prisma.block.count()).toBe(1);
    });

    it('себя -> 400', async () => {
      await block(alice.id).expect(400);
      expect(await prisma.block.count()).toBe(0);
    });

    it('неизвестный id -> 404', async () => {
      const res = await block(UNKNOWN_ID).expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('не-UUID -> 400 VALIDATION_ERROR', async () => {
      const res = await block('not-a-uuid').expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('без Origin -> 403 CSRF_REJECTED', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/users/${bob.id}/block`)
        .set('Cookie', aliceCookie)
        .expect(403);
      expect(res.body.code).toBe('CSRF_REJECTED');
    });

    it('удаляет подписки и запросы в обе стороны', async () => {
      const carol = await createUser(app, { userName: 'carol' });
      await link(alice.id, bob.id, 'ACCEPTED');
      await link(bob.id, alice.id, 'ACCEPTED');
      await link(alice.id, carol.id, 'ACCEPTED'); // чужая связь должна остаться
      await block(bob.id).expect(204);
      expect(
        await prisma.follow.count({ where: { followerId: alice.id, followingId: bob.id } }),
      ).toBe(0);
      expect(
        await prisma.follow.count({ where: { followerId: bob.id, followingId: alice.id } }),
      ).toBe(0);
      expect(await followCount()).toBe(1);

      // то же для PENDING-запросов
      await prisma.block.deleteMany();
      await link(bob.id, alice.id, 'PENDING');
      await block(bob.id).expect(204);
      expect(await prisma.follow.count({ where: { followingId: alice.id } })).toBe(0);
    });
  });

  describe('после блокировки (alice заблокировала bob)', () => {
    beforeEach(async () => {
      await block(bob.id).expect(204);
    });

    it('профиль по id и by-username -> 404 в обе стороны', async () => {
      const a = await get(`/users/${bob.id}`).expect(404);
      expect(a.body.code).toBe('NOT_FOUND');
      await get('/users/by-username/bob').expect(404);
      await get(`/users/${alice.id}`, bobCookie).expect(404);
      await get('/users/by-username/alice', bobCookie).expect(404);
    });

    it('404 одинаков с несуществующим пользователем (блокировка не раскрывается)', async () => {
      const blocked = await get(`/users/${alice.id}`, bobCookie).expect(404);
      const missing = await get(`/users/${UNKNOWN_ID}`, bobCookie).expect(404);
      expect(blocked.body.code).toBe(missing.body.code);
    });

    it('PUT follow -> 404 в обе стороны, связь не создаётся', async () => {
      await send('put', `/users/${bob.id}/follow`).expect(404);
      await send('put', `/users/${alice.id}/follow`, bobCookie).expect(404);
      expect(await followCount()).toBe(0);
    });

    it('followers/following/mutual-followers заблокированного -> 404', async () => {
      for (const path of ['followers', 'following', 'mutual-followers']) {
        await get(`/users/${bob.id}/${path}`).expect(404);
        await get(`/users/${alice.id}/${path}`, bobCookie).expect(404);
      }
    });

    it('списки третьего лица не содержат заблокированных (в обе стороны)', async () => {
      const carol = await createUser(app, { userName: 'carol' });
      await link(bob.id, carol.id, 'ACCEPTED');
      await link(alice.id, carol.id, 'ACCEPTED');
      await link(carol.id, bob.id, 'ACCEPTED');
      await link(carol.id, alice.id, 'ACCEPTED');

      // alice смотрит список carol: bob скрыт, alice сама видна
      const followers = (await get(`/users/${carol.id}/followers`).expect(200)).body;
      expect(ids(followers)).toEqual([alice.id]);
      // bob смотрит список carol: alice скрыта
      const followersForBob = (await get(`/users/${carol.id}/followers`, bobCookie).expect(200))
        .body;
      expect(ids(followersForBob)).toEqual([bob.id]);

      const following = (await get(`/users/${carol.id}/following`).expect(200)).body;
      expect(ids(following)).not.toContain(bob.id);
      const followingForBob = (await get(`/users/${carol.id}/following`, bobCookie).expect(200))
        .body;
      expect(ids(followingForBob)).not.toContain(alice.id);
    });

    it('suggestions не содержат заблокированных в обе стороны', async () => {
      const a = (await get('/users/suggestions').expect(200)).body as Item[];
      expect(a.map((i) => i.id)).not.toContain(bob.id);
      const b = (await get('/users/suggestions', bobCookie).expect(200)).body as Item[];
      expect(b.map((i) => i.id)).not.toContain(alice.id);
    });

    it('mutual-followers третьего лица не содержит заблокированных', async () => {
      const carol = await createUser(app, { userName: 'carol' });
      const dave = await createUser(app, { userName: 'dave' });
      // alice и bob (до блокировки не важно) подписаны на dave; carol подписана на alice и bob
      await link(alice.id, dave.id, 'ACCEPTED');
      await link(bob.id, dave.id, 'ACCEPTED');
      await link(carol.id, alice.id, 'ACCEPTED');
      await link(carol.id, bob.id, 'ACCEPTED');
      // bob блокирует carol: для carol он должен пропасть из общих подписчиков, alice — остаться
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: carol.id } });
      const carolCookie = await loginAs(app, carol);
      const res = (await get(`/users/${dave.id}/mutual-followers`, carolCookie).expect(200)).body;
      expect(ids(res)).toContain(alice.id);
      expect(ids(res)).not.toContain(bob.id);
    });
  });

  describe('GET /me/blocked', () => {
    it('пусто: items=[] и nextCursor=null', async () => {
      const res = await get('/me/blocked').expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('только мои блокировки; блокирующий не видит себя в списке заблокированного', async () => {
      await block(bob.id).expect(204);
      const mine = await get('/me/blocked').expect(200);
      expect(ids(mine.body)).toEqual([bob.id]);
      expect(mine.body.items[0]).toHaveProperty('userName', 'bob');
      expect(JSON.stringify(mine.body)).not.toContain('passwordHash');
      const theirs = await get('/me/blocked', bobCookie).expect(200);
      expect(theirs.body.items).toEqual([]);
    });

    it('курсор: страницы без дублей, nextCursor=null в конце', async () => {
      const others = await Promise.all(Array.from({ length: 5 }, () => createUser(app)));
      for (const u of others) await block(u.id).expect(204);

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res: request.Response = await get(
          `/me/blocked?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        ).expect(200);
        expect(res.body.items.length).toBeLessThanOrEqual(2);
        seen.push(...ids(res.body));
        cursor = res.body.nextCursor;
        pages++;
      } while (cursor && pages < 10);

      expect(pages).toBe(3);
      expect(cursor).toBeNull();
      expect([...seen].sort()).toEqual(others.map((u) => u.id).sort());
    });
  });

  describe('DELETE /users/{id}/block', () => {
    it('разблокирует: профиль снова виден, подписки не восстановлены', async () => {
      await link(alice.id, bob.id, 'ACCEPTED');
      await block(bob.id).expect(204);
      await send('delete', `/users/${bob.id}/block`).expect(204);

      expect(await prisma.block.count()).toBe(0);
      await get(`/users/${bob.id}`).expect(200);
      await get(`/users/${alice.id}`, bobCookie).expect(200);
      expect(await followCount()).toBe(0);
      expect((await get('/me/blocked').expect(200)).body.items).toEqual([]);
    });

    it('идемпотентен: без блокировки тоже 204', async () => {
      await send('delete', `/users/${bob.id}/block`).expect(204);
      await send('delete', `/users/${bob.id}/block`).expect(204);
    });

    it('не снимает блокировку, поставленную другим (bob заблокировал alice)', async () => {
      await block(alice.id, bobCookie).expect(204);
      await send('delete', `/users/${bob.id}/block`).expect(204);
      expect(await prisma.block.count({ where: { blockerId: bob.id, blockedId: alice.id } })).toBe(
        1,
      );
      await get(`/users/${bob.id}`).expect(404);
    });

    it('неизвестный id -> 404; не-UUID -> 400', async () => {
      await send('delete', `/users/${UNKNOWN_ID}/block`).expect(404);
      await send('delete', '/users/not-a-uuid/block').expect(400);
    });
  });

  describe('закрытый аккаунт', () => {
    let priv: TestUser;
    let privCookie: string;

    beforeEach(async () => {
      priv = await createUser(app, { userName: 'secret', isPrivate: true });
      privCookie = await loginAs(app, priv);
    });

    it('чужие followers/following -> 403 PRIVATE_ACCOUNT', async () => {
      for (const path of ['followers', 'following']) {
        const res = await get(`/users/${priv.id}/${path}`).expect(403);
        expect(res.body.code).toBe('PRIVATE_ACCOUNT');
      }
    });

    it('PENDING-подписчик по-прежнему получает 403', async () => {
      await link(alice.id, priv.id, 'PENDING');
      await get(`/users/${priv.id}/followers`).expect(403);
      await get(`/users/${priv.id}/following`).expect(403);
    });

    it('ACCEPTED-подписчик и владелец видят списки', async () => {
      await link(alice.id, priv.id, 'ACCEPTED');
      await get(`/users/${priv.id}/followers`).expect(200);
      await get(`/users/${priv.id}/following`).expect(200);
      await get(`/users/${priv.id}/followers`, privCookie).expect(200);
    });

    it('профиль виден всем, canViewContent зависит от подписки', async () => {
      expect((await get(`/users/${priv.id}`).expect(200)).body.canViewContent).toBe(false);
      await link(alice.id, priv.id, 'PENDING');
      expect((await get(`/users/${priv.id}`).expect(200)).body.canViewContent).toBe(false);
      await prisma.follow.updateMany({
        where: { followerId: alice.id, followingId: priv.id },
        data: { status: 'ACCEPTED' },
      });
      expect((await get(`/users/${priv.id}`).expect(200)).body.canViewContent).toBe(true);
      expect((await get(`/users/${priv.id}`, privCookie).expect(200)).body.canViewContent).toBe(
        true,
      );
    });

    it('блокировка сильнее подписки: заблокированный подписчик получает 404', async () => {
      await link(alice.id, priv.id, 'ACCEPTED');
      await block(priv.id, aliceCookie).expect(204); // alice блокирует priv, подписка снята
      await get(`/users/${priv.id}/followers`).expect(404);
      await get(`/users/${alice.id}`, privCookie).expect(404);
    });
  });
});
