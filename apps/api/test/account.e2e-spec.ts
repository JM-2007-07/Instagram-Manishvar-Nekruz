import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

describe('Account: деактивация и удаление', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: TestUser;
  let other: TestUser;
  let cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    alice = await createUser(app, { userName: 'alice' });
    other = await createUser(app, { userName: 'other' });
    cookie = await loginAs(app, alice);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = () =>
    http()
      .post('/api/v1/auth/login')
      .set(withOrigin())
      .send({ login: 'alice', password: alice.password });

  it('деактивация: неверный пароль 400, верный 204, сессии закрыты, профиль скрыт, вход восстанавливает', async () => {
    await http()
      .post('/api/v1/me/deactivate')
      .set(withOrigin())
      .set('Cookie', cookie)
      .send({ password: 'wrong-password' })
      .expect(400);

    await http()
      .post('/api/v1/me/deactivate')
      .set(withOrigin())
      .set('Cookie', cookie)
      .send({ password: alice.password })
      .expect(204);

    expect(await prisma.session.count({ where: { userId: alice.id } })).toBe(0);
    await http().get('/api/v1/me').set('Cookie', cookie).expect(401);
    const otherCookie = await loginAs(app, other);
    await http().get(`/api/v1/users/${alice.id}`).set('Cookie', otherCookie).expect(404);

    await login().expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(user.status).toBe('ACTIVE');
  });

  it('удаление: 202 с датой через 30 дней, сессии закрыты, вход отменяет удаление', async () => {
    const res = await http()
      .delete('/api/v1/me')
      .set(withOrigin())
      .set('Cookie', cookie)
      .send({ password: alice.password })
      .expect(202);
    const at = new Date((res.body as { deletionScheduledAt: string }).deletionScheduledAt);
    const days = (at.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);

    const pending = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(pending.status).toBe('PENDING_DELETION');
    expect(await prisma.session.count({ where: { userId: alice.id } })).toBe(0);
    const otherCookie = await loginAs(app, other);
    await http().get(`/api/v1/users/${alice.id}`).set('Cookie', otherCookie).expect(404);

    await login().expect(200);
    const restored = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(restored.status).toBe('ACTIVE');
    expect(restored.deletionScheduledAt).toBeNull();
  });

  it('удаление без пароля у аккаунта с паролем — 400; без сессии — 401', async () => {
    await http().delete('/api/v1/me').set(withOrigin()).set('Cookie', cookie).send({}).expect(400);
    await http().delete('/api/v1/me').set(withOrigin()).send({ password: 'x' }).expect(401);
  });
});
