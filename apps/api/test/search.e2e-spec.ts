import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

interface UserItem {
  id: string;
  userName: string;
  followStatus?: string;
}

interface HistoryItem {
  id: string;
  type: string;
  query?: string | null;
  user?: { id: string; userName: string } | null;
}

describe('Search: аккаунты, общий поиск, подсказки @, история', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    me = await createUser(app, { userName: 'alice' });
    cookie = await loginAs(app, me);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const get = (path: string, c: string | null = cookie) => {
    const req = request(server()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (method: 'post' | 'delete', path: string, c: string | null = cookie) => {
    const req = request(server())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const names = (body: { items: UserItem[] }) => body.items.map((i) => i.userName);
  const searchUsers = async (q: string, c: string | null = cookie) =>
    names((await get(`/search/users?q=${encodeURIComponent(q)}`, c).expect(200)).body);
  const history = async (query = '', c: string | null = cookie) =>
    (await get(`/me/search-history${query}`, c).expect(200)).body as {
      items: HistoryItem[];
      nextCursor: string | null;
    };
  const addQuery = (query: string, c: string | null = cookie) =>
    send('post', '/me/search-history', c).send({ type: 'QUERY', query });
  const addUser = (userId: string, c: string | null = cookie) =>
    send('post', '/me/search-history', c).send({ type: 'USER', userId });

  describe('без сессии', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    it.each([
      ['get', '/search?q=a'],
      ['get', '/search/users?q=a'],
      ['get', '/search/mentions?q=a'],
      ['get', '/me/search-history'],
      ['post', '/me/search-history'],
      ['delete', `/me/search-history/${id}`],
      ['delete', '/me/search-history'],
    ] as const)('%s %s -> 401', async (method, path) => {
      const res =
        method === 'get'
          ? await get(path, null).expect(401)
          : await send(method, path, null).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /search/users', () => {
    it('находит по началу и по вхождению userName, без учёта регистра', async () => {
      await createUser(app, { userName: 'johnny' });
      await createUser(app, { userName: 'big_john' });
      await createUser(app, { userName: 'mary' });
      const found = await searchUsers('JOHN');
      expect(found.sort()).toEqual(['big_john', 'johnny']);
    });

    it('находит по началу и по вхождению fullName, без учёта регистра', async () => {
      await createUser(app, { userName: 'u_one', fullName: 'Maria Ivanova' });
      await createUser(app, { userName: 'u_two', fullName: 'Anna Mariana' });
      await createUser(app, { userName: 'u_three', fullName: 'Petr Petrov' });
      expect((await searchUsers('mari')).sort()).toEqual(['u_one', 'u_two']);
    });

    it('форма элемента: id, userName, followStatus', async () => {
      const bob = await createUser(app, { userName: 'bobby' });
      const res = await get('/search/users?q=bobby').expect(200);
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.items).toEqual([
        expect.objectContaining({
          id: bob.id,
          userName: 'bobby',
          followStatus: expect.any(String),
        }),
      ]);
    });

    it('не ищет по email', async () => {
      await createUser(app, { userName: 'bob', email: 'hidden.address@example.test' });
      expect(await searchUsers('hidden.address')).toEqual([]);
    });

    it('закрытые аккаунты находятся', async () => {
      await createUser(app, { userName: 'secret_one', isPrivate: true });
      expect(await searchUsers('secret_one')).toEqual(['secret_one']);
    });

    it('заблокированный мной и заблокировавший меня не выдаются', async () => {
      const blockedByMe = await createUser(app, { userName: 'target_a' });
      const blocker = await createUser(app, { userName: 'target_b' });
      await createUser(app, { userName: 'target_c' });
      await prisma.block.create({ data: { blockerId: me.id, blockedId: blockedByMe.id } });
      await prisma.block.create({ data: { blockerId: blocker.id, blockedId: me.id } });
      expect(await searchUsers('target_')).toEqual(['target_c']);
    });

    it('мои подписки выше остальных', async () => {
      await createUser(app, { userName: 'match_a' });
      await createUser(app, { userName: 'match_b' });
      const followed = await createUser(app, { userName: 'match_z' });
      await prisma.follow.create({
        data: {
          followerId: me.id,
          followingId: followed.id,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      const found = await searchUsers('match_');
      expect(found).toHaveLength(3);
      expect(found[0]).toBe('match_z');
    });

    it('курсор: страницы без дублей, nextCursor=null в конце', async () => {
      for (let i = 0; i < 5; i += 1) await createUser(app, { userName: `page_${i}` });
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 10; guard += 1) {
        const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        const res = await get(`/search/users?q=page_&limit=2${suffix}`).expect(200);
        expect(res.body.items.length).toBeLessThanOrEqual(2);
        seen.push(...res.body.items.map((i: UserItem) => i.id));
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      expect(cursor).toBeNull();
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it.each([
      ['пустой q', '/search/users?q='],
      ['нет q', '/search/users'],
      ['q длиннее 50', `/search/users?q=${'a'.repeat(51)}`],
    ])('%s -> 400 VALIDATION_ERROR', async (_name, path) => {
      const res = await get(path).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
    });

    it('q ровно 50 символов допустим', async () => {
      await get(`/search/users?q=${'a'.repeat(50)}`).expect(200);
    });
  });

  describe('GET /search', () => {
    it('возвращает users, hashtags: [], locations: []', async () => {
      await createUser(app, { userName: 'findme' });
      const res = await get('/search?q=findme').expect(200);
      expect(res.body.users.map((u: UserItem) => u.userName)).toEqual(['findme']);
      expect(res.body.hashtags).toEqual([]);
      expect(res.body.locations).toEqual([]);
    });

    it('заблокированные не выдаются', async () => {
      const bob = await createUser(app, { userName: 'findme_blocked' });
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: me.id } });
      const res = await get('/search?q=findme').expect(200);
      expect(res.body.users).toEqual([]);
    });

    it('не больше 10 пользователей', async () => {
      for (let i = 0; i < 12; i += 1) await createUser(app, { userName: `many_${i}` });
      const res = await get('/search?q=many_').expect(200);
      expect(res.body.users).toHaveLength(10);
    });

    it.each([['/search?q='], [`/search?q=${'a'.repeat(51)}`]])('%s -> 400', async (path) => {
      const res = await get(path).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /search/mentions', () => {
    it('возвращает массив UserSummary до 10, без заблокированных', async () => {
      for (let i = 0; i < 12; i += 1) await createUser(app, { userName: `ment_${i}` });
      const blocked = await createUser(app, { userName: 'ment_blocked' });
      await prisma.block.create({ data: { blockerId: me.id, blockedId: blocked.id } });
      const res = await get('/search/mentions?q=ment_').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(10);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.map((u: UserItem) => u.userName)).not.toContain('ment_blocked');
    });

    it('пустой q -> 400', async () => {
      const res = await get('/search/mentions?q=').expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('история поиска', () => {
    it('POST QUERY и USER -> 201, записи видны в GET (новые сверху)', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const q = await addQuery('cats').expect(201);
      expect(q.body).toEqual(expect.objectContaining({ type: 'QUERY', query: 'cats' }));
      const u = await addUser(bob.id).expect(201);
      expect(u.body.type).toBe('USER');
      expect(u.body.user).toEqual(expect.objectContaining({ id: bob.id, userName: 'bob' }));

      const all = await history();
      expect(all.items.map((i) => i.id)).toEqual([u.body.id, q.body.id]);
      expect(all.nextCursor).toBeNull();
    });

    it('?type фильтрует по типу', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await addQuery('cats').expect(201);
      await addUser(bob.id).expect(201);
      const onlyQueries = await history('?type=QUERY');
      expect(onlyQueries.items.map((i) => i.type)).toEqual(['QUERY']);
      const onlyUsers = await history('?type=USER');
      expect(onlyUsers.items.map((i) => i.type)).toEqual(['USER']);
    });

    it('POST с неизвестным type -> 400', async () => {
      const res = await send('post', '/me/search-history').send({ type: 'OTHER', query: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST QUERY без query -> 400', async () => {
      const res = await send('post', '/me/search-history').send({ type: 'QUERY' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST USER с несуществующим userId -> 404', async () => {
      await addUser('00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('повтор запроса: без дубля, запись поднимается наверх', async () => {
      const first = await addQuery('cats').expect(201);
      await addQuery('dogs').expect(201);
      const again = await addQuery('cats').expect(201);
      expect(again.body.id).toBe(first.body.id);

      const all = await history('?type=QUERY');
      expect(all.items.map((i) => i.query)).toEqual(['cats', 'dogs']);
    });

    it('повтор USER: без дубля', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await addUser(bob.id).expect(201);
      await addUser(bob.id).expect(201);
      expect((await history('?type=USER')).items).toHaveLength(1);
    });

    it('больше 50 записей типа: старые обрезаются', async () => {
      for (let i = 0; i < 52; i += 1) await addQuery(`q${i}`).expect(201);
      const count = await prisma.searchHistoryEntry.count({
        where: { userId: me.id, type: 'QUERY' },
      });
      expect(count).toBe(50);
      const stored = await prisma.searchHistoryEntry.findMany({
        where: { userId: me.id, type: 'QUERY' },
        select: { query: true },
      });
      const queries = stored.map((s) => s.query);
      expect(queries).not.toContain('q0');
      expect(queries).not.toContain('q1');
      expect(queries).toContain('q51');
    });

    it('лимит считается отдельно по типам', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await addUser(bob.id).expect(201);
      for (let i = 0; i < 51; i += 1) await addQuery(`q${i}`).expect(201);
      expect((await history('?type=USER')).items).toHaveLength(1);
    });

    it('история приватна: чужие записи не видны', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const bobCookie = await loginAs(app, bob);
      await addQuery('secret', bobCookie).expect(201);
      expect((await history()).items).toEqual([]);
    });

    it('DELETE своей записи -> 204, запись исчезает', async () => {
      const e = await addQuery('cats').expect(201);
      await send('delete', `/me/search-history/${e.body.id}`).expect(204);
      expect((await history()).items).toEqual([]);
    });

    it('DELETE чужой записи -> 404, запись остаётся', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const bobCookie = await loginAs(app, bob);
      const e = await addQuery('cats', bobCookie).expect(201);
      await send('delete', `/me/search-history/${e.body.id}`).expect(404);
      expect(await prisma.searchHistoryEntry.count({ where: { userId: bob.id } })).toBe(1);
    });

    it('DELETE несуществующей записи -> 404', async () => {
      await send('delete', '/me/search-history/00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('DELETE без type очищает только мои записи', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const bobCookie = await loginAs(app, bob);
      await addQuery('mine').expect(201);
      await addQuery('theirs', bobCookie).expect(201);
      await send('delete', '/me/search-history').expect(204);
      expect((await history()).items).toEqual([]);
      expect((await history('', bobCookie)).items).toHaveLength(1);
    });

    it('DELETE ?type=QUERY очищает только этот тип', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await addQuery('mine').expect(201);
      await addUser(bob.id).expect(201);
      await send('delete', '/me/search-history?type=QUERY').expect(204);
      const left = await history();
      expect(left.items.map((i) => i.type)).toEqual(['USER']);
    });
  });
});
