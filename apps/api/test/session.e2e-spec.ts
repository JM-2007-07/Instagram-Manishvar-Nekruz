import { createHash } from 'node:crypto';
import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/session/current-user.decorator';
import { SessionService } from '@/common/session/session.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, ORIGIN, resetDb } from './helpers';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Контроллер существует только в этом файле: проверяет SessionGuard и @CurrentUser без реальных модулей.
@Controller('test-session')
class TestSessionController {
  @Get('me')
  me(@CurrentUser() user: { id: string; role: string; sessionId: string }) {
    return user;
  }

  @Get('public')
  @Public()
  open() {
    return { open: true };
  }

  @Post('action')
  action() {
    return { done: true };
  }
}

describe('Сессии (SessionGuard, SessionService)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestSessionController],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    sessions = app.get(SessionService);
  });

  beforeEach(async () => {
    await resetDb(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const me = (token?: string) => {
    const req = request(server()).get('/api/v1/test-session/me');
    return token === undefined ? req : req.set('Cookie', `${sessions.cookie}=${token}`);
  };

  async function login() {
    const user = await createUser(app);
    const { token, sessionId } = await sessions.create(user.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
    return { user, token, sessionId };
  }

  describe('аутентификация', () => {
    it('без cookie: 401 UNAUTHENTICATED в формате ошибок', async () => {
      const res = await me().expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
      expect(typeof res.body.message).toBe('string');
      expect(res.body.requestId).toBeTruthy();
    });

    it('неизвестный токен: 401 UNAUTHENTICATED', async () => {
      const res = await me('definitely-not-a-real-token').expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
    });

    it('валидная cookie: @CurrentUser отдаёт id, role и sessionId', async () => {
      const { user, token, sessionId } = await login();
      const res = await me(token).expect(200);
      expect(res.body).toEqual({ id: user.id, role: user.role, sessionId: sessionId });
    });

    it('BANNED с живой сессией: 401 UNAUTHENTICATED', async () => {
      const banned = await createUser(app, { status: 'BANNED' });
      const cookie = await loginAs(app, banned);
      const res = await request(server())
        .get('/api/v1/test-session/me')
        .set('Cookie', cookie)
        .expect(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('порядок guard-ов: POST без Origin и без cookie — 403 CSRF_REJECTED, а не 401', async () => {
      const res = await request(server()).post('/api/v1/test-session/action').expect(403);
      expect(res.body).toMatchObject({ code: 'CSRF_REJECTED' });
    });

    it('POST с Origin, но без cookie — 401; с cookie — проходит', async () => {
      await request(server()).post('/api/v1/test-session/action').set('Origin', ORIGIN).expect(401);
      const user = await createUser(app);
      await request(server())
        .post('/api/v1/test-session/action')
        .set('Origin', ORIGIN)
        .set('Cookie', await loginAs(app, user))
        .expect(201);
    });

    it('@Public пропускает запрос без cookie', async () => {
      const res = await request(server()).get('/api/v1/test-session/public').expect(200);
      expect(res.body).toEqual({ open: true });
    });
  });

  describe('хранение токена', () => {
    it('в БД лежит sha256 токена, а не сам токен', async () => {
      const { token, sessionId } = await login();
      const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(row.tokenHash).not.toBe(token);
    });

    it('срок сессии по умолчанию: idle 7 дней, absolute 30 дней', async () => {
      const { sessionId } = await login();
      const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      const idle = row.expiresAt.getTime() - row.createdAt.getTime();
      const absolute = row.absoluteExpiresAt.getTime() - row.createdAt.getTime();
      expect(idle).toBeGreaterThan(6.9 * DAY);
      expect(idle).toBeLessThan(7.1 * DAY);
      expect(absolute).toBeGreaterThan(29.9 * DAY);
      expect(absolute).toBeLessThan(30.1 * DAY);
    });
  });

  describe('истечение', () => {
    it('истёк idle: 401, запись Session удалена', async () => {
      const { token, sessionId } = await login();
      await prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await me(token).expect(401);
      expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    });

    it('истёк absolute (idle ещё действует): 401, запись Session удалена', async () => {
      const { token, sessionId } = await login();
      await prisma.session.update({
        where: { id: sessionId },
        data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
      });
      await me(token).expect(401);
      expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    });
  });

  describe('продление', () => {
    it('lastUsedAt старше часа: expiresAt продлён и cookie обновлена (HttpOnly, SameSite=Lax)', async () => {
      const { token, sessionId } = await login();
      const oldExpires = new Date(Date.now() + 3 * DAY);
      await prisma.session.update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date(Date.now() - 2 * HOUR), expiresAt: oldExpires },
      });

      const res = await me(token).expect(200);

      const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      expect(row.expiresAt.getTime()).toBeGreaterThan(oldExpires.getTime() + DAY);
      expect(Date.now() - row.lastUsedAt.getTime()).toBeLessThan(HOUR);

      const cookie = [res.headers['set-cookie']].flat().join('\n');
      expect(cookie).toContain(`sid=${token}`);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Max-Age=\d+/i);
      expect(cookie).toMatch(/Path=\//i);
    });

    it('продление не выходит за absoluteExpiresAt', async () => {
      const { token, sessionId } = await login();
      const absolute = new Date(Date.now() + 2 * DAY);
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          lastUsedAt: new Date(Date.now() - 2 * HOUR),
          expiresAt: new Date(Date.now() + DAY),
          absoluteExpiresAt: absolute,
        },
      });
      await me(token).expect(200);
      const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(absolute.getTime());
    });

    it('lastUsedAt моложе часа: без Set-Cookie и без записи в БД', async () => {
      const { token, sessionId } = await login();
      const before = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      const res = await me(token).expect(200);
      const after = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(after.expiresAt).toEqual(before.expiresAt);
      expect(after.lastUsedAt).toEqual(before.lastUsedAt);
    });
  });

  describe('отзыв', () => {
    it('после revoke: 401, запись удалена', async () => {
      const { token, sessionId } = await login();
      await me(token).expect(200);
      await sessions.revoke(sessionId);
      await me(token).expect(401);
      expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    });

    it('revokeAllForUser с exceptSessionId оставляет текущую, другие отзывает', async () => {
      const { user, token: current, sessionId } = await login();
      const other = await sessions.create(user.id, { ipAddress: '127.0.0.1', userAgent: 'other' });
      const stranger = await login();

      await sessions.revokeAllForUser(user.id, sessionId);

      await me(current).expect(200);
      await me(other.token).expect(401);
      // сессия другого пользователя не затронута
      await me(stranger.token).expect(200);
    });

    it('revokeAllForUser без exceptSessionId отзывает все сессии пользователя', async () => {
      const { user, token } = await login();
      await sessions.revokeAllForUser(user.id);
      await me(token).expect(401);
    });
  });
});
