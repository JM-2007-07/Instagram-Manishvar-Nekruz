import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { SessionService, type SessionMeta } from '@/common/session/session.service';
import type { Env } from '@/config/env';
import type { Prisma } from '@/generated/prisma/client';
import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/users/users.service';
import {
  assertPasswordAllowed,
  assertUserNameAllowed,
  CODE_MAX_ATTEMPTS,
  CODE_TTL_MS,
  conflictError,
  generateCode,
  hashCode,
  hashPassword,
  invalidCode,
  OLD_USER_NAME_HOLD_MS,
  parseBirthday,
  RESERVED_USER_NAMES,
  safeEqual,
  UNVERIFIED_TTL_MS,
  USER_NAME_REGEX,
} from './auth.rules';
import type { AuthResult } from './auth.types';
import type {
  RegisterDto,
  RegisterResponseDto,
  UserNameAvailabilityDto,
  VerifyEmailDto,
} from './dto/auth.dto';

// Регистрация: проверка имени, создание аккаунта, код из письма.
@Injectable()
export class RegistrationService {
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.appName = config.get('APP_NAME', { infer: true });
  }

  async checkUserName(userName: string): Promise<UserNameAvailabilityDto> {
    const taken = await this.findTaken([userName]);
    if (!RESERVED_USER_NAMES.has(userName) && !taken.has(userName)) {
      return { available: true, suggestions: [] };
    }
    return { available: false, suggestions: await this.suggestUserNames(userName) };
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const { email, password, fullName, userName } = dto;
    assertUserNameAllowed(userName);
    const birthday = parseBirthday(dto.birthday);
    assertPasswordAllowed(password, { userName, email });
    const passwordHash = await hashPassword(password);

    // Неподтверждённые аккаунты старше 7 дней освобождают email и имя.
    await this.prisma.user.deleteMany({
      where: {
        emailVerifiedAt: null,
        createdAt: { lt: new Date(Date.now() - UNVERIFIED_TTL_MS) },
        OR: [{ email }, { userName }],
      },
    });
    const [byEmail, byName] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      }),
      this.prisma.user.findUnique({ where: { userName }, select: { id: true } }),
    ]);
    const held = await this.prisma.usernameChange.findFirst({
      where: {
        oldUserName: userName,
        changedAt: { gt: new Date(Date.now() - OLD_USER_NAME_HOLD_MS) },
      },
      select: { id: true },
    });
    if ((byName && byName.id !== byEmail?.id) || held) {
      throw conflictError('userName', 'This username is already taken');
    }
    if (byEmail?.emailVerifiedAt) {
      throw conflictError('email', 'An account with this email already exists');
    }

    const { code, sentAt } = await this.prisma.$transaction(async (tx) => {
      let userId: string;
      if (byEmail) {
        // Повторная регистрация на неподтверждённый email перезаписывает данные (и продлевает 7 дней).
        userId = byEmail.id;
        await tx.user.update({
          where: { id: userId },
          data: { userName, passwordHash, fullName, birthday, createdAt: new Date() },
        });
      } else {
        const created = await tx.user.create({
          data: { email, userName, passwordHash, fullName, birthday, settings: { create: {} } },
          select: { id: true },
        });
        userId = created.id;
      }
      return this.issueCode(tx, userId, email);
    });

    // Письмо — только после успешной транзакции.
    await this.sendCodeMail(email, code);
    return { email, codeSentAt: sentAt.toISOString() };
  }

  async verifyEmail(dto: VerifyEmailDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, emailVerifiedAt: true },
    });
    if (!user || user.emailVerifiedAt) throw invalidCode();

    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id, purpose: 'SIGNUP', usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true },
    });
    if (!record) throw invalidCode();

    // Попытка расходуется атомарно до сравнения: параллельным перебором лимит не обойти.
    const attempt = await this.prisma.emailVerificationCode.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        attempts: { lt: CODE_MAX_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count === 0) throw invalidCode();
    if (!safeEqual(record.codeHash, hashCode(user.id, dto.code))) throw invalidCode();

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.emailVerificationCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (used.count === 0) throw invalidCode();
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    });
    const { token } = await this.sessions.create(user.id, meta);
    return { token, me: await this.users.getMe(user.id) };
  }

  // Всегда без ошибки для клиента: не раскрываем, есть ли такой email.
  async resendCode(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });
    if (!user || user.emailVerifiedAt) return;
    const { code } = await this.prisma.$transaction((tx) => this.issueCode(tx, user.id, email));
    await this.sendCodeMail(email, code);
  }

  // Новый код вместо старых; в БД только хеш. Вызывается внутри транзакции.
  private async issueCode(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<{ code: string; sentAt: Date }> {
    const code = generateCode();
    const sentAt = new Date();
    await tx.emailVerificationCode.deleteMany({
      where: { userId, purpose: 'SIGNUP', usedAt: null },
    });
    await tx.emailVerificationCode.create({
      data: {
        userId,
        email,
        purpose: 'SIGNUP',
        codeHash: hashCode(userId, code),
        expiresAt: new Date(sentAt.getTime() + CODE_TTL_MS),
      },
    });
    return { code, sentAt };
  }

  private async sendCodeMail(email: string, code: string): Promise<void> {
    await this.mail.send({
      to: email,
      subject: `${this.appName}: код подтверждения`,
      text: `Ваш код подтверждения: ${code}\nОн действует ${CODE_TTL_MS / 60000} минут.`,
    });
  }

  // Имена, которые заняты: подтверждённые аккаунты, свежие неподтверждённые (старые будут удалены
  // при регистрации) и старые имена, закреплённые за прежним владельцем на 14 дней.
  private async findTaken(names: string[]): Promise<Set<string>> {
    const rows = await this.prisma.user.findMany({
      where: {
        userName: { in: names },
        NOT: { emailVerifiedAt: null, createdAt: { lt: new Date(Date.now() - UNVERIFIED_TTL_MS) } },
      },
      select: { userName: true },
    });
    const held = await this.prisma.usernameChange.findMany({
      where: {
        oldUserName: { in: names },
        changedAt: { gt: new Date(Date.now() - OLD_USER_NAME_HOLD_MS) },
      },
      select: { oldUserName: true },
    });
    return new Set([...rows.map((row) => row.userName), ...held.map((row) => row.oldUserName)]);
  }

  // До 3 вариантов, проверенных по БД (D14).
  private async suggestUserNames(userName: string): Promise<string[]> {
    const base = userName.slice(0, 26).replace(/\.+$/, '');
    const candidates = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      candidates.add(`${base}${randomInt(10, 1000)}`);
      candidates.add(`${base}_${randomInt(1, 100)}`);
    }
    const valid = [...candidates].filter(
      (name) => USER_NAME_REGEX.test(name) && !RESERVED_USER_NAMES.has(name),
    );
    const taken = await this.findTaken(valid);
    return valid.filter((name) => !taken.has(name)).slice(0, 3);
  }
}
