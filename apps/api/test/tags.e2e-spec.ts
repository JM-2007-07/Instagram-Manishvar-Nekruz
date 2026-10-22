import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { PrismaService } from '@/prisma/prisma.service';
import { TagsService } from '@/tags/tags.service';
import { createUser, loginAs, resetDb } from './helpers';
import { resetThrottler } from './helpers/throttler';

describe('Tags: хэштеги', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    const me = await createUser(app, { userName: 'alice' });
    cookie = await loginAs(app, me);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, c: string | null = cookie) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };

  it('GET /hashtags/:name: существующий хэштег (регистр не важен)', async () => {
    await prisma.hashtag.create({ data: { name: 'закат' } });
    const res = await get(`/hashtags/${encodeURIComponent('ЗАКАТ')}`).expect(200);
    expect(res.body).toEqual({ name: 'закат', postCount: 0 });
  });

  it('GET /hashtags/:name: несуществующий -> 404', async () => {
    await get('/hashtags/nothing').expect(404);
  });

  it('GET /hashtags/:name: без сессии -> 401', async () => {
    await get('/hashtags/nothing', null).expect(401);
  });

  it('TagsService: upsertHashtags без дублей, searchHashtags по префиксу', async () => {
    const tags = app.get(TagsService);
    const first = await tags.upsertHashtags(['Sun', 'sunset', 'sun']);
    const second = await tags.upsertHashtags(['sun']);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect(first).toContain(second[0]);
    expect(await prisma.hashtag.count()).toBe(2);
    const found = await tags.searchHashtags('#SUN', 10);
    expect(found.map((h) => h.name)).toEqual(['sun', 'sunset']);
  });

  it('TagsService: resolveMentions возвращает только активных существующих', async () => {
    await createUser(app, { userName: 'bob' });
    await createUser(app, { userName: 'ghost', status: 'DEACTIVATED' });
    const found = await app.get(TagsService).resolveMentions(['bob', 'ghost', 'nobody']);
    expect(found.map((u) => u.userName)).toEqual(['bob']);
  });
});
