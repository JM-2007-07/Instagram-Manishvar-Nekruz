import 'reflect-metadata';
import { validateEnv } from './env';

const VALID_DB_URL = 'postgresql://u:p@localhost:5432/db';

describe('validateEnv', () => {
  it('без DATABASE_URL бросает ошибку с именем переменной', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('подставляет значения по умолчанию', () => {
    const env = validateEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
      SESSION_COOKIE_NAME: 'sid',
      MAIL_DRIVER: 'log',
    });
  });

  it('строковый PORT приводится к числу', () => {
    const env = validateEnv({ DATABASE_URL: VALID_DB_URL, PORT: '5000' });
    expect(env.PORT).toBe(5000);
  });

  it('убирает завершающий слэш у WEB_ORIGIN', () => {
    const env = validateEnv({ DATABASE_URL: VALID_DB_URL, WEB_ORIGIN: 'http://localhost:3000/' });
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it.each([
    ['NODE_ENV', 'staging'],
    ['PORT', '0'],
    ['MAIL_DRIVER', 'pigeon'],
  ])('неверное значение %s=%s -> ошибка', (key, value) => {
    expect(() => validateEnv({ DATABASE_URL: VALID_DB_URL, [key]: value })).toThrow(
      new RegExp(key),
    );
  });

  it('DATABASE_URL не postgres-URL -> ошибка без самого значения', () => {
    const secret = 'mysql://user:topsecret@host/db';
    expect(() => validateEnv({ DATABASE_URL: secret })).toThrow(/DATABASE_URL/);
    try {
      validateEnv({ DATABASE_URL: secret });
    } catch (e) {
      expect((e as Error).message).not.toContain('topsecret');
      expect((e as Error).message).not.toContain(secret);
    }
  });

  it('WEB_ORIGIN без протокола -> ошибка', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://u:p@h/db', WEB_ORIGIN: 'localhost:3000' }),
    ).toThrow(/WEB_ORIGIN/);
  });

  it('MAIL_DRIVER=log при NODE_ENV=production -> ошибка', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://u:p@h/db',
        NODE_ENV: 'production',
        MAIL_DRIVER: 'log',
      }),
    ).toThrow(/MAIL_DRIVER/);
  });

  it('в production имя cookie без __Host- -> ошибка', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID_DB_URL,
        NODE_ENV: 'production',
        MAIL_DRIVER: 'smtp',
        SESSION_COOKIE_NAME: 'sid',
      }),
    ).toThrow(/SESSION_COOKIE_NAME/);
  });

  it('idle-срок больше absolute -> ошибка', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: VALID_DB_URL,
        SESSION_IDLE_TTL_DAYS: '40',
        SESSION_ABSOLUTE_TTL_DAYS: '30',
      }),
    ).toThrow(/SESSION_IDLE_TTL_DAYS/);
  });
});
