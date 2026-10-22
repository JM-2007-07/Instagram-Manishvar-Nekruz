import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { OAuthClient, type ExternalProfile } from '@/auth/oauth.client';
import { PrismaService } from '@/prisma/prisma.service';
import { createUser, loginAs, ORIGIN, resetDb, withOrigin } from './helpers';
import { resetThrottler } from './helpers/throttler';

// Живых запросов к Google и Facebook нет: клиент провайдеров подменён.
let nextProfile: ExternalProfile | null = null;
const fakeClient = (enabled: boolean) => ({
  isEnabled: () => enabled,
  redirectUri: (provider: string) => `${ORIGIN}/api/v1/auth/oauth/${provider}/callback`,
  authorizeUrl: (provider: string, state: string) =>
    `https://provider.test/${provider}?state=${state}`,
  fetchProfile: () => (nextProfile ? Promise.resolve(nextProfile) : Promise.reject(new Error('x'))),
});

async function makeApp(enabled: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OAuthClient)
    .useValue(fakeClient(enabled))
    .compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const line = raw?.find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0].slice(name.length + 1);
}

describe('OAuth (Google / Facebook)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await makeApp(true);
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    nextProfile = null;
  });
  afterAll(async () => {
    await app.close();
  });

  // Проходит /auth/oauth/google и возвращает cookie транзакции + state для callback.
  async function start(provider = 'google') {
    const res = await request(app.getHttpServer()).get(`/api/v1/auth/oauth/${provider}`);
    expect(res.status).toBe(302);
    const tx = cookieValue(res, 'oauth_tx');
    expect(tx).toBeDefined();
    return { tx: tx as string, state: (tx as string).split('.')[1] };
  }

  const callback = (tx: string, state: string, provider = 'google', extra = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/${provider}/callback?code=abc&state=${state}${extra}`)
      .set('Cookie', `oauth_tx=${tx}`);

  it('providers: включены оба', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/oauth/providers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ google: true, facebook: true });
  });

  it('неизвестный провайдер: 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/oauth/myspace');
    expect(res.status).toBe(404);
  });

  it('новый пользователь: callback -> complete -> сессия', async () => {
    nextProfile = {
      providerUserId: 'g-1',
      email: 'new@example.test',
      emailVerified: true,
      name: 'New Person',
    };
    const { tx, state } = await start();
    const res = await callback(tx, state);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/accounts/oauth/complete/`);
    const pending = cookieValue(res, 'oauth_pending') as string;
    expect(pending).toBeDefined();

    const done = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/complete')
      .set(withOrigin({ Cookie: `oauth_pending=${pending}` }))
      .send({ userName: 'New.Person', birthday: '2000-05-05' });
    expect(done.status).toBe(201);
    expect(done.body.userName).toBe('new.person');
    expect(cookieValue(done, 'sid')).toBeDefined();
    expect(JSON.stringify(done.body)).not.toContain('passwordHash');

    // Токен одноразовый.
    const again = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/complete')
      .set(withOrigin({ Cookie: `oauth_pending=${pending}` }))
      .send({ userName: 'other.name', birthday: '2000-05-05' });
    expect(again.status).toBe(400);

    // Повторный вход по связи — сразу сессия.
    const second = await start();
    const login = await callback(second.tx, second.state);
    expect(login.headers.location).toBe(`${ORIGIN}/`);
    expect(cookieValue(login, 'sid')).toBeDefined();
  });

  it('complete: занятое имя -> 409, возраст < 13 -> 400, без cookie -> 400', async () => {
    await createUser(app, { userName: 'taken.name' });
    nextProfile = {
      providerUserId: 'g-2',
      email: 'b@example.test',
      emailVerified: true,
      name: 'B',
    };
    const { tx, state } = await start();
    const pending = cookieValue(await callback(tx, state), 'oauth_pending') as string;
    const post = (body: object, cookie = `oauth_pending=${pending}`) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/oauth/complete')
        .set(withOrigin({ Cookie: cookie }))
        .send(body);
    expect((await post({ userName: 'taken.name', birthday: '2000-01-01' })).status).toBe(409);
    const young = new Date().getFullYear() - 5;
    expect((await post({ userName: 'free.name', birthday: `${young}-01-01` })).status).toBe(400);
    expect((await post({ userName: 'free.name', birthday: '2000-01-01' }, 'x=1')).status).toBe(400);
  });

  it('email подтверждён и совпал: связывает с существующим аккаунтом', async () => {
    const user = await createUser(app, { email: 'me@example.test' });
    nextProfile = {
      providerUserId: 'g-3',
      email: 'me@example.test',
      emailVerified: true,
      name: 'Me',
    };
    const { tx, state } = await start();
    const res = await callback(tx, state);
    expect(res.headers.location).toBe(`${ORIGIN}/`);
    const links = await prisma.oAuthAccount.findMany({ where: { userId: user.id } });
    expect(links).toHaveLength(1);
  });

  it('email не подтверждён провайдером: не связывает, редирект с ошибкой', async () => {
    await createUser(app, { email: 'me@example.test' });
    nextProfile = {
      providerUserId: 'g-4',
      email: 'me@example.test',
      emailVerified: false,
      name: 'Me',
    };
    const { tx, state } = await start();
    const res = await callback(tx, state);
    expect(res.headers.location).toBe(`${ORIGIN}/accounts/login/?error=oauth`);
    expect(await prisma.oAuthAccount.count()).toBe(0);
  });

  it('неверный state, ошибка провайдера или сбой обмена: редирект error=oauth', async () => {
    nextProfile = {
      providerUserId: 'g-5',
      email: 'c@example.test',
      emailVerified: true,
      name: 'C',
    };
    const { tx } = await start();
    const bad = await callback(tx, 'wrong');
    expect(bad.headers.location).toBe(`${ORIGIN}/accounts/login/?error=oauth`);
    expect(cookieValue(bad, 'sid')).toBeUndefined();

    const { tx: tx2, state: state2 } = await start();
    const denied = await callback(tx2, state2, 'google', '&error=access_denied');
    expect(denied.headers.location).toBe(`${ORIGIN}/accounts/login/?error=oauth`);

    nextProfile = null; // fetchProfile отклоняется
    const { tx: tx3, state: state3 } = await start();
    const failed = await callback(tx3, state3);
    expect(failed.headers.location).toBe(`${ORIGIN}/accounts/login/?error=oauth`);
  });

  describe('DELETE /me/oauth/:provider', () => {
    it('без сессии: 401', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/me/oauth/google')
        .set(withOrigin());
      expect(res.status).toBe(401);
    });

    it('есть пароль: отвязывает; повторно 404', async () => {
      const user = await createUser(app);
      await prisma.oAuthAccount.create({
        data: { provider: 'GOOGLE', providerUserId: 'g-9', userId: user.id },
      });
      const cookie = await loginAs(app, user);
      const del = () =>
        request(app.getHttpServer())
          .delete('/api/v1/me/oauth/google')
          .set(withOrigin({ Cookie: cookie }));
      expect((await del()).status).toBe(204);
      expect((await del()).status).toBe(404);
    });

    it('единственный способ входа: 409 LIMIT_REACHED', async () => {
      const user = await createUser(app);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
      await prisma.oAuthAccount.create({
        data: { provider: 'GOOGLE', providerUserId: 'g-10', userId: user.id },
      });
      const cookie = await loginAs(app, user);
      const res = await request(app.getHttpServer())
        .delete('/api/v1/me/oauth/google')
        .set(withOrigin({ Cookie: cookie }));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LIMIT_REACHED');
    });
  });
});

describe('OAuth без ключей', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await makeApp(false);
  });
  afterAll(async () => {
    await app.close();
  });

  it('providers -> false, старт и callback -> 404', async () => {
    const server = app.getHttpServer();
    const providers = await request(server).get('/api/v1/auth/oauth/providers');
    expect(providers.body).toEqual({ google: false, facebook: false });
    expect((await request(server).get('/api/v1/auth/oauth/google')).status).toBe(404);
    expect(
      (await request(server).get('/api/v1/auth/oauth/facebook/callback?code=a&state=b')).status,
    ).toBe(404);
  });
});
