import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { MediaService } from '@/media/media.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

interface MediaItemBody {
  id: string;
  kind: string;
  status: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const ffmpegAvailable = ((): boolean => {
  try {
    execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('Media: загрузка, обработка, раздача, привязка', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let media: MediaService;
  let storageDir: string;
  let alice: TestUser;
  let bob: TestUser;
  let aliceCookie: string;
  let bobCookie: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'photogram-test-storage-'));
    // Значение из .env важнее process.env, заданного здесь, поэтому каталог передаём сервису напрямую.
    const testConfig = {
      get: (key: string) => (key === 'STORAGE_LOCAL_DIR' ? storageDir : undefined),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService)
      .useValue(new StorageService(testConfig as ConfigService))
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    media = app.get(MediaService);
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
    await rm(storageDir, { recursive: true, force: true });
  });

  async function png(width = 200, height = 100): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: '#ff0000' } })
      .png()
      .toBuffer();
  }

  function upload(cookie: string, file: Buffer, purpose: string, filename = 'photo.png') {
    return request(app.getHttpServer())
      .post('/api/v1/media')
      .set('Cookie', cookie)
      .set(withOrigin())
      .field('purpose', purpose)
      .attach('file', file, { filename, contentType: 'image/png' });
  }

  async function uploadImage(cookie: string, purpose = 'POST'): Promise<MediaItemBody> {
    const res = await upload(cookie, await png(), purpose).expect(201);
    return res.body as MediaItemBody;
  }

  describe('POST /media', () => {
    it('фото: сразу READY, MediaItem по контракту, файл в WebP не шире 1080', async () => {
      const big = await png(2000, 1000);
      const res = await upload(aliceCookie, big, 'POST').expect(201);
      const item = res.body as MediaItemBody;
      expect(item).toEqual({
        id: expect.any(String),
        kind: 'IMAGE',
        status: 'READY',
        url: `/api/v1/media/${item.id}`,
        thumbnailUrl: `/api/v1/media/${item.id}?variant=thumb`,
        width: 1080,
        height: 540,
        durationSec: null,
      });

      const file = await request(app.getHttpServer())
        .get(item.url)
        .set('Cookie', aliceCookie)
        .expect(200);
      expect(file.headers['content-type']).toBe('image/webp');
      expect(file.headers['cache-control']).toContain('private');
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      const meta = await sharp(file.body as Buffer).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1080);

      const thumb = await request(app.getHttpServer())
        .get(`${item.url}?variant=thumb`)
        .set('Cookie', aliceCookie)
        .expect(200);
      expect((await sharp(thumb.body as Buffer).metadata()).width).toBe(320);
    });

    it('удаляет EXIF из фото', async () => {
      const withExif = await sharp({
        create: { width: 100, height: 100, channels: 3, background: '#00ff00' },
      })
        .jpeg()
        .withExif({ IFD0: { Copyright: 'secret' } })
        .toBuffer();
      expect((await sharp(withExif).metadata()).exif).toBeDefined();

      const res = await upload(aliceCookie, withExif, 'POST', 'a.jpg').expect(201);
      const file = await request(app.getHttpServer())
        .get((res.body as MediaItemBody).url)
        .set('Cookie', aliceCookie)
        .expect(200);
      expect((await sharp(file.body as Buffer).metadata()).exif).toBeUndefined();
    });

    it('тип определяется по содержимому: текст с именем .png и SVG -> 415', async () => {
      await upload(aliceCookie, Buffer.from('this is not an image'), 'POST').expect(415);
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      await upload(aliceCookie, svg, 'POST', 'a.svg').expect(415);
      expect(await prisma.mediaFile.count()).toBe(0);
    });

    it('слишком большой файл для purpose -> 413', async () => {
      const tooBig = Buffer.concat([await png(), Buffer.alloc(11 * 1024 * 1024)]);
      const res = await upload(aliceCookie, tooBig, 'AVATAR').expect(413);
      expect((res.body as { code: string }).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('фото не подходит для голосового (VOICE) -> 415', async () => {
      await upload(aliceCookie, await png(), 'VOICE').expect(415);
    });

    it('неизвестный purpose или нет файла -> 400', async () => {
      await upload(aliceCookie, await png(), 'NOPE').expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/media')
        .set('Cookie', aliceCookie)
        .set(withOrigin())
        .field('purpose', 'POST')
        .expect(400);
    });

    it('без сессии -> 401, без Origin -> 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/media')
        .set(withOrigin())
        .field('purpose', 'POST')
        .attach('file', await png(), 'a.png')
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/media')
        .set('Cookie', aliceCookie)
        .field('purpose', 'POST')
        .attach('file', await png(), 'a.png')
        .expect(403);
    });
  });

  describe('статус, раздача, удаление', () => {
    it('статус видит только владелец', async () => {
      const item = await uploadImage(aliceCookie);
      const own = await request(app.getHttpServer())
        .get(`/api/v1/media/${item.id}/status`)
        .set('Cookie', aliceCookie)
        .expect(200);
      expect((own.body as MediaItemBody).status).toBe('READY');
      await request(app.getHttpServer())
        .get(`/api/v1/media/${item.id}/status`)
        .set('Cookie', bobCookie)
        .expect(404);
    });

    it('чужой непривязанный файл -> 404 на раздачу и на удаление', async () => {
      const item = await uploadImage(aliceCookie);
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(404);
      await request(app.getHttpServer())
        .delete(`/api/v1/media/${item.id}`)
        .set('Cookie', bobCookie)
        .set(withOrigin())
        .expect(404);
      expect(await prisma.mediaFile.count()).toBe(1);
    });

    it('неверный id -> 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/media/not-a-uuid')
        .set('Cookie', aliceCookie)
        .expect(400);
    });

    it('Range: 206 и Content-Range', async () => {
      const item = await uploadImage(aliceCookie);
      const res = await request(app.getHttpServer())
        .get(item.url)
        .set('Cookie', aliceCookie)
        .set('Range', 'bytes=0-9')
        .expect(206);
      expect(res.headers['content-range']).toMatch(/^bytes 0-9\/\d+$/);
      expect((res.body as Buffer).length).toBe(10);
      await request(app.getHttpServer())
        .get(item.url)
        .set('Cookie', aliceCookie)
        .set('Range', 'bytes=999999999-')
        .expect(416);
    });

    it('владелец удаляет непривязанный файл: запись и файл исчезают', async () => {
      const item = await uploadImage(aliceCookie);
      const row = await prisma.mediaFile.findUniqueOrThrow({ where: { id: item.id } });
      expect(existsSync(join(storageDir, row.storageKey))).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/media/${item.id}`)
        .set('Cookie', aliceCookie)
        .set(withOrigin())
        .expect(204);
      expect(await prisma.mediaFile.count()).toBe(0);
      expect(existsSync(join(storageDir, row.storageKey))).toBe(false);
      await request(app.getHttpServer()).get(item.url).set('Cookie', aliceCookie).expect(404);
    });

    it('привязанный файл удалить нельзя -> 409', async () => {
      const item = await uploadImage(aliceCookie);
      await media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] });
      await request(app.getHttpServer())
        .delete(`/api/v1/media/${item.id}`)
        .set('Cookie', aliceCookie)
        .set(withOrigin())
        .expect(409);
      expect(await prisma.mediaFile.count()).toBe(1);
    });
  });

  describe('доступ к привязанному файлу = доступ к объекту', () => {
    // Пост с этим файлом: доступ к файлу поста проверяется по самому посту.
    const linkPost = (mediaId: string, extra: { isArchived?: boolean } = {}) =>
      prisma.post.create({
        data: {
          authorId: alice.id,
          shortcode: randomUUID().slice(0, 11),
          ...extra,
          media: { create: [{ position: 0, mediaId }] },
        },
      });

    it('открытый аккаунт: файл поста виден другому пользователю', async () => {
      const item = await uploadImage(aliceCookie);
      await media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] });
      await linkPost(item.id);
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(200);
    });

    it('закрытый аккаунт: не подписчику 404, подписчику 200', async () => {
      await prisma.user.update({ where: { id: alice.id }, data: { isPrivate: true } });
      const item = await uploadImage(aliceCookie);
      await media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] });
      await linkPost(item.id);
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(404);

      await prisma.follow.create({
        data: { followerId: bob.id, followingId: alice.id, status: 'ACCEPTED' },
      });
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(200);
    });

    it('блокировка скрывает файл', async () => {
      const item = await uploadImage(aliceCookie);
      await media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] });
      await linkPost(item.id);
      await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(404);
    });

    it('архивный пост: файл другим 404', async () => {
      const item = await uploadImage(aliceCookie);
      await media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] });
      await linkPost(item.id, { isArchived: true });
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(404);
    });

    it('аватар виден всем вошедшим', async () => {
      await prisma.user.update({ where: { id: alice.id }, data: { isPrivate: true } });
      const item = await uploadImage(aliceCookie, 'AVATAR');
      await media.attach(alice.id, [item.id], { target: 'AVATAR', purposes: ['AVATAR'] });
      await request(app.getHttpServer()).get(item.url).set('Cookie', bobCookie).expect(200);
    });
  });

  describe('MediaService.attach', () => {
    it('привязывает один раз; повтор -> 409 MEDIA_ALREADY_USED', async () => {
      const item = await uploadImage(aliceCookie);
      await media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] });
      const row = await prisma.mediaFile.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.attachedTo).toBe('POST');
      expect(row.attachedAt).not.toBeNull();
      await expect(
        media.attach(alice.id, [item.id], { target: 'POST', purposes: ['POST'] }),
      ).rejects.toMatchObject({ response: { code: 'MEDIA_ALREADY_USED' } });
    });

    it('чужой файл, неверный purpose и дубликаты -> 400', async () => {
      const item = await uploadImage(aliceCookie, 'POST');
      await expect(
        media.attach(bob.id, [item.id], { target: 'POST', purposes: ['POST'] }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        media.attach(alice.id, [item.id], { target: 'STORY', purposes: ['STORY'] }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        media.attach(alice.id, [item.id, item.id], { target: 'POST', purposes: ['POST'] }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('файл не READY -> 409 MEDIA_NOT_READY; ошибка в транзакции откатывает привязку', async () => {
      const ready = await uploadImage(aliceCookie);
      const notReady = await prisma.mediaFile.create({
        data: {
          ownerId: alice.id,
          purpose: 'POST',
          kind: 'VIDEO',
          status: 'PROCESSING',
          storageKey: 'x.orig',
          mimeType: 'application/octet-stream',
          sizeBytes: 1,
        },
      });
      await expect(
        media.attach(alice.id, [notReady.id], { target: 'POST', purposes: ['POST'] }),
      ).rejects.toMatchObject({ response: { code: 'MEDIA_NOT_READY' } });

      await expect(
        prisma.$transaction(async (tx) => {
          await media.attach(alice.id, [ready.id], { target: 'POST', purposes: ['POST'], tx });
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      const row = await prisma.mediaFile.findUniqueOrThrow({ where: { id: ready.id } });
      expect(row.attachedTo).toBeNull();
    });

    it('toMediaItem возвращает формат контракта', async () => {
      const item = await uploadImage(aliceCookie);
      const row = await prisma.mediaFile.findUniqueOrThrow({ where: { id: item.id } });
      expect(media.toMediaItem(row)).toEqual(item);
    });
  });

  describe('очистка', () => {
    it('удаляет непривязанные файлы старше 24 часов, привязанные оставляет', async () => {
      const old = await uploadImage(aliceCookie);
      const attached = await uploadImage(aliceCookie);
      await media.attach(alice.id, [attached.id], { target: 'POST', purposes: ['POST'] });
      const longAgo = new Date(Date.now() - 25 * 3600_000);
      await prisma.mediaFile.updateMany({ data: { createdAt: longAgo } });

      expect(await media.cleanupUnattached()).toBe(1);
      expect(await prisma.mediaFile.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await prisma.mediaFile.findUnique({ where: { id: attached.id } })).not.toBeNull();
    });
  });

  (ffmpegAvailable ? describe : describe.skip)('видео и голосовые (нужен ffmpeg)', () => {
    let work: string;

    beforeAll(async () => {
      work = await mkdtemp(join(tmpdir(), 'photogram-test-av-'));
    });

    afterAll(async () => {
      await rm(work, { recursive: true, force: true });
    });

    async function waitReady(cookie: string, id: string): Promise<MediaItemBody> {
      for (let i = 0; i < 60; i++) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/media/${id}/status`)
          .set('Cookie', cookie)
          .expect(200);
        const body = res.body as MediaItemBody;
        if (body.status !== 'PROCESSING') return body;
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error('media processing timeout');
    }

    it('видео: PROCESSING -> READY, есть превью и длительность', async () => {
      const path = join(work, 'in.mp4');
      execFileSync(
        FFMPEG,
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=1:size=320x240:rate=10',
          '-pix_fmt',
          'yuv420p',
          path,
        ],
        { stdio: 'ignore' },
      );
      const res = await request(app.getHttpServer())
        .post('/api/v1/media')
        .set('Cookie', aliceCookie)
        .set(withOrigin())
        .field('purpose', 'REEL')
        .attach('file', await readFile(path), { filename: 'in.mp4', contentType: 'video/mp4' })
        .expect(201);
      const created = res.body as MediaItemBody;
      expect(created.kind).toBe('VIDEO');
      expect(created.status).toBe('PROCESSING');

      const done = await waitReady(aliceCookie, created.id);
      expect(done.status).toBe('READY');
      expect(done.width).toBe(320);
      expect(done.durationSec).toBeGreaterThan(0.5);
      expect(done.thumbnailUrl).not.toBeNull();

      const video = await request(app.getHttpServer())
        .get(done.url)
        .set('Cookie', aliceCookie)
        .set('Range', 'bytes=0-99')
        .expect(206);
      expect(video.headers['content-type']).toBe('video/mp4');
      const thumb = await request(app.getHttpServer())
        .get(`${done.url}?variant=thumb`)
        .set('Cookie', aliceCookie)
        .expect(200);
      expect(thumb.headers['content-type']).toBe('image/jpeg');
    });

    it('видео нельзя использовать как аватар -> 415', async () => {
      const path = join(work, 'in2.mp4');
      execFileSync(
        FFMPEG,
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=1:size=160x120:rate=10',
          '-pix_fmt',
          'yuv420p',
          path,
        ],
        { stdio: 'ignore' },
      );
      await request(app.getHttpServer())
        .post('/api/v1/media')
        .set('Cookie', aliceCookie)
        .set(withOrigin())
        .field('purpose', 'AVATAR')
        .attach('file', await readFile(path), { filename: 'in2.mp4', contentType: 'video/mp4' })
        .expect(415);
    });

    it('голосовое: AUDIO, READY после обработки', async () => {
      const path = join(work, 'voice.m4a');
      execFileSync(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:a', 'aac', path], {
        stdio: 'ignore',
      });
      const res = await request(app.getHttpServer())
        .post('/api/v1/media')
        .set('Cookie', aliceCookie)
        .set(withOrigin())
        .field('purpose', 'VOICE')
        .attach('file', await readFile(path), { filename: 'voice.m4a', contentType: 'audio/mp4' })
        .expect(201);
      const created = res.body as MediaItemBody;
      expect(created.kind).toBe('AUDIO');
      const done = await waitReady(aliceCookie, created.id);
      expect(done.status).toBe('READY');
      expect(done.thumbnailUrl).toBeNull();
    });
  });
});
