import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { SessionService, type SessionMeta } from '@/common/session/session.service';
import type { Env } from '@/config/env';
import type { Prisma } from '@/generated/prisma/client';
import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MeDto } from '@/users/dto/me.dto';
import { UsersService } from '@/users/users.service';
import {
  assertPasswordAllowed,
  assertUserNameAllowed,
  CODE_LENGTH,
  CODE_MAX_ATTEMPTS,
  CODE_TTL_MS,
  parseBirthday,
  RESERVED_USER_NAMES,
  UNVERIFIED_TTL_MS,
  USER_NAME_REGEX,
  validationError,
} from './auth.rules';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RegisterResponseDto,
  ResetPasswordDto,
  SessionDto,
  UserNameAvailabilityDto,
  VerifyEmailDto,
} from './dto/auth.dto';

// Результат входа: контроллер кладёт token в cookie, me отдаёт в теле ответа.
export interface AuthResult {
  token: string;
  me: MeDto;
}

// Параметры Argon2id по OWASP: память 19 MiB, 2 прохода (AUTHENTICATION.md §6).
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService {
  private readonly webOrigin: string;
  private readonly appName: string;
  private readonly resetTtlMs: number;
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
    this.appName = config.get('APP_NAME', { infer: true });
    this.resetTtlMs = config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true }) * 60 * 1000;
  }

  // --- Регистрация -------------------------------------------------------------------------------

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
    const passwordHash = await this.hashPassword(password);

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
    if (byName && byName.id !== byEmail?.id) {
      throw this.conflict('userName', 'This username is already taken');
    }
    if (byEmail?.emailVerifiedAt) {
      throw this.conflict('email', 'An account with this email already exists');
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
    if (!user || user.emailVerifiedAt) throw this.invalidCode();

    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id, purpose: 'SIGNUP', usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true },
    });
    if (!record) throw this.invalidCode();

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
    if (attempt.count === 0) throw this.invalidCode();
    if (!safeEqual(record.codeHash, hashCode(user.id, dto.code))) throw this.invalidCode();

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const used = await tx.emailVerificationCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (used.count === 0) throw this.invalidCode();
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    });
    return this.startSession(user.id, meta);
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

  // --- Вход и выход ------------------------------------------------------------------------------

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const login = dto.login.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ userName: login }, { email: login }] },
      select: { id: true, passwordHash: true, status: true, emailVerifiedAt: true },
    });

    // Хеш проверяется всегда (для неизвестного логина — фиктивный): время ответа не выдаёт, есть ли аккаунт.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await argon2.verify(hash, dto.password).catch(() => false);
    if (!user || !user.passwordHash || !passwordOk) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      });
    }

    if (user.status === 'BANNED') throw new ForbiddenException('Account is banned');
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email is not verified',
      });
    }
    // Вход деактивированного или удаляемого аккаунта восстанавливает его (F-ACC-13, 14).
    if (user.status !== 'ACTIVE') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', deletionScheduledAt: null },
      });
    }
    return this.startSession(user.id, meta);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  // --- Пароль ------------------------------------------------------------------------------------

  // Всегда без ошибки для клиента (202), даже если аккаунта нет.
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const login = dto.login.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ userName: login }, { email: login }],
        emailVerifiedAt: { not: null },
        status: { not: 'BANNED' },
      },
      select: { id: true, email: true },
    });
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.resetTtlMs),
        },
      });
    });

    const link = `${this.webOrigin}/accounts/password/reset/?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: `${this.appName}: сброс пароля`,
      text: `Чтобы задать новый пароль, перейдите по ссылке (действует ${this.resetTtlMs / 60000} мин.):\n${link}\nЕсли вы не запрашивали сброс, просто проигнорируйте письмо.`,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const badToken = () => new BadRequestException('Reset link is invalid or expired');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { id: true, userName: true, email: true } },
      },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw badToken();

    // Слабый пароль отклоняется до того, как токен израсходован.
    assertPasswordAllowed(dto.newPassword, record.user, 'newPassword');
    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      const used = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count === 0) throw badToken(); // токен одноразовый
      await tx.user.update({ where: { id: record.user.id }, data: { passwordHash } });
    });
    await this.sessions.revokeAllForUser(record.user.id);
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, userName: true, email: true },
    });
    if (!user) throw new NotFoundException();

    // У аккаунта без пароля (соцвход) текущий пароль не нужен.
    if (user.passwordHash) {
      const ok =
        dto.currentPassword !== undefined &&
        (await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false));
      if (!ok) throw validationError('currentPassword', 'Current password is incorrect');
    }
    assertPasswordAllowed(dto.newPassword, user, 'newPassword');

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.sessions.revokeAllForUser(userId, currentSessionId);
  }

  // --- Сессии ------------------------------------------------------------------------------------

  async listSessions(userId: string, currentSessionId: string): Promise<SessionDto[]> {
    const now = new Date();
    const rows = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
      isCurrent: row.id === currentSessionId,
    }));
  }

  // Завершает чужую или свою сессию; true — если это была текущая (контроллер уберёт cookie).
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ): Promise<boolean> {
    // Чужая сессия неотличима от несуществующей.
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException();
    await this.sessions.revoke(session.id);
    return session.id === currentSessionId;
  }

  // --- Вспомогательное ---------------------------------------------------------------------------

  private async startSession(userId: string, meta: SessionMeta): Promise<AuthResult> {
    const { token } = await this.sessions.create(userId, meta);
    return { token, me: await this.users.getMe(userId) };
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }

  // Новый код вместо старых; в БД только хеш. Вызывается внутри транзакции.
  private async issueCode(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<{ code: string; sentAt: Date }> {
    const code = randomInt(0, 10 ** CODE_LENGTH)
      .toString()
      .padStart(CODE_LENGTH, '0');
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

  private invalidCode(): BadRequestException {
    return new BadRequestException({
      code: 'VERIFICATION_CODE_INVALID',
      message: 'Verification code is invalid or expired',
    });
  }

  private conflict(field: string, message: string): ConflictException {
    return new ConflictException({ code: 'CONFLICT', message, details: [{ field, message }] });
  }

  // Имена, которые заняты: подтверждённые аккаунты и свежие неподтверждённые (старые будут удалены при регистрации).
  private async findTaken(names: string[]): Promise<Set<string>> {
    const rows = await this.prisma.user.findMany({
      where: {
        userName: { in: names },
        NOT: { emailVerifiedAt: null, createdAt: { lt: new Date(Date.now() - UNVERIFIED_TTL_MS) } },
      },
      select: { userName: true },
    });
    return new Set(rows.map((row) => row.userName));
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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Код из 6 цифр легко перебрать, поэтому хеш привязан к пользователю; защита от перебора — лимит попыток.
function hashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
