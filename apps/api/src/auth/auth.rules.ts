import { BadRequestException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { validationError } from '@/common/validation';

// Сегменты, которые занимают маршруты веб-приложения (RENDERING_STRATEGY.md §2): такими не могут быть имена пользователей.
export const RESERVED_USER_NAMES = new Set([
  'explore',
  'reels',
  'direct',
  'accounts',
  'stories',
  'p',
  'reel',
  'archive',
  'admin',
  'api',
]);

// 1–30 символов: a–z, 0–9, «.», «_»; без двух точек подряд, не начинается и не заканчивается точкой.
export const USER_NAME_REGEX = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/;

// Небольшой список самых частых паролей (FEATURE: «не из списка частых»). Все в нижнем регистре.
const COMMON_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  '654321',
  '121212',
  '123123',
  '112233',
  'password',
  'password1',
  'password123',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'abc123',
  'abcdef',
  'iloveyou',
  'admin',
  'admin123',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'football',
  'login',
  'passw0rd',
  'qazwsx',
  '1q2w3e4r',
  'zaq12wsx',
  'йцукен',
  'пароль',
]);

export const MIN_AGE_YEARS = 13;
export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 15 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const UNVERIFIED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Пароль не из списка частых, не равен имени пользователя и email. Длину проверяет DTO.
export function assertPasswordAllowed(
  password: string,
  user: { userName: string; email: string },
  field = 'password',
): void {
  const value = password.toLowerCase();
  if (COMMON_PASSWORDS.has(value) || /^(.)\1*$/.test(value)) {
    throw validationError(field, 'Password is too common');
  }
  if (value === user.userName.toLowerCase() || value === user.email.toLowerCase()) {
    throw validationError(field, 'Password must not match the username or email');
  }
}

// birthday приходит как «YYYY-MM-DD». Возвращает Date (UTC, полночь) или бросает 400.
export function parseBirthday(value: string, now: Date = new Date()): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw validationError('birthday', 'birthday must be a valid date');
  }
  const minAdult = new Date(
    Date.UTC(date.getUTCFullYear() + MIN_AGE_YEARS, date.getUTCMonth(), date.getUTCDate()),
  );
  if (minAdult.getTime() > now.getTime()) {
    throw validationError('birthday', `You must be at least ${MIN_AGE_YEARS} years old`);
  }
  return date;
}

export function assertUserNameAllowed(userName: string): void {
  if (RESERVED_USER_NAMES.has(userName)) {
    throw validationError('userName', 'This username is reserved');
  }
}

// Код из 6 цифр легко перебрать, поэтому хеш привязан к пользователю; защита от перебора — лимит попыток.
export function hashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Сколько дней старое имя пользователя остаётся за прежним владельцем (F-ACC-11).
export const OLD_USER_NAME_HOLD_MS = 14 * 24 * 60 * 60 * 1000;

// Шестизначный код для письма.
export function generateCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, '0');
}

export function invalidCode(): BadRequestException {
  return new BadRequestException({
    code: 'VERIFICATION_CODE_INVALID',
    message: 'Verification code is invalid or expired',
  });
}

export function conflictError(field: string, message: string): ConflictException {
  return new ConflictException({ code: 'CONFLICT', message, details: [{ field, message }] });
}

// Параметры Argon2id по OWASP: память 19 MiB, 2 прохода (AUTHENTICATION.md §6).
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}
