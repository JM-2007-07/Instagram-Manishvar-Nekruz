import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { createPost, createReadyMedia } from './helpers/posts';
import { resetThrottler } from './helpers/throttler';

interface PostBody {
  id: string;
  shortcode: string;
  type: string;
  status: string;
  author: { id: string };
  items: {
    position: number;
    media: { id: string; kind: string; url: string };
    altText: string | null;
    tags: unknown[];
  }[];
  caption: string | null;
  likeCount: number | null;
  isLikedByMe: boolean;
  isPinned: boolean;
  location: { id: string } | null;
}

describe('Posts: публикации, ленты, лайки', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notify: jest.SpyInstance;
  let notifyRemove: jest.SpyInstance;
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
    notifyRemove = jest.spyOn(app.get(NotificationsService), 'remove');
    me = await createUser(app, { userName: 'alice' });
    cookie = await loginAs(app, me);
  });

  afterEach(() => {
    notify.mockRestore();
    notifyRemove.mockRestore();
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
  const follow = (followerId: string, followingId: string) =>
    prisma.follow.create({
      data: { followerId, followingId, status: 'ACCEPTED', acceptedAt: new Date() },
    });
  const ids = (body: { items: { id: string }[] }) => body.items.map((i) => i.id);

  describe('защита маршрутов', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    it.each([
      ['get', `/posts/${id}`],
      ['get', '/posts/by-shortcode/abc'],
      ['get', '/feed'],
      ['get', '/explore'],
      ['get', '/reels'],
      ['get', `/users/${id}/posts`],
      ['put', `/posts/${id}/like`],
      ['delete', `/posts/${id}`],
    ] as const)('%s %s без сессии -> 401', async (method, path) => {
      const res =
        method === 'get'
          ? await get(path, null).expect(401)
          : await send(method, path, null).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('POST /posts без Origin -> 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('Cookie', cookie)
        .send({ type: 'POST', items: [] })
        .expect(403);
    });
  });

  describe('POST /posts', () => {
    it('создаёт пост с фото: DTO по контракту, хэштег, упоминание, отметка, место', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const carol = await createUser(app, { userName: 'carol' });
      const location = await prisma.location.create({
        data: { name: 'Square', slug: 'square-city', city: 'City', country: 'Land' },
      });
      const mediaId = await createReadyMedia(app, me.id);

      const res = await send('post', '/posts')
        .send({
          type: 'POST',
          caption: 'Привет #Закат с @bob',
          locationId: location.id,
          items: [{ mediaId, altText: 'sunset', tags: [{ userId: carol.id, x: 0.2, y: 0.8 }] }],
        })
        .expect(201);
      const post = res.body as PostBody;
      expect(post).toMatchObject({
        type: 'POST',
        status: 'PUBLISHED',
        caption: 'Привет #Закат с @bob',
        likeCount: 0,
        isLikedByMe: false,
        isPinned: false,
        commentsDisabled: false,
        hideLikeCount: false,
        isArchived: false,
        isSavedByMe: false,
      });
      expect(post.author.id).toBe(me.id);
      expect(post.location?.id).toBe(location.id);
      expect(post.shortcode.length).toBeGreaterThanOrEqual(8);
      expect(post.items).toHaveLength(1);
      expect(post.items[0]).toMatchObject({ position: 0, altText: 'sunset' });
      expect(post.items[0].media.id).toBe(mediaId);
      expect(post.items[0].tags).toHaveLength(1);

      // Связи созданы, файл привязан.
      expect(
        await prisma.postHashtag.count({ where: { postId: post.id, hashtag: { name: 'закат' } } }),
      ).toBe(1);
      expect(await prisma.postMention.count({ where: { postId: post.id, userId: bob.id } })).toBe(
        1,
      );
      expect((await prisma.mediaFile.findUnique({ where: { id: mediaId } }))?.attachedTo).toBe(
        'POST',
      );

      // Уведомления после транзакции.
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'POST_TAG',
          recipientId: carol.id,
          actorId: me.id,
          postId: post.id,
        }),
      );
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MENTION_POST', recipientId: bob.id, postId: post.id }),
      );
    });

    it('карусель: порядок элементов сохраняется', async () => {
      const a = await createReadyMedia(app, me.id);
      const b = await createReadyMedia(app, me.id);
      const res = await send('post', '/posts')
        .send({ type: 'POST', items: [{ mediaId: b }, { mediaId: a }] })
        .expect(201);
      expect((res.body as PostBody).items.map((i) => i.media.id)).toEqual([b, a]);
    });

    it('чужое медиа -> 400, пост не создан', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const foreign = await createReadyMedia(app, bob.id);
      const res = await send('post', '/posts')
        .send({ type: 'POST', items: [{ mediaId: foreign }] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(await prisma.post.count()).toBe(0);
    });

    it('уже привязанное медиа -> 409 MEDIA_ALREADY_USED', async () => {
      const used = await createReadyMedia(app, me.id, { attached: true });
      const res = await send('post', '/posts')
        .send({ type: 'POST', items: [{ mediaId: used }] })
        .expect(409);
      expect(res.body.code).toBe('MEDIA_ALREADY_USED');
    });

    it('неготовое медиа -> 409 MEDIA_NOT_READY', async () => {
      const mediaId = await createReadyMedia(app, me.id);
      await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'PROCESSING' } });
      const res = await send('post', '/posts')
        .send({ type: 'POST', items: [{ mediaId }] })
        .expect(409);
      expect(res.body.code).toBe('MEDIA_NOT_READY');
      expect(await prisma.post.count()).toBe(0);
    });

    it('неверное место -> 400, файл остаётся свободным', async () => {
      const mediaId = await createReadyMedia(app, me.id);
      await send('post', '/posts')
        .send({
          type: 'POST',
          locationId: '00000000-0000-4000-8000-000000000000',
          items: [{ mediaId }],
        })
        .expect(400);
      expect(
        (await prisma.mediaFile.findUnique({ where: { id: mediaId } }))?.attachedTo,
      ).toBeNull();
    });

    it('валидация: пустые items, слишком длинная подпись, лишнее поле -> 400', async () => {
      const mediaId = await createReadyMedia(app, me.id);
      await send('post', '/posts').send({ type: 'POST', items: [] }).expect(400);
      await send('post', '/posts')
        .send({ type: 'POST', caption: 'x'.repeat(2201), items: [{ mediaId }] })
        .expect(400);
      await send('post', '/posts')
        .send({ type: 'POST', items: [{ mediaId }], authorId: me.id })
        .expect(400);
    });

    it('reel: одно видео -> 201; фото в reel -> 400', async () => {
      const video = await createReadyMedia(app, me.id, { kind: 'VIDEO', purpose: 'REEL' });
      const res = await send('post', '/posts')
        .send({ type: 'REEL', items: [{ mediaId: video }] })
        .expect(201);
      expect((res.body as PostBody).type).toBe('REEL');
      const photo = await createReadyMedia(app, me.id);
      await send('post', '/posts')
        .send({ type: 'REEL', items: [{ mediaId: photo }] })
        .expect(400);
    });

    it('отметить пользователя, который запретил отметки (tagsFrom=NO_ONE) -> 400', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      await prisma.userSettings.update({ where: { userId: bob.id }, data: { tagsFrom: 'NO_ONE' } });
      const mediaId = await createReadyMedia(app, me.id);
      await send('post', '/posts')
        .send({ type: 'POST', items: [{ mediaId, tags: [{ userId: bob.id, x: 0.5, y: 0.5 }] }] })
        .expect(400);
    });
  });

  describe('просмотр', () => {
    it('по id и по shortcode', async () => {
      const post = await createPost(app, me, { caption: 'hi' });
      const byId = await get(`/posts/${post.id}`).expect(200);
      expect((byId.body as PostBody).caption).toBe('hi');
      const byCode = await get(`/posts/by-shortcode/${post.shortcode}`).expect(200);
      expect((byCode.body as PostBody).id).toBe(post.id);
      await get('/posts/by-shortcode/unknown').expect(404);
      await get('/posts/not-a-uuid').expect(400);
    });

    it('закрытый аккаунт: чужой -> 403 PRIVATE_ACCOUNT, подписчик видит', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const post = await createPost(app, priv);
      const res = await get(`/posts/${post.id}`).expect(403);
      expect(res.body.code).toBe('PRIVATE_ACCOUNT');
      await follow(me.id, priv.id);
      await get(`/posts/${post.id}`).expect(200);
    });

    it('блокировка в любую сторону -> 404', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const post = await createPost(app, bob);
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: me.id } });
      await get(`/posts/${post.id}`).expect(404);
      await get(`/posts/by-shortcode/${post.shortcode}`).expect(404);
    });

    it('архивный пост виден только автору', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const post = await createPost(app, bob, { isArchived: true });
      await get(`/posts/${post.id}`).expect(404);
      await get(`/posts/${post.id}`, await loginAs(app, bob)).expect(200);
    });

    it('hideLikeCount: другим likeCount = null, автору — число', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const post = await createPost(app, bob, { hideLikeCount: true });
      await prisma.postLike.create({ data: { userId: me.id, postId: post.id } });
      expect(((await get(`/posts/${post.id}`).expect(200)).body as PostBody).likeCount).toBeNull();
      const own = await get(`/posts/${post.id}`, await loginAs(app, bob)).expect(200);
      expect((own.body as PostBody).likeCount).toBe(1);
      await get(`/posts/${post.id}/likes`).expect(403);
    });
  });

  describe('изменение и удаление', () => {
    it('PATCH: автор меняет подпись, хэштеги обновляются, editedAt заполнен; чужой -> 403', async () => {
      const post = await createPost(app, me, { caption: '#old' });
      await prisma.postHashtag.create({
        data: {
          postId: post.id,
          hashtagId: (await prisma.hashtag.create({ data: { name: 'old' } })).id,
        },
      });
      const res = await send('patch', `/posts/${post.id}`)
        .send({ caption: 'now #fresh', items: [{ position: 0, altText: 'alt' }] })
        .expect(200);
      const body = res.body as PostBody & { editedAt: string | null };
      expect(body.caption).toBe('now #fresh');
      expect(body.editedAt).not.toBeNull();
      expect(body.items[0].altText).toBe('alt');
      const links = await prisma.postHashtag.findMany({
        where: { postId: post.id },
        select: { hashtag: { select: { name: true } } },
      });
      expect(links.map((l) => l.hashtag.name)).toEqual(['fresh']);

      const bob = await createUser(app, { userName: 'bob' });
      await send('patch', `/posts/${post.id}`, await loginAs(app, bob))
        .send({ caption: 'x' })
        .expect(403);
    });

    it('DELETE: автор удаляет пост и файл; чужой -> 403; несуществующий -> 404', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const post = await createPost(app, me);
      const media = await prisma.postMedia.findFirst({ where: { postId: post.id } });
      await send('delete', `/posts/${post.id}`, await loginAs(app, bob)).expect(403);
      expect(await prisma.post.count()).toBe(1);
      await send('delete', `/posts/${post.id}`).expect(204);
      expect(await prisma.post.count()).toBe(0);
      expect(await prisma.mediaFile.findUnique({ where: { id: media?.mediaId } })).toBeNull();
      await send('delete', `/posts/${post.id}`).expect(404);
    });

    it('DELETE: ADMIN может удалить чужой пост', async () => {
      const admin = await createUser(app, { userName: 'root', role: 'ADMIN' });
      const post = await createPost(app, me);
      await send('delete', `/posts/${post.id}`, await loginAs(app, admin)).expect(204);
      expect(await prisma.post.count()).toBe(0);
    });

    it('архив и закрепление: архив скрывает пост; четвёртое закрепление -> 409', async () => {
      const posts = [];
      for (let i = 0; i < 4; i++) posts.push(await createPost(app, me));
      for (let i = 0; i < 3; i++) await send('put', `/posts/${posts[i].id}/pin`).expect(204);
      const limit = await send('put', `/posts/${posts[3].id}/pin`).expect(409);
      expect(limit.body.code).toBe('LIMIT_REACHED');
      await send('put', `/posts/${posts[0].id}/pin`).expect(204); // повтор идемпотентен

      const grid = await get(`/users/${me.id}/posts`).expect(200);
      expect(ids(grid.body)).toHaveLength(4);
      expect((grid.body as { items: PostBody[] }).items.slice(0, 3).every((p) => p.isPinned)).toBe(
        true,
      );

      await send('put', `/posts/${posts[3].id}/archive`).expect(204);
      const bob = await createUser(app, { userName: 'bob' });
      await get(`/posts/${posts[3].id}`, await loginAs(app, bob)).expect(404);
      expect(ids((await get('/me/archive/posts').expect(200)).body)).toEqual([posts[3].id]);
      await send('delete', `/posts/${posts[3].id}/archive`).expect(204);
      await get(`/posts/${posts[3].id}`, await loginAs(app, bob)).expect(200);
    });
  });

  describe('ленты и сетки', () => {
    it('GET /feed: свои и подписки; без чужих, заблокированных и скрытых (mute)', async () => {
      const followed = await createUser(app, { userName: 'followed' });
      const stranger = await createUser(app, { userName: 'stranger' });
      const blocked = await createUser(app, { userName: 'blocked' });
      const muted = await createUser(app, { userName: 'muted' });
      await follow(me.id, followed.id);
      await follow(me.id, blocked.id);
      await follow(me.id, muted.id);
      await prisma.block.create({ data: { blockerId: blocked.id, blockedId: me.id } });
      await prisma.mute.create({ data: { ownerId: me.id, targetId: muted.id, mutePosts: true } });

      const t = Date.now();
      const own = await createPost(app, me, { createdAt: new Date(t - 3000) });
      const fromFollowed = await createPost(app, followed, { createdAt: new Date(t - 2000) });
      await createPost(app, stranger);
      await createPost(app, blocked);
      await createPost(app, muted);
      await createPost(app, followed, { isArchived: true });

      const res = await get('/feed').expect(200);
      expect(ids(res.body)).toEqual([fromFollowed.id, own.id]);
      expect(res.body.nextCursor).toBeNull();
    });

    it('GET /feed: курсорная пагинация без повторов', async () => {
      const t = Date.now();
      const created = [];
      for (let i = 0; i < 5; i++)
        created.push(await createPost(app, me, { createdAt: new Date(t - i * 1000) }));
      const first = await get('/feed?limit=2').expect(200);
      expect(ids(first.body)).toEqual([created[0].id, created[1].id]);
      expect(first.body.nextCursor).not.toBeNull();
      const second = await get(`/feed?limit=2&cursor=${first.body.nextCursor}`).expect(200);
      expect(ids(second.body)).toEqual([created[2].id, created[3].id]);
      const third = await get(`/feed?limit=2&cursor=${second.body.nextCursor}`).expect(200);
      expect(ids(third.body)).toEqual([created[4].id]);
      expect(third.body.nextCursor).toBeNull();
      await get('/feed?cursor=garbage').expect(400);
    });

    it('GET /feed/favorites: только избранные из подписок', async () => {
      const fav = await createUser(app, { userName: 'fav' });
      const other = await createUser(app, { userName: 'other' });
      await follow(me.id, fav.id);
      await follow(me.id, other.id);
      await prisma.favoriteAccount.create({ data: { ownerId: me.id, targetId: fav.id } });
      const favPost = await createPost(app, fav);
      await createPost(app, other);
      expect(ids((await get('/feed/favorites').expect(200)).body)).toEqual([favPost.id]);
    });

    it('GET /explore и /reels: только видимые чужие; reels — только REEL', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const blocker = await createUser(app, { userName: 'blocker' });
      await prisma.block.create({ data: { blockerId: blocker.id, blockedId: me.id } });
      const photo = await createPost(app, bob);
      const reel = await createPost(app, bob, { type: 'REEL' });
      await createPost(app, priv);
      await createPost(app, blocker);
      await createPost(app, me);

      const explore = ids((await get('/explore').expect(200)).body);
      expect(explore.sort()).toEqual([photo.id, reel.id].sort());
      expect(ids((await get('/reels').expect(200)).body)).toEqual([reel.id]);
    });

    it('сетки профиля: открытый — виден; закрытый -> 403; reels и отмеченные', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const photo = await createPost(app, bob);
      const reel = await createPost(app, bob, { type: 'REEL' });
      const tagged = await createPost(app, priv);
      await prisma.postUserTag.create({
        data: { postId: tagged.id, position: 0, taggedUserId: bob.id, x: 0.1, y: 0.1 },
      });
      await createPost(app, priv);

      expect(ids((await get(`/users/${bob.id}/posts`).expect(200)).body)).toEqual([photo.id]);
      expect(ids((await get(`/users/${bob.id}/reels`).expect(200)).body)).toEqual([reel.id]);
      const res = await get(`/users/${priv.id}/posts`).expect(403);
      expect(res.body.code).toBe('PRIVATE_ACCOUNT');
      // Отмеченный пост закрытого автора чужому не показываем.
      expect(ids((await get(`/users/${bob.id}/tagged`).expect(200)).body)).toEqual([]);
      await follow(me.id, priv.id);
      expect(ids((await get(`/users/${bob.id}/tagged`).expect(200)).body)).toEqual([tagged.id]);
    });

    it('выдача хэштега и места: только видимые; 404 для неизвестных', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const mediaA = await createReadyMedia(app, bob.id);
      const bobCookie = await loginAs(app, bob);
      const location = await prisma.location.create({
        data: { name: 'Park', slug: 'park-city', city: 'City', country: 'Land' },
      });
      const created = await send('post', '/posts', bobCookie)
        .send({
          type: 'POST',
          caption: '#Sun',
          locationId: location.id,
          items: [{ mediaId: mediaA }],
        })
        .expect(201);
      // Пост закрытого автора с тем же хэштегом и местом.
      const hidden = await createPost(app, priv, { locationId: location.id });
      const tag = await prisma.hashtag.findUniqueOrThrow({ where: { name: 'sun' } });
      await prisma.postHashtag.create({ data: { postId: hidden.id, hashtagId: tag.id } });

      for (const tab of ['TOP', 'RECENT']) {
        const byTag = await get(`/hashtags/sun/posts?tab=${tab}`).expect(200);
        expect(ids(byTag.body)).toEqual([(created.body as PostBody).id]);
        const byPlace = await get(`/locations/${location.id}/posts?tab=${tab}`).expect(200);
        expect(ids(byPlace.body)).toEqual([(created.body as PostBody).id]);
      }
      expect((await get('/hashtags/sun').expect(200)).body.postCount).toBe(2);
      await get('/hashtags/nothing/posts').expect(404);
      await get('/locations/00000000-0000-4000-8000-000000000000/posts').expect(404);
      await get('/hashtags/sun/posts?tab=BAD').expect(400);
    });
  });

  describe('лайки', () => {
    it('PUT/DELETE like: счётчик, идемпотентность, уведомление создаётся и удаляется', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const post = await createPost(app, bob);

      await send('put', `/posts/${post.id}/like`).expect(204);
      await send('put', `/posts/${post.id}/like`).expect(204);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'POST_LIKE',
          recipientId: bob.id,
          actorId: me.id,
          postId: post.id,
        }),
      );
      const liked = (await get(`/posts/${post.id}`).expect(200)).body as PostBody;
      expect(liked).toMatchObject({ likeCount: 1, isLikedByMe: true });

      await send('delete', `/posts/${post.id}/like`).expect(204);
      await send('delete', `/posts/${post.id}/like`).expect(204);
      expect(notifyRemove).toHaveBeenCalledTimes(1);
      expect(notifyRemove).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'POST_LIKE', recipientId: bob.id, postId: post.id }),
      );
      const unliked = (await get(`/posts/${post.id}`).expect(200)).body as PostBody;
      expect(unliked).toMatchObject({ likeCount: 0, isLikedByMe: false });
    });

    it('лайк закрытого поста без подписки -> 403; заблокированный -> 404; несуществующий -> 404', async () => {
      const priv = await createUser(app, { userName: 'secret', isPrivate: true });
      const bob = await createUser(app, { userName: 'bob' });
      const privPost = await createPost(app, priv);
      const bobPost = await createPost(app, bob);
      expect((await send('put', `/posts/${privPost.id}/like`).expect(403)).body.code).toBe(
        'PRIVATE_ACCOUNT',
      );
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: me.id } });
      await send('put', `/posts/${bobPost.id}/like`).expect(404);
      await send('put', '/posts/00000000-0000-4000-8000-000000000000/like').expect(404);
      expect(await prisma.postLike.count()).toBe(0);
    });

    it('GET /posts/{id}/likes: список без заблокированных, followStatus, поиск', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const carol = await createUser(app, { userName: 'carol' });
      const dave = await createUser(app, { userName: 'dave' });
      const post = await createPost(app, bob);
      await follow(me.id, carol.id);
      for (const u of [carol, dave, bob]) {
        await prisma.postLike.create({ data: { userId: u.id, postId: post.id } });
      }
      await prisma.block.create({ data: { blockerId: me.id, blockedId: dave.id } });

      const res = await get(`/posts/${post.id}/likes`).expect(200);
      const items = res.body.items as { userName: string; followStatus: string }[];
      expect(items.map((i) => i.userName).sort()).toEqual(['bob', 'carol']);
      expect(items.find((i) => i.userName === 'carol')?.followStatus).toBe('FOLLOWING');
      expect(items.find((i) => i.userName === 'bob')?.followStatus).toBe('NONE');
      const found = await get(`/posts/${post.id}/likes?q=car`).expect(200);
      expect(found.body.items).toHaveLength(1);
    });
  });

  describe('воспроизведения', () => {
    it('POST /posts/{id}/plays: повтор в течение часа не увеличивает счётчик', async () => {
      const bob = await createUser(app, { userName: 'bob' });
      const reel = await createPost(app, bob, { type: 'REEL' });
      await send('post', `/posts/${reel.id}/plays`).expect(204);
      await send('post', `/posts/${reel.id}/plays`).expect(204);
      expect((await prisma.post.findUniqueOrThrow({ where: { id: reel.id } })).playCount).toBe(1);
      await send('post', '/posts/00000000-0000-4000-8000-000000000000/plays').expect(404);
    });
  });
});
