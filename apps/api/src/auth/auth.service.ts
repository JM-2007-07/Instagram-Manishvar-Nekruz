import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { SessionService, type SessionMeta } from '@/common/session/session.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';
import { UsersService } from '@/users/users.service';
import { hashPassword } from './auth.rules';
import type { AuthResult } from './auth.types';
import { TwoFactorService } from './two-factor.service';
import type { LoginDto, SessionDto } from './dto/auth.dto';
import type { TwoFactorRequiredDto } from './dto/two-factor.dto';

// Вход, выход и список сессий. Регистрация — RegistrationService, пароль — PasswordService.
@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly realtime: RealtimeService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult | TwoFactorRequiredDto> {
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
    // С включённой 2FA сессию создаёт POST /auth/login/2fa после проверки кода.
    if (await this.twoFactor.isEnabled(user.id)) {
      return {
        twoFactorRequired: true,
        challengeId: await this.twoFactor.createChallenge(user.id),
      };
    }
    return this.startSession(user.id, user.status, meta);
  }

  // Второй шаг входа с 2FA: код (или резервный код) + challengeId из ответа /auth/login.
  async loginWithTwoFactor(
    challengeId: string,
    code: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const userId = await this.twoFactor.completeChallenge(challengeId, code);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true },
    });
    if (user.status === 'BANNED') throw new ForbiddenException('Account is banned');
    return this.startSession(userId, user.status, meta);
  }

  // Вход деактивированного или удаляемого аккаунта восстанавливает его (F-ACC-13, 14).
  private async startSession(
    userId: string,
    status: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    if (status !== 'ACTIVE') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', deletionScheduledAt: null },
      });
    }
    const { token } = await this.sessions.create(userId, meta);
    return { token, me: await this.users.getMe(userId) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
    this.realtime.disconnectSessions([sessionId]);
  }

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
    this.realtime.disconnectSessions([session.id]);
    return session.id === currentSessionId;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
