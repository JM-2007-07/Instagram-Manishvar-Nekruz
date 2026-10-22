import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { createComment } from './helpers/comments';
import { createPost } from './helpers/posts';
import { resetThrottler } from './helpers/throttler';

interface CommentBody {
  id: string;
  postId: string;
  parentId: string | null;
  text: string;
  likeCount: number;
  isLikedByMe: boolean;
  replyCount: number;
  isPinned: boolean;
  isPendingApproval: boolean;
  editedAt: string | null;
  author: { id: string };
}

interface PageBody {
  items: CommentBody[];
  nextCursor: string | null;
}

describe('Comments: комментарии, ответы, лайки', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notify: jest.SpyInstance;
  let notifyRemove: jest.SpyInstance;
  let alice: TestUser; // автор поста
  let bob: TestUser;
  let aliceCookie: string;
  let bobCookie: string;
  let postId: string;

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
    alice = await createUser(app, { userName: 'alice' });
    bob = await createUser(app, { userName: 'bob' });
    aliceCookie = await loginAs(app, alice);
    bobCookie = await loginAs(app, bob);
    postId = (await createPost(app, alice)).id;
  });

  afterEach(() => {
    notify.mockRestore();
    notifyRemove.mockRestore();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, c: string | null = bobCookie) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (
    method: 'patch' | 'put' | 'post' | 'delete',
    path: string,
    c: string | null = bobCookie,
  ) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const comment = (text: string, c = bobCookie, parentId?: string) =>
    send('post', `/posts/${postId}/comments`, c).send({ text, ...(parentId ? { parentId } : {}) });

  describe('защита маршрутов', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    it.each([
      ['get', `/posts/${id}/comments`],
      ['get', `/comments/${id}/replies`],
      ['get', `/comments/${id}/likes`],
    ])('%s %s без сессии — 401', async (_m, path) => {
      await get(path, null).expect(401);
    });

    it.each([
      ['post', `/posts/${id}/comments`],
      ['patch', `/comments/${id}`],
      ['delete', `/comments/${id}`],
      ['put', `/comments/${id}/like`],
      ['delete', `/comments/${id}/like`],
      ['put', `/comments/${id}/pin`],
      ['post', `/comments/${id}/approve`],
    ] as const)('%s %s без Origin — 403', async (method, path) => {
      await request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .set('Cookie', bobCookie)
        .expect(403);
    });
  });

  describe('создание и список', () => {
    it('создаёт комментарий, уведомляет автора поста, растёт commentCount', async () => {
      const res = await comment('  Nice shot  ').expect(201);
      const body = res.body as CommentBody;
      expect(body).toMatchObject({
        postId,
        parentId: null,
        text: 'Nice shot',
        likeCount: 0,
        isLikedByMe: false,
        replyCount: 0,
        isPinned: false,
        isPendingApproval: false,
        editedAt: null,
        author: { id: bob.id },
      });
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: alice.id,
          actorId: bob.id,
          type: 'COMMENT',
          postId,
          commentId: body.id,
        }),
      );
      const post = await get(`/posts/${postId}`).expect(200);
      expect((post.body as { commentCount: number }).commentCount).toBe(1);
      expect((post.body as { previewComments: CommentBody[] }).previewComments).toHaveLength(1);
    });

    it('пустой и слишком длинный текст — 400', async () => {
      await comment('   ').expect(400);
      await comment('x'.repeat(2201)).expect(400);
    });

    it('больше 5 упоминаний — 400', async () => {
      await comment('@a1 @a2 @a3 @a4 @a5 @a6').expect(400);
    });

    it('комментарий к несуществующему посту — 404', async () => {
      await send('post', '/posts/00000000-0000-4000-8000-000000000000/comments')
        .send({ text: 'hi' })
        .expect(404);
    });

    it('список: страницы NEWEST, закреплённый первым на первой странице', async () => {
      const base = Date.now() - 100_000;
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        const c = await createComment(app, postId, bob, {
          text: `c${i}`,
          createdAt: new Date(base + i * 1000),
        });
        ids.push(c.id);
      }
      await send('put', `/comments/${ids[0]}/pin`, aliceCookie).expect(204);

      const p1 = (await get(`/posts/${postId}/comments?sort=NEWEST&limit=2`).expect(200))
        .body as PageBody;
      expect(p1.items.map((c) => c.id)).toEqual([ids[0], ids[3], ids[2]]);
      expect(p1.items[0].isPinned).toBe(true);
      expect(p1.nextCursor).not.toBeNull();

      const p2 = (
        await get(
          `/posts/${postId}/comments?sort=NEWEST&limit=2&cursor=${p1.nextCursor as string}`,
        ).expect(200)
      ).body as PageBody;
      expect(p2.items.map((c) => c.id)).toEqual([ids[1]]);
      expect(p2.nextCursor).toBeNull();
    });

    it('сортировка TOP: сначала с большим числом лайков', async () => {
      const a = await createComment(app, postId, bob, { text: 'a' });
      const b = await createComment(app, postId, bob, { text: 'b' });
      await prisma.commentLike.create({ data: { userId: alice.id, commentId: a.id } });
      const res = (await get(`/posts/${postId}/comments?sort=TOP`).expect(200)).body as PageBody;
      expect(res.items.map((c) => c.id)).toEqual([a.id, b.id]);
      expect(res.items[0].likeCount).toBe(1);
    });
  });

  describe('ответы', () => {
    it('ответ уведомляет автора комментария и считается в replyCount', async () => {
      const parent = await createComment(app, postId, bob);
      const res = await comment('@bob thanks', aliceCookie, parent.id).expect(201);
      expect((res.body as CommentBody).parentId).toBe(parent.id);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: bob.id, type: 'COMMENT_REPLY' }),
      );

      const top = (await get(`/posts/${postId}/comments`).expect(200)).body as PageBody;
      expect(top.items).toHaveLength(1);
      expect(top.items[0].replyCount).toBe(1);
    });

    it('ответ на ответ — 400', async () => {
      const parent = await createComment(app, postId, bob);
      const reply = await createComment(app, postId, alice, { parentId: parent.id });
      await comment('nope', bobCookie, reply.id).expect(400);
    });

    it('список ответов от старых к новым, с пагинацией', async () => {
      const parent = await createComment(app, postId, bob);
      const base = Date.now() - 100_000;
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push(
          (
            await createComment(app, postId, alice, {
              parentId: parent.id,
              createdAt: new Date(base + i * 1000),
            })
          ).id,
        );
      }
      const p1 = (await get(`/comments/${parent.id}/replies?limit=2`).expect(200)).body as PageBody;
      expect(p1.items.map((c) => c.id)).toEqual([ids[0], ids[1]]);
      const p2 = (
        await get(
          `/comments/${parent.id}/replies?limit=2&cursor=${p1.nextCursor as string}`,
        ).expect(200)
      ).body as PageBody;
      expect(p2.items.map((c) => c.id)).toEqual([ids[2]]);
      expect(p2.nextCursor).toBeNull();
    });
  });

  describe('приватность и настройки', () => {
    it('закрытый аккаунт: не подписчик — 403, подписчик — 201', async () => {
      await prisma.user.update({ where: { id: alice.id }, data: { isPrivate: true } });
      await comment('hi').expect(403);
      await get(`/posts/${postId}/comments`).expect(403);
      await prisma.follow.create({
        data: {
          followerId: bob.id,
          followingId: alice.id,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      await comment('hi').expect(201);
    });

    it('блокировка — 404', async () => {
      await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
      await comment('hi').expect(404);
      await get(`/posts/${postId}/comments`).expect(404);
    });

    it('комментарии заблокированного не видны в списке', async () => {
      const carol = await createUser(app, { userName: 'carol' });
      await createComment(app, postId, carol, { text: 'from carol' });
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: carol.id } });
      const res = (await get(`/posts/${postId}/comments`).expect(200)).body as PageBody;
      expect(res.items).toHaveLength(0);
    });

    it('commentsDisabled — 403 на создание', async () => {
      await prisma.post.update({ where: { id: postId }, data: { commentsDisabled: true } });
      await comment('hi').expect(403);
    });

    it('commentsFrom = NO_ONE — 403, но автор поста комментирует', async () => {
      await prisma.userSettings.upsert({
        where: { userId: alice.id },
        create: { userId: alice.id, commentsFrom: 'NO_ONE' },
        update: { commentsFrom: 'NO_ONE' },
      });
      await comment('hi').expect(403);
      await comment('mine', aliceCookie).expect(201);
    });
  });

  describe('ограниченный пользователь', () => {
    it('комментарий виден только ему и автору поста; одобрение открывает его всем', async () => {
      await prisma.restrict.create({ data: { ownerId: alice.id, targetId: bob.id } });
      const res = await comment('pending').expect(201);
      const body = res.body as CommentBody;
      expect(body.isPendingApproval).toBe(true);
      expect(notify).not.toHaveBeenCalled();

      const carol = await createUser(app, { userName: 'carol' });
      const carolCookie = await loginAs(app, carol);

      const forCarol = (await get(`/posts/${postId}/comments`, carolCookie).expect(200))
        .body as PageBody;
      expect(forCarol.items).toHaveLength(0);
      const forAlice = (await get(`/posts/${postId}/comments`, aliceCookie).expect(200))
        .body as PageBody;
      expect(forAlice.items.map((c) => c.id)).toEqual([body.id]);
      const forBob = (await get(`/posts/${postId}/comments`).expect(200)).body as PageBody;
      expect(forBob.items).toHaveLength(1);

      await send('post', `/comments/${body.id}/approve`, carolCookie).expect(404);
      await send('post', `/comments/${body.id}/approve`, aliceCookie).expect(204);
      const after = (await get(`/posts/${postId}/comments`, carolCookie).expect(200))
        .body as PageBody;
      expect(after.items).toHaveLength(1);
      expect(after.items[0].isPendingApproval).toBe(false);
    });
  });

  describe('упоминания', () => {
    it('уведомляет упомянутого', async () => {
      await comment('hey @alice and @bob').expect(201);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: alice.id, type: 'COMMENT' }),
      );
      const mentions = await prisma.commentMention.findMany({ select: { userId: true } });
      expect(mentions.map((m) => m.userId)).toEqual([alice.id]); // на себя не упоминаем
    });
  });

  describe('правка', () => {
    it('автор правит в пределах окна, чужой — 403, после 15 минут — 409', async () => {
      const own = await createComment(app, postId, bob, { text: 'old' });
      const res = await send('patch', `/comments/${own.id}`).send({ text: 'new' }).expect(200);
      expect((res.body as CommentBody).text).toBe('new');
      expect((res.body as CommentBody).editedAt).not.toBeNull();

      await send('patch', `/comments/${own.id}`, aliceCookie).send({ text: 'x' }).expect(403);

      const old = await createComment(app, postId, bob, {
        createdAt: new Date(Date.now() - 16 * 60 * 1000),
      });
      const expired = await send('patch', `/comments/${old.id}`).send({ text: 'x' }).expect(409);
      expect((expired.body as { code: string }).code).toBe('EDIT_WINDOW_EXPIRED');
    });
  });

  describe('удаление', () => {
    it('автор комментария удаляет вместе с ответами и уведомлениями', async () => {
      const c = await createComment(app, postId, bob);
      const r = await createComment(app, postId, alice, { parentId: c.id });
      await prisma.notification.create({
        data: { recipientId: alice.id, actorId: bob.id, type: 'COMMENT', postId, commentId: c.id },
      });
      await send('delete', `/comments/${c.id}`).expect(204);
      expect(await prisma.comment.count({ where: { id: { in: [c.id, r.id] } } })).toBe(0);
      expect(await prisma.notification.count({ where: { commentId: c.id } })).toBe(0);
    });

    it('автор поста удаляет чужой комментарий', async () => {
      const c = await createComment(app, postId, bob);
      await send('delete', `/comments/${c.id}`, aliceCookie).expect(204);
    });

    it('посторонний — 403', async () => {
      const carol = await createUser(app, { userName: 'carol' });
      const carolCookie = await loginAs(app, carol);
      const c = await createComment(app, postId, bob);
      await send('delete', `/comments/${c.id}`, carolCookie).expect(403);
      expect(await prisma.comment.count({ where: { id: c.id } })).toBe(1);
    });

    it('несуществующий — 404', async () => {
      await send('delete', '/comments/00000000-0000-4000-8000-000000000000').expect(404);
    });
  });

  describe('лайки', () => {
    it('лайк идемпотентен, уведомляет автора, снятие удаляет уведомление', async () => {
      const c = await createComment(app, postId, alice);
      await send('put', `/comments/${c.id}/like`).expect(204);
      await send('put', `/comments/${c.id}/like`).expect(204);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: alice.id,
          actorId: bob.id,
          type: 'COMMENT_LIKE',
          commentId: c.id,
        }),
      );

      const list = (await get(`/posts/${postId}/comments`).expect(200)).body as PageBody;
      expect(list.items[0]).toMatchObject({ likeCount: 1, isLikedByMe: true });

      const likers = (await get(`/comments/${c.id}/likes`).expect(200)).body as {
        items: { id: string }[];
      };
      expect(likers.items.map((u) => u.id)).toEqual([bob.id]);

      await send('delete', `/comments/${c.id}/like`).expect(204);
      await send('delete', `/comments/${c.id}/like`).expect(204);
      expect(notifyRemove).toHaveBeenCalledTimes(1);
      expect(await prisma.commentLike.count()).toBe(0);
    });

    it('лайк чужого невидимого комментария — 404', async () => {
      const c = await createComment(app, postId, alice);
      await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
      await send('put', `/comments/${c.id}/like`).expect(404);
    });
  });

  describe('закрепление', () => {
    it('только автор поста; ответ — 400; больше 3 — 409', async () => {
      const c = await createComment(app, postId, bob);
      await send('put', `/comments/${c.id}/pin`).expect(403);

      const reply = await createComment(app, postId, alice, { parentId: c.id });
      await send('put', `/comments/${reply.id}/pin`, aliceCookie).expect(400);

      for (let i = 0; i < 3; i++) {
        const x = await createComment(app, postId, bob);
        await send('put', `/comments/${x.id}/pin`, aliceCookie).expect(204);
      }
      const over = await send('put', `/comments/${c.id}/pin`, aliceCookie).expect(409);
      expect((over.body as { code: string }).code).toBe('LIMIT_REACHED');

      await send('delete', `/comments/${c.id}/pin`, aliceCookie).expect(204);
    });
  });
});
