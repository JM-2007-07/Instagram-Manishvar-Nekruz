import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { totp } from '@/auth/two-factor.crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';
import type { TestUser } from './helpers';
import { resetThrottler } from './helpers/throttler';

describe('2FA (TOTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: TestUser;
  let cookie: string;

  beforeAll(async () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'test-key-test-key-test-key-test-key-1234';
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    resetThrottler(app);
    alice = await createUser(app, { userName: 'alice' });
    cookie = await loginAs(app, alice);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  });

  const http = () => request(app.getHttpServer());
  const post = (path: string, body: object = {}, c: string | null = cookie) => {
    const req = http().post(`/api/v1${path}`).set(withOrigin()).send(body);
    return c ? req.set('Cookie', c) : req;
  };
  const login = () => post('/auth/login', { login: 'alice', password: alice.password }, null);
  const second = (challengeId: string, code: string) =>
    post('/auth/login/2fa', { challengeId, code }, null);

  async function enable(): Promise<{ secret: string; backupCodes: string[] }> {
    const setup = await post('/auth/2fa/setup').expect(200);
    const { secret, otpauthUrl } = setup.body as { secret: string; otpauthUrl: string };
    expect(otpauthUrl).toContain('otpauth://totp/');
    const res = await post('/auth/2fa/enable', { code: totp(secret, Date.now()) }).expect(200);
    return { secret, backupCodes: (res.body as { backupCodes: string[] }).backupCodes };
  }

  it('enable с неверным кодом — 400; без setup — 400', async () => {
    await post('/auth/2fa/enable', { code: '123456' }).expect(400);
    await post('/auth/2fa/setup').expect(200);
    await post('/auth/2fa/enable', { code: '000000' }).expect(400);
  });

  it('секрет в БД зашифрован, резервные коды — хеши', async () => {
    const { secret, backupCodes } = await enable();
    const row = await prisma.twoFactorSecret.findUniqueOrThrow({ where: { userId: alice.id } });
    expect(row.secretEncrypted).not.toContain(secret);
    expect(row.backupCodeHashes).toHaveLength(backupCodes.length);
    expect(row.backupCodeHashes).not.toContain(backupCodes[0]);
    await post('/auth/2fa/setup').expect(409);
  });

  it('вход: пароль -> challenge без cookie; неверный код 400; верный — сессия; challenge одноразовый', async () => {
    const { secret } = await enable();
    const res = await login().expect(200);
    const body = res.body as { twoFactorRequired?: boolean; challengeId: string };
    expect(body.twoFactorRequired).toBe(true);
    expect(res.headers['set-cookie']).toBeUndefined();

    await second(body.challengeId, '000000').expect(400);
    const ok = await second(body.challengeId, totp(secret, Date.now())).expect(200);
    expect(ok.headers['set-cookie']).toBeDefined();
    await second(body.challengeId, totp(secret, Date.now())).expect(400);
  });

  it('резервный код работает один раз', async () => {
    const { backupCodes } = await enable();
    const first = (await login().expect(200)).body as { challengeId: string };
    await second(first.challengeId, backupCodes[0]!).expect(200);
    const again = (await login().expect(200)).body as { challengeId: string };
    await second(again.challengeId, backupCodes[0]!).expect(400);
  });

  it('после 5 неверных кодов challenge сгорает', async () => {
    const { secret } = await enable();
    const { challengeId } = (await login().expect(200)).body as { challengeId: string };
    for (let i = 0; i < 5; i++) await second(challengeId, '000000').expect(400);
    // Сбрасываем лимит запросов (5 за 15 минут), чтобы проверить именно сгоревший challenge, а не 429.
    resetThrottler(app);
    await second(challengeId, totp(secret, Date.now())).expect(400);
  });

  it('disable: неверный пароль 400; верный 204 и вход снова без кода', async () => {
    await enable();
    await post('/auth/2fa/disable', { password: 'wrong-password' }).expect(400);
    await post('/auth/2fa/disable', { password: alice.password }).expect(204);
    const res = await login().expect(200);
    expect((res.body as { twoFactorRequired?: boolean }).twoFactorRequired).toBeUndefined();
  });

  it('без сессии setup — 401', async () => {
    await post('/auth/2fa/setup', {}, null).expect(401);
  });
});

describe('2FA без ключа шифрования', () => {
  it('setup отвечает 409 TWO_FACTOR_UNAVAILABLE', async () => {
    const saved = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    const app = await createTestApp();
    try {
      await resetDb(app);
      const user = await createUser(app);
      const cookie = await loginAs(app, user);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/2fa/setup')
        .set(withOrigin())
        .set('Cookie', cookie)
        .expect(409);
      expect((res.body as { code: string }).code).toBe('TWO_FACTOR_UNAVAILABLE');
    } finally {
      await app.close();
      if (saved) process.env.TWO_FACTOR_ENCRYPTION_KEY = saved;
    }
  });
});
