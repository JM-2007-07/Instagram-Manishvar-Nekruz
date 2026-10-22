import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { createPost } from './helpers/posts';
import { resetThrottler } from './helpers/throttler';

interface PostBody {
  id: string;
  isSavedByMe: boolean;
}
interface PageBody {
  items: PostBody[];
  nextCursor: string | null;
}
interface CollectionBody {
  id: string;
  name: string;
  coverUrl: string | null;
  postCount: number;
}

describe('Collections: сохранённое и подборки', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let me: TestUser;
  let other: TestUser;
  let cookie: string;
  let otherCookie: string;

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
    other = await createUser(app, { userName: 'bob' });
    cookie = await loginAs(app, me);
    otherCookie = await loginAs(app, other);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, c: string | null = cookie) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (
    method: 'patch' | 'put' | 'post' | 'delete',
    path: string,
    c: string | null = cookie,
  ) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const ids = (body: PageBody) => body.items.map((i) => i.id);

  it('требует вход', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await get('/me/saved', null).expect(401);
    await get('/me/collections', null).expect(401);
    await send('put', `/posts/${id}/save`, null).expect(401);
  });

  describe('сохранение', () => {
    it('PUT/DELETE save идемпотентны, isSavedByMe и «Сохранённое» (новые первыми, курсор)', async () => {
      const p1 = await createPost(app, other);
      const p2 = await createPost(app, other);
      await send('put', `/posts/${p1.id}/save`).expect(204);
      await send('put', `/posts/${p1.id}/save`).expect(204);
      await send('put', `/posts/${p2.id}/save`).expect(204);

      const post = await get(`/posts/${p1.id}`).expect(200);
      expect((post.body as PostBody).isSavedByMe).toBe(true);
      expect(
        ((await get(`/posts/${p1.id}`, otherCookie).expect(200)).body as PostBody).isSavedByMe,
      ).toBe(false);

      const first = await get('/me/saved?limit=1').expect(200);
      expect(ids(first.body as PageBody)).toEqual([p2.id]);
      const cursor = (first.body as PageBody).nextCursor;
      expect(cursor).not.toBeNull();
      const second = await get(`/me/saved?limit=1&cursor=${cursor}`).expect(200);
      expect(ids(second.body as PageBody)).toEqual([p1.id]);
      expect((second.body as PageBody).nextCursor).toBeNull();

      await send('delete', `/posts/${p1.id}/save`).expect(204);
      await send('delete', `/posts/${p1.id}/save`).expect(204);
      expect(ids((await get('/me/saved').expect(200)).body as PageBody)).toEqual([p2.id]);
    });

    it('недоступный пост: несуществующий, закрытый аккаунт, блокировка, архив — 404', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      await send('put', `/posts/${missing}/save`).expect(404);

      const priv = await createUser(app, { userName: 'private_one', isPrivate: true });
      const privPost = await createPost(app, priv);
      await send('put', `/posts/${privPost.id}/save`).expect(404);

      const blocker = await createUser(app, { userName: 'blocker' });
      const blockedPost = await createPost(app, blocker);
      await prisma.block.create({ data: { blockerId: blocker.id, blockedId: me.id } });
      await send('put', `/posts/${blockedPost.id}/save`).expect(404);

      const archived = await createPost(app, other, { isArchived: true });
      await send('put', `/posts/${archived.id}/save`).expect(404);
    });

    it('посты, ставшие недоступными, скрыты из «Сохранённого»', async () => {
      const visible = await createPost(app, other);
      const hidden = await createPost(app, other);
      await send('put', `/posts/${visible.id}/save`).expect(204);
      await send('put', `/posts/${hidden.id}/save`).expect(204);

      await prisma.user.update({ where: { id: other.id }, data: { isPrivate: true } });
      expect(ids((await get('/me/saved').expect(200)).body as PageBody)).toEqual([]);

      await prisma.user.update({ where: { id: other.id }, data: { isPrivate: false } });
      await prisma.post.update({ where: { id: hidden.id }, data: { isArchived: true } });
      expect(ids((await get('/me/saved').expect(200)).body as PageBody)).toEqual([visible.id]);

      await prisma.block.create({ data: { blockerId: me.id, blockedId: other.id } });
      expect(ids((await get('/me/saved').expect(200)).body as PageBody)).toEqual([]);
      await prisma.post.delete({ where: { id: visible.id } });
      expect(await prisma.savedPost.count({ where: { userId: me.id } })).toBe(1);
    });
  });

  describe('подборки', () => {
    it('создание с postIds, список с обложкой и счётчиком, посты подборки', async () => {
      const p1 = await createPost(app, other);
      const p2 = await createPost(app, other);
      const created = await send('post', '/me/collections')
        .send({ name: '  Trip  ', postIds: [p1.id, p2.id] })
        .expect(201);
      const collection = created.body as CollectionBody;
      expect(collection.name).toBe('Trip');
      expect(collection.postCount).toBe(2);
      expect(collection.coverUrl).toMatch(/^\/api\/v1\/media\//);
      // посты автоматически сохранены
      expect(await prisma.savedPost.count({ where: { userId: me.id } })).toBe(2);

      const list = await get('/me/collections').expect(200);
      expect((list.body as CollectionBody[]).map((c) => c.id)).toEqual([collection.id]);

      const posts = await get(`/me/collections/${collection.id}/posts?limit=1`).expect(200);
      expect((posts.body as PageBody).items).toHaveLength(1);
      expect((posts.body as PageBody).nextCursor).not.toBeNull();
    });

    it('валидация: пустое/длинное имя -> 400; недоступный postId -> 404', async () => {
      await send('post', '/me/collections').send({ name: '   ' }).expect(400);
      await send('post', '/me/collections')
        .send({ name: 'x'.repeat(51) })
        .expect(400);
      await send('post', '/me/collections')
        .send({ name: 'ok', postIds: ['00000000-0000-4000-8000-000000000000'] })
        .expect(404);
      expect(await prisma.collection.count()).toBe(0);
    });

    it('PUT/DELETE пост в подборке: сохраняет пост, идемпотентно; удаление из подборки оставляет сохранённым', async () => {
      const p = await createPost(app, other);
      const c = (await send('post', '/me/collections').send({ name: 'A' }).expect(201))
        .body as CollectionBody;
      await send('put', `/me/collections/${c.id}/posts/${p.id}`).expect(204);
      await send('put', `/me/collections/${c.id}/posts/${p.id}`).expect(204);
      expect(await prisma.savedPost.count({ where: { userId: me.id } })).toBe(1);
      expect(
        ((await get('/me/collections').expect(200)).body as CollectionBody[])[0].postCount,
      ).toBe(1);

      await send('delete', `/me/collections/${c.id}/posts/${p.id}`).expect(204);
      expect(await prisma.savedPost.count({ where: { userId: me.id } })).toBe(1);
      expect(
        ((await get('/me/collections').expect(200)).body as CollectionBody[])[0].postCount,
      ).toBe(0);
    });

    it('снятие сохранения убирает пост из всех подборок', async () => {
      const p = await createPost(app, other);
      const c = (
        await send('post', '/me/collections')
          .send({ name: 'A', postIds: [p.id] })
          .expect(201)
      ).body as CollectionBody;
      await send('delete', `/posts/${p.id}/save`).expect(204);
      expect(await prisma.collectionItem.count({ where: { collectionId: c.id } })).toBe(0);
    });

    it('PATCH: переименование и обложка (только пост из подборки), DELETE оставляет посты сохранёнными', async () => {
      const p1 = await createPost(app, other);
      const p2 = await createPost(app, other);
      const outside = await createPost(app, other);
      const c = (
        await send('post', '/me/collections')
          .send({ name: 'A', postIds: [p1.id, p2.id] })
          .expect(201)
      ).body as CollectionBody;

      const renamed = await send('patch', `/me/collections/${c.id}`)
        .send({ name: 'B', coverPostId: p1.id })
        .expect(200);
      expect((renamed.body as CollectionBody).name).toBe('B');
      await send('patch', `/me/collections/${c.id}`).send({ coverPostId: outside.id }).expect(400);
      await send('patch', `/me/collections/${c.id}`).send({ name: '' }).expect(400);

      await send('delete', `/me/collections/${c.id}`).expect(204);
      await send('delete', `/me/collections/${c.id}`).expect(404);
      expect(await prisma.savedPost.count({ where: { userId: me.id } })).toBe(2);
    });

    it('чужая подборка: 404 на все операции', async () => {
      const p = await createPost(app, me);
      const theirs = (
        await send('post', '/me/collections', otherCookie).send({ name: 'Secret' }).expect(201)
      ).body as CollectionBody;
      const path = `/me/collections/${theirs.id}`;
      await get(`${path}/posts`).expect(404);
      await send('patch', path).send({ name: 'Mine' }).expect(404);
      await send('delete', path).expect(404);
      await send('put', `${path}/posts/${p.id}`).expect(404);
      await send('delete', `${path}/posts/${p.id}`).expect(404);
      expect(((await get('/me/collections').expect(200)).body as CollectionBody[]).length).toBe(0);
    });

    it('посты подборки: ставшие недоступными скрыты и не входят в postCount', async () => {
      const p1 = await createPost(app, other);
      const p2 = await createPost(app, other);
      const c = (
        await send('post', '/me/collections')
          .send({ name: 'A', postIds: [p1.id, p2.id] })
          .expect(201)
      ).body as CollectionBody;
      await prisma.post.update({ where: { id: p2.id }, data: { isArchived: true } });
      expect(
        ids((await get(`/me/collections/${c.id}/posts`).expect(200)).body as PageBody),
      ).toEqual([p1.id]);
      expect(
        ((await get('/me/collections').expect(200)).body as CollectionBody[])[0].postCount,
      ).toBe(1);
    });
  });
});
