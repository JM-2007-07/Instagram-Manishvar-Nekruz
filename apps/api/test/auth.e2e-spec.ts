import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { MailService } from '@/mail/mail.service';
import type { MailMessage } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, ORIGIN, resetDb, withOrigin } from './helpers';
import { resetThrottler } from './helpers/throttler';

const MINUTE = 60 * 1000;
const PASSWORD = 'Str0ng-pass-phrase';

describe('Auth', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inbox: MailMessage[];

  beforeAll(async () => {
    inbox = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: (m: MailMessage) => void inbox.push(m) })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    inbox.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const post = (path: string) => request(server()).post(`/api/v1${path}`).set(withOrigin());
  const get = (path: string) => request(server()).get(`/api/v1${path}`);

  function lastMail(to: string): MailMessage {
    const mail = [...inbox].reverse().find((m) => m.to.toLowerCase() === to.toLowerCase());
    if (!mail) throw new Error(`no mail sent to ${to}`);
    return mail;
  }
  const codeFor = (email: string) => /\b(\d{6})\b/.exec(lastMail(email).text)![1];
  const tokenFor = (email: string) => /token=([^\s&"]+)/.exec(lastMail(email).text)![1];
  const cookieOf = (res: request.Response) => [res.headers['set-cookie']].flat().join('\n');
  const sidOf = (res: request.Response) => /sid=([^;]+)/.exec(cookieOf(res))![1];

  const signup = (over: Record<string, unknown> = {}) => ({
    email: 'newbie@example.test',
    password: PASSWORD,
    fullName: 'New Bie',
    userName: 'newbie',
    birthday: '2000-01-01',
    ...over,
  });

  async function registerAndVerify(over: Record<string, unknown> = {}) {
    const body = signup(over);
    await post('/auth/register').send(body).expect(201);
    const res = await post('/auth/register/verify')
      .send({ email: body.email, code: codeFor(body.email as string) })
      .expect(200);
    return { body, res };
  }

  describe('GET /auth/username-availability', () => {
    it('свободное имя: available=true', async () => {
      const res = await get('/auth/username-availability?userName=free.name').expect(200);
      expect(res.body.available).toBe(true);
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it('занятое имя: available=false и до 3 свободных подсказок', async () => {
      await createUser(app, { userName: 'taken' });
      const res = await get('/auth/username-availability?userName=Taken').expect(200);
      expect(res.body.available).toBe(false);
      expect(res.body.suggestions.length).toBeGreaterThan(0);
      expect(res.body.suggestions.length).toBeLessThanOrEqual(3);
      for (const s of res.body.suggestions as string[]) {
        expect(s).not.toBe('taken');
        expect(await prisma.user.findUnique({ where: { userName: s } })).toBeNull();
      }
    });

    it('зарезервированное имя (сегмент маршрута): available=false', async () => {
      const res = await get('/auth/username-availability?userName=explore').expect(200);
      expect(res.body.available).toBe(false);
    });

    it('невалидное имя или пустой параметр: 400 с details', async () => {
      const bad = await get('/auth/username-availability?userName=bad..name').expect(400);
      expect(bad.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(bad.body.details)).toBe(true);
      await get('/auth/username-availability').expect(400);
    });
  });

  describe('POST /auth/register и /register/verify', () => {
    it('регистрация шлёт письмо с кодом и не создаёт сессию', async () => {
      const res = await post('/auth/register').send(signup()).expect(201);
      expect(res.body.email).toBe('newbie@example.test');
      expect(res.body.codeSentAt).toBeTruthy();
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(codeFor('newbie@example.test')).toMatch(/^\d{6}$/);
      expect(await prisma.session.count()).toBe(0);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('verify: 200 Me, cookie HttpOnly SameSite=Lax, пароль в БД хеширован', async () => {
      const { res } = await registerAndVerify();
      expect(res.body).toMatchObject({
        userName: 'newbie',
        email: 'newbie@example.test',
        emailVerified: true,
        hasPassword: true,
        role: 'USER',
      });
      expect(res.body.id).toBeTruthy();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      const cookie = cookieOf(res);
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const user = await prisma.user.findUniqueOrThrow({ where: { userName: 'newbie' } });
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash).not.toBe(PASSWORD);
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.emailVerifiedAt).not.toBeNull();
      // полученная cookie действительно открывает сессию
      await get('/auth/sessions')
        .set('Cookie', `sid=${sidOf(res)}`)
        .expect(200);
    });

    it('email и имя сохраняются в нижнем регистре', async () => {
      await post('/auth/register')
        .send(signup({ email: 'MiXed@Example.test', userName: 'MiXed' }))
        .expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'mixed@example.test' } });
      expect(user.userName).toBe('mixed');
    });

    it('повторная регистрация на подтверждённый email или имя: 409 CONFLICT', async () => {
      await createUser(app, { userName: 'busy', email: 'busy@example.test' });
      const byEmail = await post('/auth/register')
        .send(signup({ email: 'busy@example.test' }))
        .expect(409);
      expect(byEmail.body.code).toBe('CONFLICT');
      await post('/auth/register')
        .send(signup({ userName: 'busy' }))
        .expect(409);
    });

    it('повторная регистрация на неподтверждённый email: 201 и новый код', async () => {
      await post('/auth/register').send(signup()).expect(201);
      const first = codeFor('newbie@example.test');
      await post('/auth/register')
        .send(signup({ fullName: 'Second Try' }))
        .expect(201);
      expect(inbox).toHaveLength(2);
      const second = codeFor('newbie@example.test');
      expect(await prisma.user.count()).toBe(1);
      // новый код работает (даже если случайно совпал со старым)
      await post('/auth/register/verify')
        .send({ email: 'newbie@example.test', code: second })
        .expect(200);
      expect(first).toMatch(/^\d{6}$/);
    });

    it.each([
      [
        'возраст младше 13 лет',
        { birthday: new Date(Date.now() - 12 * 365 * 24 * 60 * MINUTE).toISOString().slice(0, 10) },
      ],
      ['пароль из 5 символов', { password: 'Ab1!x' }],
      ['пароль длиннее 128 символов', { password: 'a1'.repeat(65) }],
      ['пароль совпадает с именем', { userName: 'samename1', password: 'samename1' }],
      ['частый пароль', { password: '123456' }],
      ['некорректный email', { email: 'not-an-email' }],
      ['имя с двумя точками', { userName: 'a..b' }],
      ['имя с точкой в конце', { userName: 'abc.' }],
      ['имя длиннее 30', { userName: 'a'.repeat(31) }],
      ['fullName длиннее 64', { fullName: 'x'.repeat(65) }],
    ])('невалидный ввод (%s): 400 VALIDATION_ERROR', async (_name, over) => {
      const res = await post('/auth/register').send(signup(over)).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.length).toBeGreaterThan(0);
      expect(await prisma.user.count()).toBe(0);
      expect(inbox).toHaveLength(0);
    });

    it('зарезервированное имя при регистрации: 400, пользователь не создан', async () => {
      await post('/auth/register')
        .send(signup({ userName: 'explore' }))
        .expect(400);
      expect(await prisma.user.count()).toBe(0);
    });

    it('неверный код: 400 VERIFICATION_CODE_INVALID, сессии нет', async () => {
      await post('/auth/register').send(signup()).expect(201);
      const wrong = codeFor('newbie@example.test') === '000000' ? '111111' : '000000';
      const res = await post('/auth/register/verify')
        .send({ email: 'newbie@example.test', code: wrong })
        .expect(400);
      expect(res.body.code).toBe('VERIFICATION_CODE_INVALID');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('код не из 6 цифр: 400 VALIDATION_ERROR', async () => {
      const res = await post('/auth/register/verify')
        .send({ email: 'newbie@example.test', code: '12ab' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('просроченный код: 400 VERIFICATION_CODE_INVALID', async () => {
      await post('/auth/register').send(signup()).expect(201);
      const code = codeFor('newbie@example.test');
      await prisma.emailVerificationCode.updateMany({
        data: { expiresAt: new Date(Date.now() - MINUTE) },
      });
      const res = await post('/auth/register/verify')
        .send({ email: 'newbie@example.test', code })
        .expect(400);
      expect(res.body.code).toBe('VERIFICATION_CODE_INVALID');
    });

    it('5 неверных попыток блокируют код, даже верный', async () => {
      await post('/auth/register').send(signup()).expect(201);
      const code = codeFor('newbie@example.test');
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) {
        await post('/auth/register/verify')
          .send({ email: 'newbie@example.test', code: wrong })
          .expect(400);
      }
      const res = await post('/auth/register/verify')
        .send({ email: 'newbie@example.test', code })
        .expect((r) => expect([400, 429]).toContain(r.status));
      expect(res.headers['set-cookie']).toBeUndefined();
      const user = await prisma.user.findUniqueOrThrow({ where: { userName: 'newbie' } });
      expect(user.emailVerifiedAt).toBeNull();
    });

    it('код одноразовый: повторное использование — 400', async () => {
      const { body } = await registerAndVerify();
      const res = await post('/auth/register/verify')
        .send({ email: body.email, code: codeFor(body.email as string) })
        .expect(400);
      expect(res.body.code).toBe('VERIFICATION_CODE_INVALID');
    });

    it('resend-code: 202 и новое письмо; неизвестный email тоже 202 без письма', async () => {
      await post('/auth/register').send(signup()).expect(201);
      await post('/auth/register/resend-code').send({ email: 'newbie@example.test' }).expect(202);
      expect(inbox).toHaveLength(2);
      await post('/auth/register/resend-code').send({ email: 'ghost@example.test' }).expect(202);
      expect(inbox).toHaveLength(2);
      await post('/auth/register/verify')
        .send({ email: 'newbie@example.test', code: codeFor('newbie@example.test') })
        .expect(200);
    });
  });

  describe('POST /auth/login', () => {
    it.each([
      ['по имени', 'alice'],
      ['по имени в другом регистре', 'ALICE'],
      ['по email', 'alice@example.test'],
      ['по email в другом регистре', 'Alice@Example.TEST'],
    ])('вход %s: 200 Me и cookie', async (_n, login) => {
      const alice = await createUser(app, { userName: 'alice' });
      const res = await post('/auth/login').send({ login, password: alice.password }).expect(200);
      expect(res.body).toMatchObject({ id: alice.id, userName: 'alice', hasPassword: true });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      const cookie = cookieOf(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      await get('/auth/sessions')
        .set('Cookie', `sid=${sidOf(res)}`)
        .expect(200);
      const row = await prisma.session.findFirstOrThrow({ where: { userId: alice.id } });
      expect(row.tokenHash).not.toBe(sidOf(res));
    });

    it('неверный пароль и неизвестный логин: одинаковый 401 INVALID_CREDENTIALS', async () => {
      await createUser(app, { userName: 'alice' });
      const wrongPass = await post('/auth/login')
        .send({ login: 'alice', password: 'wrong-pass-1' })
        .expect(401);
      const unknown = await post('/auth/login')
        .send({ login: 'nobody', password: 'wrong-pass-1' })
        .expect(401);
      expect(wrongPass.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body.message).toBe(wrongPass.body.message);
      expect(wrongPass.headers['set-cookie']).toBeUndefined();
    });

    it('email не подтверждён: 403 EMAIL_NOT_VERIFIED', async () => {
      await post('/auth/register').send(signup()).expect(201);
      const res = await post('/auth/login')
        .send({ login: 'newbie', password: PASSWORD })
        .expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('BANNED: 403 FORBIDDEN без cookie', async () => {
      const banned = await createUser(app, { status: 'BANNED' });
      const res = await post('/auth/login')
        .send({ login: banned.userName, password: banned.password })
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('чужой Origin и отсутствие Origin: 403 CSRF_REJECTED', async () => {
      const alice = await createUser(app);
      const body = { login: alice.userName, password: alice.password };
      const foreign = await request(server())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .send(body)
        .expect(403);
      expect(foreign.body.code).toBe('CSRF_REJECTED');
      await request(server()).post('/api/v1/auth/login').send(body).expect(403);
    });

    it('пустые поля: 400 VALIDATION_ERROR', async () => {
      const res = await post('/auth/login').send({ login: '', password: '' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/logout', () => {
    it('204, cookie очищена, следующий запрос — 401', async () => {
      const alice = await createUser(app);
      const cookie = await loginAs(app, alice);
      const res = await post('/auth/logout').set('Cookie', cookie).expect(204);
      expect(cookieOf(res)).toMatch(/^sid=;/);
      expect(cookieOf(res)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
      await get('/auth/sessions').set('Cookie', cookie).expect(401);
      expect(await prisma.session.count({ where: { userId: alice.id } })).toBe(0);
    });

    it('без сессии: 401', async () => {
      await post('/auth/logout').expect(401);
    });
  });

  describe('сброс пароля', () => {
    it('forgot: 202 одинаково для существующего и несуществующего, письмо только первому', async () => {
      const alice = await createUser(app, { userName: 'alice' });
      const known = await post('/auth/password/forgot').send({ login: 'alice' }).expect(202);
      const unknown = await post('/auth/password/forgot').send({ login: 'nobody' }).expect(202);
      expect(known.body).toEqual(unknown.body);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].to).toBe(alice.email);
      expect(inbox[0].text).toContain('/accounts/password/reset/?token=');
    });

    it('forgot работает и по email', async () => {
      const alice = await createUser(app, { userName: 'alice' });
      await post('/auth/password/forgot').send({ login: alice.email }).expect(202);
      expect(inbox).toHaveLength(1);
    });

    it('reset: 204, новый пароль работает, старый нет, все сессии отозваны', async () => {
      const alice = await createUser(app, { userName: 'alice' });
      const cookie1 = await loginAs(app, alice);
      const cookie2 = await loginAs(app, alice);
      await post('/auth/password/forgot').send({ login: 'alice' }).expect(202);

      await post('/auth/password/reset')
        .send({ token: tokenFor(alice.email), newPassword: 'Brand-new-pass-9' })
        .expect(204);

      await get('/auth/sessions').set('Cookie', cookie1).expect(401);
      await get('/auth/sessions').set('Cookie', cookie2).expect(401);
      await post('/auth/login').send({ login: 'alice', password: alice.password }).expect(401);
      await post('/auth/login').send({ login: 'alice', password: 'Brand-new-pass-9' }).expect(200);
    });

    it('токен одноразовый', async () => {
      const alice = await createUser(app);
      await post('/auth/password/forgot').send({ login: alice.userName }).expect(202);
      const token = tokenFor(alice.email);
      await post('/auth/password/reset')
        .send({ token, newPassword: 'Brand-new-pass-9' })
        .expect(204);
      await post('/auth/password/reset')
        .send({ token, newPassword: 'Another-pass-77' })
        .expect(400);
    });

    it('просроченный токен: 400, пароль не изменён', async () => {
      const alice = await createUser(app);
      await post('/auth/password/forgot').send({ login: alice.userName }).expect(202);
      const token = tokenFor(alice.email);
      await prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - MINUTE) },
      });
      await post('/auth/password/reset')
        .send({ token, newPassword: 'Brand-new-pass-9' })
        .expect(400);
      await post('/auth/login')
        .send({ login: alice.userName, password: alice.password })
        .expect(200);
    });

    it('случайный токен и слабый новый пароль: 400', async () => {
      await post('/auth/password/reset')
        .send({ token: 'a'.repeat(43), newPassword: 'Brand-new-pass-9' })
        .expect(400);
      const alice = await createUser(app);
      await post('/auth/password/forgot').send({ login: alice.userName }).expect(202);
      const res = await post('/auth/password/reset')
        .send({ token: tokenFor(alice.email), newPassword: '12345' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/password/change', () => {
    it('204: остальные сессии отозваны, текущая жива, пароль сменён', async () => {
      const alice = await createUser(app);
      const current = await loginAs(app, alice);
      const other = await loginAs(app, alice);
      await post('/auth/password/change')
        .set('Cookie', current)
        .send({ currentPassword: alice.password, newPassword: 'Brand-new-pass-9' })
        .expect(204);
      await get('/auth/sessions').set('Cookie', current).expect(200);
      await get('/auth/sessions').set('Cookie', other).expect(401);
      await post('/auth/login')
        .send({ login: alice.userName, password: 'Brand-new-pass-9' })
        .expect(200);
    });

    it('неверный currentPassword: 400, пароль и сессии не тронуты', async () => {
      const alice = await createUser(app);
      const current = await loginAs(app, alice);
      const other = await loginAs(app, alice);
      const res = await post('/auth/password/change')
        .set('Cookie', current)
        .send({ currentPassword: 'wrong-pass-1', newPassword: 'Brand-new-pass-9' })
        .expect(400);
      expect(res.body.code).toBeDefined();
      await get('/auth/sessions').set('Cookie', other).expect(200);
      await post('/auth/login')
        .send({ login: alice.userName, password: alice.password })
        .expect(200);
    });

    it('слабый новый пароль: 400 VALIDATION_ERROR', async () => {
      const alice = await createUser(app);
      const res = await post('/auth/password/change')
        .set('Cookie', await loginAs(app, alice))
        .send({ currentPassword: alice.password, newPassword: '12345' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('без сессии: 401', async () => {
      await post('/auth/password/change')
        .send({ currentPassword: 'x', newPassword: 'Brand-new-pass-9' })
        .expect(401);
    });
  });

  describe('сессии', () => {
    it('GET /auth/sessions: список своих, isCurrent только у текущей, чужих нет', async () => {
      const alice = await createUser(app);
      const bob = await createUser(app);
      const current = await loginAs(app, alice);
      await loginAs(app, alice);
      await loginAs(app, bob);
      const res = await get('/auth/sessions').set('Cookie', current).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.filter((s: { isCurrent: boolean }) => s.isCurrent)).toHaveLength(1);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          createdAt: expect.any(String),
          lastUsedAt: expect.any(String),
          isCurrent: expect.any(Boolean),
        }),
      );
      expect(JSON.stringify(res.body)).not.toContain('tokenHash');
    });

    it('без сессии: 401', async () => {
      await get('/auth/sessions').expect(401);
      await request(server())
        .delete('/api/v1/auth/sessions/00000000-0000-4000-8000-000000000000')
        .set('Origin', ORIGIN)
        .expect(401);
    });

    it('DELETE своей другой сессии: 204, она перестаёт работать', async () => {
      const alice = await createUser(app);
      const current = await loginAs(app, alice);
      const other = await loginAs(app, alice);
      const list = await get('/auth/sessions').set('Cookie', current).expect(200);
      const otherId = list.body.find((s: { isCurrent: boolean }) => !s.isCurrent).id;
      await request(server())
        .delete(`/api/v1/auth/sessions/${otherId}`)
        .set(withOrigin())
        .set('Cookie', current)
        .expect(204);
      await get('/auth/sessions').set('Cookie', other).expect(401);
      await get('/auth/sessions').set('Cookie', current).expect(200);
    });

    it('DELETE чужой сессии: 404, она остаётся жива', async () => {
      const alice = await createUser(app);
      const bob = await createUser(app);
      const bobCookie = await loginAs(app, bob);
      const bobSession = await prisma.session.findFirstOrThrow({ where: { userId: bob.id } });
      await request(server())
        .delete(`/api/v1/auth/sessions/${bobSession.id}`)
        .set(withOrigin())
        .set('Cookie', await loginAs(app, alice))
        .expect(404);
      await get('/auth/sessions').set('Cookie', bobCookie).expect(200);
    });

    it('DELETE с не-UUID id: 400', async () => {
      const alice = await createUser(app);
      await request(server())
        .delete('/api/v1/auth/sessions/not-a-uuid')
        .set(withOrigin())
        .set('Cookie', await loginAs(app, alice))
        .expect(400);
    });
  });

  describe('ограничение частоты', () => {
    it('6-я неудачная попытка входа за минуту: 429 RATE_LIMITED с Retry-After', async () => {
      await createUser(app, { userName: 'alice' });
      for (let i = 0; i < 5; i++) {
        await post('/auth/login').send({ login: 'alice', password: 'wrong-pass-1' }).expect(401);
      }
      const res = await post('/auth/login')
        .send({ login: 'alice', password: 'wrong-pass-1' })
        .expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
