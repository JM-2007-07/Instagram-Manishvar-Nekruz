import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';
import { createPost } from './helpers/posts';

describe('Admin: жалобы и модерация', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let author: { id: string };
  let authorCookie: string;
  let reporter: { id: string };
  let reporterCookie: string;
  let admin: { id: string };
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    author = await createUser(app);
    authorCookie = await loginAs(app, author);
    reporter = await createUser(app);
    reporterCookie = await loginAs(app, reporter);
    admin = await createUser(app, { role: 'ADMIN' });
    adminCookie = await loginAs(app, admin);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, cookie: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const send = (
    method: 'post' | 'patch' | 'put' | 'delete',
    path: string,
    cookie: string | null,
  ) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`).set(withOrigin());
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const report = (cookie: string, targetType: string, targetId: string) =>
    send('post', '/reports', cookie).send({ targetType, targetId, reason: 'SPAM' });

  it('жалоба на пост: 201, повтор возвращает ту же жалобу', async () => {
    const post = await createPost(app, author);
    const first = await report(reporterCookie, 'POST', post.id).expect(201);
    const second = await report(reporterCookie, 'POST', post.id).expect(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await prisma.report.count()).toBe(1);
  });

  it('жалоба: на свой пост и на себя -> 400, на несуществующий -> 404', async () => {
    const post = await createPost(app, author);
    await report(authorCookie, 'POST', post.id).expect(400);
    await report(reporterCookie, 'USER', reporter.id).expect(400);
    await report(reporterCookie, 'POST', '00000000-0000-4000-8000-000000000000').expect(404);
    await report(reporterCookie, 'USER', author.id).expect(201);
  });

  it('жалоба: без сессии -> 401, без Origin -> 403', async () => {
    const post = await createPost(app, author);
    await send('post', '/reports', null)
      .send({ targetType: 'POST', targetId: post.id, reason: 'SPAM' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/reports')
      .set('Cookie', reporterCookie)
      .send({ targetType: 'POST', targetId: post.id, reason: 'SPAM' })
      .expect(403);
  });

  it('список: ADMIN видит жалобы с предпросмотром, USER -> 403, без сессии -> 401', async () => {
    const post = await createPost(app, author, { caption: 'buy now' });
    await report(reporterCookie, 'POST', post.id).expect(201);

    await get('/admin/reports', reporterCookie).expect(403);
    await get('/admin/reports', null).expect(401);
    const list = await get('/admin/reports?status=OPEN&targetType=POST', adminCookie).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].target).toEqual({
      exists: true,
      ownerId: author.id,
      preview: 'buy now',
    });
    expect(list.body.nextCursor).toBeNull();
    await get('/admin/reports?status=RESOLVED', adminCookie).expect(200).expect((r) => {
      expect(r.body.items).toHaveLength(0);
    });
  });

  it('отклонение: статус REJECTED, действие запрещено; USER -> 403', async () => {
    const post = await createPost(app, author);
    const { body } = await report(reporterCookie, 'POST', post.id).expect(201);

    await send('patch', `/admin/reports/${body.id}`, reporterCookie)
      .send({ status: 'REJECTED' })
      .expect(403);
    await send('patch', `/admin/reports/${body.id}`, adminCookie)
      .send({ status: 'REJECTED', action: 'REMOVE_CONTENT' })
      .expect(400);
    const done = await send('patch', `/admin/reports/${body.id}`, adminCookie)
      .send({ status: 'REJECTED' })
      .expect(200);
    expect(done.body.status).toBe('REJECTED');
    expect(done.body.resolvedById).toBe(admin.id);
    expect(await prisma.post.count()).toBe(1);
  });

  it('решение с REMOVE_CONTENT удаляет пост через жалобу', async () => {
    const post = await createPost(app, author);
    const { body } = await report(reporterCookie, 'POST', post.id).expect(201);

    const done = await send('patch', `/admin/reports/${body.id}`, adminCookie)
      .send({ status: 'RESOLVED', action: 'REMOVE_CONTENT' })
      .expect(200);
    expect(done.body.status).toBe('RESOLVED');
    expect(done.body.target.exists).toBe(false);
    expect(await prisma.post.count()).toBe(0);
    await send('patch', '/admin/reports/00000000-0000-4000-8000-000000000000', adminCookie)
      .send({ status: 'RESOLVED' })
      .expect(404);
  });

  it('BAN_USER блокирует автора и завершает его сессии', async () => {
    const post = await createPost(app, author);
    const { body } = await report(reporterCookie, 'POST', post.id).expect(201);
    await send('patch', `/admin/reports/${body.id}`, adminCookie)
      .send({ status: 'RESOLVED', action: 'BAN_USER' })
      .expect(200);

    const row = await prisma.user.findUnique({ where: { id: author.id } });
    expect(row?.status).toBe('BANNED');
    expect(await prisma.session.count({ where: { userId: author.id } })).toBe(0);
    await get('/me', authorCookie).expect(401);

    await send('delete', `/admin/users/${author.id}/ban`, adminCookie).expect(204);
    expect((await prisma.user.findUnique({ where: { id: author.id } }))?.status).toBe('ACTIVE');
  });

  it('галочка: PUT/DELETE verified только для ADMIN', async () => {
    await send('put', `/admin/users/${author.id}/verified`, reporterCookie).expect(403);
    await send('put', `/admin/users/${author.id}/verified`, adminCookie).expect(204);
    expect((await prisma.user.findUnique({ where: { id: author.id } }))?.isVerified).toBe(true);
    await send('delete', `/admin/users/${author.id}/verified`, adminCookie).expect(204);
    expect((await prisma.user.findUnique({ where: { id: author.id } }))?.isVerified).toBe(false);
  });

  it('#50: ADMIN удаляет пользователя вместе с постами; USER -> 403; себя и админа нельзя', async () => {
    await createPost(app, author);
    await send('delete', `/admin/users/${author.id}`, reporterCookie).expect(403);
    await send('delete', `/admin/users/${admin.id}`, adminCookie).expect(400);
    await send('delete', `/admin/users/${author.id}`, adminCookie).expect(204);

    expect(await prisma.user.findUnique({ where: { id: author.id } })).toBeNull();
    expect(await prisma.post.count()).toBe(0);
    await send('delete', `/admin/users/${author.id}`, adminCookie).expect(404);
  });
});
