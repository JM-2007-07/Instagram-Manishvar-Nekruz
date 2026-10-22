import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { SessionService } from '@/common/session/session.service';
import type { UserRole, UserStatus } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface TestUser {
  id: string;
  userName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface CreateUserOverrides {
  userName?: string;
  email?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  isPrivate?: boolean;
  isVerified?: boolean;
}

// Подтверждённый ACTIVE-пользователь с настройками по умолчанию. Пароль хэшируется argon2id.
const DEFAULT_PASSWORD = 'Test-password-123';
let defaultHash: Promise<string> | undefined;

// argon2 медленный намеренно; хеш пароля по умолчанию считаем один раз на весь прогон тестов.
function hashPassword(password: string): Promise<string> {
  if (password !== DEFAULT_PASSWORD) return argon2.hash(password, { type: argon2.argon2id });
  defaultHash ??= argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id });
  return defaultHash;
}

export async function createUser(
  app: INestApplication,
  overrides: CreateUserOverrides = {},
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const suffix = randomBytes(4).toString('hex');
  const userName = (overrides.userName ?? `user_${suffix}`).toLowerCase();
  const email = (overrides.email ?? `${userName}@example.test`).toLowerCase();
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const user = await prisma.user.create({
    data: {
      userName,
      email,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(password),
      fullName: overrides.fullName ?? `Test ${userName}`,
      birthday: new Date('2000-01-01'),
      role: overrides.role ?? 'USER',
      status: overrides.status ?? 'ACTIVE',
      isPrivate: overrides.isPrivate ?? false,
      isVerified: overrides.isVerified ?? false,
      settings: { create: {} },
    },
    select: { id: true, userName: true, email: true, role: true },
  });
  return { ...user, password };
}

// Создаёт сессию напрямую (без HTTP) и возвращает значение для заголовка Cookie: 'sid=<token>'.
export async function loginAs(app: INestApplication, user: Pick<TestUser, 'id'>): Promise<string> {
  const sessions = app.get(SessionService);
  const { token } = await sessions.create(user.id, { ipAddress: '127.0.0.1', userAgent: 'jest' });
  return `${sessions.cookie}=${token}`;
}
