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
import { UsersService } from '@/users/users.service';
import { hashPassword } from './auth.rules';
import type { AuthResult } from './auth.types';
import type { LoginDto, SessionDto } from './dto/auth.dto';

// Вход, выход и список сессий. Регистрация — RegistrationService, пароль — PasswordService.
@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

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
    const { token } = await this.sessions.create(user.id, meta);
    return { token, me: await this.users.getMe(user.id) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
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
    return session.id === currentSessionId;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
