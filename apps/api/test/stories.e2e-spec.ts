import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StoriesModule } from '@/stories/stories.module';
import { StoriesService } from '@/stories/stories.service';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { createPost } from './helpers/posts';
import { createStory, createStoryMedia } from './helpers/stories';
import { resetThrottler } from './helpers/throttler';

interface StoryBody {
  id: string;
  author: { id: string };
  media: { id: string } | null;
  sharedPost: { id: string } | null;
  audience: string;
  stickers: { id: string; type: string; myResponse: unknown }[];
  isViewedByMe: boolean;
  isLikedByMe: boolean;
  viewerCount: number | null;
  likeCount: number | null;
  expiresAt: string;
}

interface TrayBody {
  author: { id: string; hasActiveStory: boolean };
  storyIds: string[];
  hasUnseen: boolean;
  isCloseFriends: boolean;
}

describe('Stories: истории, ответы, актуальное', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notify: jest.SpyInstance;
  let alice: TestUser; // автор
  let bob: TestUser; // подписчик
  let aliceCookie: string;
  let bobCookie: string;

  beforeAll(async () => {
    // StoriesModule указан явно, чтобы тест работал и до регистрации модуля в app.module.ts (дубль Nest схлопывает).
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, StoriesModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    notify = jest.spyOn(app.get(NotificationsService), 'create');
    alice = await createUser(app, { userName: 'alice' });
    bob = await createUser(app, { userName: 'bob' });
    aliceCookie = await loginAs(app, alice);
    bobCookie = await loginAs(app, bob);
    await follow(bob.id, alice.id);
  });

  afterEach(() => notify.mockRestore());

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, c: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (method: 'patch' | 'put' | 'post' | 'delete', path: string, c: string | null) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const follow = (followerId: string, followingId: string) =>
    prisma.follow.create({
      data: { followerId, followingId, status: 'ACCEPTED', acceptedAt: new Date() },
    });
  const tray = async (c: string) => (await get('/stories/tray', c).expect(200)).body as TrayBody[];

  describe('защита маршрутов', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    it.each([
      ['get', '/stories/tray'],
      ['get', `/stories/${id}`],
      ['get', `/users/${id}/stories`],
      ['get', '/me/archive/stories'],
      ['put', `/stories/${id}/view`],
      ['delete', `/stories/${id}`],
      ['get', `/users/${id}/highlights`],
    ] as const)('%s %s без сессии -> 401', async (method, path) => {
      const res =
        method === 'get'
          ? await get(path, null).expect(401)
          : await send(method, path, null).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('POST /stories без Origin -> 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/stories')
        .set('Cookie', aliceCookie)
        .send({})
        .expect(403);
    });
  });

  describe('создание и удаление', () => {
    it('создаёт историю из медиа: привязывает файл, срок 24 часа, DTO по контракту', async () => {
      const mediaId = await createStoryMedia(app, alice.id);
      const res = await send('post', '/stories', aliceCookie).send({ mediaId }).expect(201);
      const story = res.body as StoryBody;
      expect(story).toMatchObject({
        audience: 'EVERYONE',
        isLikedByMe: false,
        viewerCount: 0,
        likeCount: 0,
        sharedPost: null,
      });
      expect(story.author.id).toBe(alice.id);
      expect(story.media?.id).toBe(mediaId);
      const ttl = new Date(story.expiresAt).getTime() - Date.now();
      expect(ttl).toBeGreaterThan(23.9 * 3600_000);
      expect(ttl).toBeLessThanOrEqual(24 * 3600_000);
      const file = await prisma.mediaFile.findUniqueOrThrow({ where: { id: mediaId } });
      expect(file.attachedTo).toBe('STORY');
    });

    it('400: нужен ровно один из mediaId / sharedPostId; чужой файл; не тот purpose', async () => {
      await send('post', '/stories', aliceCookie).send({}).expect(400);
      const mediaId = await createStoryMedia(app, alice.id);
      const post = await createPost(app, alice);
      await send('post', '/stories', aliceCookie)
        .send({ mediaId, sharedPostId: post.id })
        .expect(400);
      await send('post', '/stories', bobCookie).send({ mediaId }).expect(400);
    });

    it('409 MEDIA_NOT_READY для файла в обработке', async () => {
      const mediaId = await createStoryMedia(app, alice.id);
      await prisma.mediaFile.update({ where: { id: mediaId }, data: { status: 'PROCESSING' } });
      const res = await send('post', '/stories', aliceCookie).send({ mediaId }).expect(409);
      expect(res.body.code).toBe('MEDIA_NOT_READY');
    });

    it('делится публикацией: своей можно, чужой с запретом allowStoryResharing — 403', async () => {
      const own = await createPost(app, alice);
      const res = await send('post', '/stories', aliceCookie)
        .send({ sharedPostId: own.id })
        .expect(201);
      expect((res.body as StoryBody).sharedPost?.id).toBe(own.id);

      await send('post', '/stories', bobCookie).send({ sharedPostId: own.id }).expect(201);
      await prisma.userSettings.update({
        where: { userId: alice.id },
        data: { allowStoryResharing: false },
      });
      await send('post', '/stories', bobCookie).send({ sharedPostId: own.id }).expect(403);
    });

    it('удаляет автор: 204, файл удалён; чужой получает 404', async () => {
      const story = await createStory(app, alice);
      await send('delete', `/stories/${story.id}`, bobCookie).expect(404);
      await send('delete', `/stories/${story.id}`, aliceCookie).expect(204);
      expect(await prisma.story.count()).toBe(0);
      expect(await prisma.mediaFile.count({ where: { id: story.mediaId } })).toBe(0);
      await get(`/stories/${story.id}`, aliceCookie).expect(404);
    });

    it('упоминание в стикере отправляет уведомление MENTION_STORY после создания', async () => {
      const mediaId = await createStoryMedia(app, alice.id);
      const res = await send('post', '/stories', aliceCookie)
        .send({
          mediaId,
          stickers: [
            {
              type: 'MENTION',
              x: 0.5,
              y: 0.5,
              width: 0.3,
              height: 0.1,
              rotation: 0,
              data: { userId: bob.id },
            },
          ],
        })
        .expect(201);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: bob.id,
          actorId: alice.id,
          type: 'MENTION_STORY',
          storyId: (res.body as StoryBody).id,
        }),
      );
    });

    it('400: неверные данные стикера', async () => {
      const mediaId = await createStoryMedia(app, alice.id);
      await send('post', '/stories', aliceCookie)
        .send({
          mediaId,
          stickers: [
            {
              type: 'POLL',
              x: 0.5,
              y: 0.5,
              width: 0.3,
              height: 0.1,
              rotation: 0,
              data: { question: 'Q', options: ['only one'] },
            },
          ],
        })
        .expect(400);
    });
  });

  describe('лента кругов и видимость', () => {
    it('история автора в ленте подписчика; свой круг первым; у не подписанного — нет', async () => {
      const story = await createStory(app, alice);
      const carol = await createUser(app, { userName: 'carol' });
      const carolCookie = await loginAs(app, carol);
      await createStory(app, bob);

      const items = await tray(bobCookie);
      expect(items.map((i) => i.author.id)).toEqual([bob.id, alice.id]);
      expect(items[1]).toMatchObject({
        storyIds: [story.id],
        hasUnseen: true,
        isCloseFriends: false,
      });
      expect(items[1]?.author.hasActiveStory).toBe(true);

      expect(await tray(carolCookie)).toEqual([]);
      // Открытый аккаунт: прямой просмотр историй доступен и не подписанному.
      const direct = await get(`/users/${alice.id}/stories`, carolCookie).expect(200);
      expect(direct.body).toHaveLength(1);
    });

    it('закрытый аккаунт: не подписанному 403 PRIVATE_ACCOUNT', async () => {
      await prisma.user.update({ where: { id: alice.id }, data: { isPrivate: true } });
      const story = await createStory(app, alice);
      const carol = await createUser(app, { userName: 'carol' });
      const carolCookie = await loginAs(app, carol);
      const res = await get(`/users/${alice.id}/stories`, carolCookie).expect(403);
      expect(res.body.code).toBe('PRIVATE_ACCOUNT');
      await get(`/stories/${story.id}`, carolCookie).expect(403);
      await get(`/stories/${story.id}`, bobCookie).expect(200);
    });

    it('заблокированный не видит историю ни в ленте, ни напрямую', async () => {
      const story = await createStory(app, alice);
      await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
      expect(await tray(bobCookie)).toEqual([]);
      await get(`/stories/${story.id}`, bobCookie).expect(404);
      await get(`/users/${alice.id}/stories`, bobCookie).expect(404);
    });

    it('скрытые у зрителя (mute) не попадают в ленту, но доступны напрямую', async () => {
      const story = await createStory(app, alice);
      await prisma.mute.create({
        data: { ownerId: bob.id, targetId: alice.id, muteStories: true },
      });
      expect(await tray(bobCookie)).toEqual([]);
      await get(`/stories/${story.id}`, bobCookie).expect(200);
    });

    it('«скрыть историю от»: не в ленте и 404', async () => {
      const story = await createStory(app, alice);
      await prisma.storyHiddenFrom.create({ data: { ownerId: alice.id, viewerId: bob.id } });
      expect(await tray(bobCookie)).toEqual([]);
      await get(`/stories/${story.id}`, bobCookie).expect(404);
      expect((await get(`/users/${alice.id}/stories`, bobCookie).expect(200)).body).toEqual([]);
    });

    it('CLOSE_FRIENDS видят только близкие друзья (зелёное кольцо)', async () => {
      const story = await createStory(app, alice, { audience: 'CLOSE_FRIENDS' });
      expect(await tray(bobCookie)).toEqual([]);
      await get(`/stories/${story.id}`, bobCookie).expect(404);
      await get(`/stories/${story.id}`, aliceCookie).expect(200);

      await prisma.closeFriend.create({ data: { ownerId: alice.id, friendId: bob.id } });
      const items = await tray(bobCookie);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ isCloseFriends: true, storyIds: [story.id] });
      await get(`/stories/${story.id}`, bobCookie).expect(200);
    });

    it('истёкшая история: исчезает из ленты и для зрителей, автор видит её в архиве', async () => {
      const story = await createStory(app, alice);
      expect(await tray(bobCookie)).toHaveLength(1);
      await prisma.story.update({
        where: { id: story.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await tray(bobCookie)).toEqual([]);
      await get(`/stories/${story.id}`, bobCookie).expect(404);
      expect((await get(`/users/${alice.id}/stories`, bobCookie).expect(200)).body).toEqual([]);
      // Автор: прямой просмотр и архив.
      await get(`/stories/${story.id}`, aliceCookie).expect(200);
      const archive = await get('/me/archive/stories', aliceCookie).expect(200);
      expect((archive.body as { items: StoryBody[] }).items.map((s) => s.id)).toEqual([story.id]);
    });

    it('hasActiveStory(viewerId, userIds) учитывает видимость', async () => {
      await createStory(app, alice, { audience: 'CLOSE_FRIENDS' });
      const carol = await createUser(app, { userName: 'carol' });
      await createStory(app, carol);
      const service = app.get(StoriesService);
      const forBob = await service.hasActiveStory(bob.id, [alice.id, carol.id]);
      expect(forBob.has(alice.id)).toBe(false);
      expect(forBob.get(carol.id)).toEqual({ hasActiveStory: true, isCloseFriendStory: false });
      await prisma.closeFriend.create({ data: { ownerId: alice.id, friendId: bob.id } });
      const again = await service.hasActiveStory(bob.id, [alice.id]);
      expect(again.get(alice.id)).toEqual({ hasActiveStory: true, isCloseFriendStory: true });
    });
  });

  describe('просмотры, зрители, лайки', () => {
    it('просмотр идемпотентен, hasUnseen гаснет, автор себя не записывает, зрителей видит только автор', async () => {
      const story = await createStory(app, alice);
      await send('put', `/stories/${story.id}/view`, bobCookie).expect(204);
      await send('put', `/stories/${story.id}/view`, bobCookie).expect(204);
      await send('put', `/stories/${story.id}/view`, aliceCookie).expect(204);
      expect(await prisma.storyView.count()).toBe(1);

      expect((await tray(bobCookie)).find((i) => i.author.id === alice.id)?.hasUnseen).toBe(false);
      const seen = (await get(`/stories/${story.id}`, bobCookie).expect(200)).body as StoryBody;
      expect(seen).toMatchObject({ isViewedByMe: true, viewerCount: null, likeCount: null });

      const viewers = await get(`/stories/${story.id}/viewers`, aliceCookie).expect(200);
      const body = viewers.body as { items: { id: string; liked: boolean }[]; nextCursor: null };
      expect(body.items.map((v) => v.id)).toEqual([bob.id]);
      expect(body.items[0]?.liked).toBe(false);
      await get(`/stories/${story.id}/viewers`, bobCookie).expect(404);

      const own = (await get(`/stories/${story.id}`, aliceCookie).expect(200)).body as StoryBody;
      expect(own.viewerCount).toBe(1);
    });

    it('лайк и снятие лайка: идемпотентны, автор видит счётчик и лайкнувшего среди зрителей', async () => {
      const story = await createStory(app, alice);
      await send('put', `/stories/${story.id}/view`, bobCookie).expect(204);
      await send('put', `/stories/${story.id}/like`, bobCookie).expect(204);
      await send('put', `/stories/${story.id}/like`, bobCookie).expect(204);
      expect(await prisma.storyLike.count()).toBe(1);

      const mine = (await get(`/stories/${story.id}`, bobCookie).expect(200)).body as StoryBody;
      expect(mine.isLikedByMe).toBe(true);
      const own = (await get(`/stories/${story.id}`, aliceCookie).expect(200)).body as StoryBody;
      expect(own.likeCount).toBe(1);
      const viewers = await get(`/stories/${story.id}/viewers`, aliceCookie).expect(200);
      expect((viewers.body as { items: { liked: boolean }[] }).items[0]?.liked).toBe(true);

      await send('delete', `/stories/${story.id}/like`, bobCookie).expect(204);
      expect(await prisma.storyLike.count()).toBe(0);
    });

    it('лайк чужой недоступной истории -> 404', async () => {
      const story = await createStory(app, alice, { audience: 'CLOSE_FRIENDS' });
      await send('put', `/stories/${story.id}/like`, bobCookie).expect(404);
      await send('put', `/stories/${story.id}/view`, bobCookie).expect(404);
    });
  });

  describe('ответы и реакции -> Direct (T2.B2)', () => {
    it('ответ создаёт сообщение STORY_REPLY в личном чате с автором', async () => {
      const story = await createStory(app, alice);
      const res = await send('post', `/stories/${story.id}/reply`, bobCookie)
        .send({ text: 'Круто!' })
        .expect(201);
      expect(res.body).toMatchObject({ type: 'STORY_REPLY', text: 'Круто!' });

      const message = await prisma.message.findFirstOrThrow({
        where: { storyId: story.id },
        include: { chat: { include: { participants: true } } },
      });
      expect(message.type).toBe('STORY_REPLY');
      expect(message.senderId).toBe(bob.id);
      expect(message.chat.type).toBe('DIRECT');
      expect(message.chat.participants.map((p) => p.userId).sort()).toEqual(
        [alice.id, bob.id].sort(),
      );
    });

    it('реакция-эмодзи создаёт STORY_REACTION и видна автору в списке зрителей', async () => {
      const story = await createStory(app, alice);
      await send('put', `/stories/${story.id}/view`, bobCookie).expect(204);
      const res = await send('post', `/stories/${story.id}/reactions`, bobCookie)
        .send({ emoji: '🔥' })
        .expect(201);
      expect(res.body).toMatchObject({ type: 'STORY_REACTION' });
      const viewers = await get(`/stories/${story.id}/viewers`, aliceCookie).expect(200);
      expect((viewers.body as { items: { reaction: string | null }[] }).items[0]?.reaction).toBe(
        '🔥',
      );
    });

    it('400 на пустой текст и на ответ на свою историю; 404 при блокировке', async () => {
      const story = await createStory(app, alice);
      await send('post', `/stories/${story.id}/reply`, bobCookie).send({ text: '' }).expect(400);
      await send('post', `/stories/${story.id}/reply`, aliceCookie)
        .send({ text: 'hi' })
        .expect(400);
      await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
      await send('post', `/stories/${story.id}/reply`, bobCookie).send({ text: 'hi' }).expect(404);
      expect(await prisma.message.count()).toBe(0);
    });
  });

  describe('интерактивные стикеры', () => {
    const poll = {
      type: 'POLL',
      x: 0.5,
      y: 0.5,
      width: 0.4,
      height: 0.2,
      rotation: 0,
      data: { question: 'Чай или кофе?', options: ['Чай', 'Кофе'] },
    };

    it('ответ на опрос сохраняется, автор видит итоги, зритель — нет', async () => {
      const mediaId = await createStoryMedia(app, alice.id);
      const created = (
        await send('post', '/stories', aliceCookie)
          .send({ mediaId, stickers: [poll] })
          .expect(201)
      ).body as StoryBody;
      const sticker = created.stickers[0];
      expect(sticker?.type).toBe('POLL');
      const base = `/stories/${created.id}/stickers/${sticker?.id}`;

      await send('put', `${base}/response`, bobCookie).send({ value: 1 }).expect(204);
      await send('put', `${base}/response`, bobCookie).send({ value: 5 }).expect(400);
      const mine = (await get(`/stories/${created.id}`, bobCookie).expect(200)).body as StoryBody;
      expect(mine.stickers[0]?.myResponse).toBe(1);

      const res = await get(`${base}/responses`, aliceCookie).expect(200);
      const page = res.body as {
        items: { user: { id: string }; value: unknown }[];
        total: number;
        summary: { counts: number[] };
      };
      expect(page.total).toBe(1);
      expect(page.items[0]).toMatchObject({ user: { id: bob.id }, value: 1 });
      expect(page.summary.counts).toEqual([0, 1]);
      await get(`${base}/responses`, bobCookie).expect(404);
      await send('put', `${base}/response`, aliceCookie).send({ value: 0 }).expect(400);
    });
  });

  describe('актуальное', () => {
    it('создаёт из своих (в том числе истёкших) историй; видно подписчику, состав и порядок меняются', async () => {
      const old = await createStory(app, alice, { expiresAt: new Date(Date.now() - 1000) });
      const fresh = await createStory(app, alice);

      const created = await send('post', '/highlights', aliceCookie)
        .send({ title: 'Лето', storyIds: [old.id, fresh.id] })
        .expect(201);
      const highlight = created.body as { id: string; title: string; storyCount: number };
      expect(highlight).toMatchObject({ title: 'Лето', storyCount: 2 });

      const list = await get(`/users/${alice.id}/highlights`, bobCookie).expect(200);
      expect((list.body as { id: string }[]).map((h) => h.id)).toEqual([highlight.id]);

      // Подписчик видит и истёкшую историю в актуальном.
      const full = await get(`/highlights/${highlight.id}`, bobCookie).expect(200);
      expect((full.body as { stories: StoryBody[] }).stories.map((s) => s.id)).toEqual([
        old.id,
        fresh.id,
      ]);

      await send('patch', `/highlights/${highlight.id}`, aliceCookie)
        .send({ title: 'Осень' })
        .expect(200);
      const reordered = await send('put', `/highlights/${highlight.id}/stories`, aliceCookie)
        .send({ storyIds: [fresh.id] })
        .expect(200);
      expect(reordered.body).toMatchObject({ title: 'Осень', storyCount: 1 });
      await send('patch', `/highlights/${highlight.id}`, bobCookie)
        .send({ title: 'x' })
        .expect(404);
    });

    it('400: чужая история; пустой/длинный заголовок', async () => {
      const bobStory = await createStory(app, bob);
      const mine = await createStory(app, alice);
      await send('post', '/highlights', aliceCookie)
        .send({ title: 'Чужое', storyIds: [bobStory.id] })
        .expect(400);
      await send('post', '/highlights', aliceCookie)
        .send({ title: '', storyIds: [mine.id] })
        .expect(400);
      await send('post', '/highlights', aliceCookie)
        .send({ title: 'x'.repeat(16), storyIds: [mine.id] })
        .expect(400);
    });

    it('закрытый аккаунт: не подписанному 403; удаление актуального оставляет историю в архиве', async () => {
      const story = await createStory(app, alice);
      const created = await send('post', '/highlights', aliceCookie)
        .send({ title: 'Лето', storyIds: [story.id] })
        .expect(201);
      const id = (created.body as { id: string }).id;

      await prisma.user.update({ where: { id: alice.id }, data: { isPrivate: true } });
      const carol = await createUser(app, { userName: 'carol' });
      const carolCookie = await loginAs(app, carol);
      await get(`/users/${alice.id}/highlights`, carolCookie).expect(403);
      await get(`/highlights/${id}`, carolCookie).expect(403);

      await send('delete', `/highlights/${id}`, bobCookie).expect(404);
      await send('delete', `/highlights/${id}`, aliceCookie).expect(204);
      await get(`/highlights/${id}`, aliceCookie).expect(404);
      const archive = await get('/me/archive/stories', aliceCookie).expect(200);
      expect((archive.body as { items: unknown[] }).items).toHaveLength(1);
    });
  });
});
