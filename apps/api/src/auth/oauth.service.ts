import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { SessionService, type SessionMeta } from '@/common/session/session.service';
import type { Env } from '@/config/env';
import type { OAuthProvider } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/users/users.service';
import {
  assertUserNameAllowed,
  conflictError,
  OLD_USER_NAME_HOLD_MS,
  parseBirthday,
} from './auth.rules';
import type { AuthResult } from './auth.types';
import { OAuthClient, type ExternalProfile, type OAuthProviderName } from './oauth.client';
import type { CompleteOAuthDto, OAuthProvidersDto } from './oauth.dto';

export const OAUTH_TX_COOKIE = 'oauth_tx';
export const OAUTH_PENDING_COOKIE = 'oauth_pending';
const TX_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;

// Результат callback: контроллер по нему выбирает редирект и cookie.
export type CallbackResult =
  | { kind: 'signed-in'; token: string }
  | { kind: 'complete'; pendingToken: string }
  | { kind: 'error' };

const toDb = (provider: OAuthProviderName): OAuthProvider =>
  provider === 'google' ? 'GOOGLE' : 'FACEBOOK';

// Соцвход (ADR 0014): state и code_verifier лежат в короткой HttpOnly cookie, сессию выдаёт наш backend.
@Injectable()
export class OAuthService {
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly client: OAuthClient,
    config: ConfigService<Env, true>,
  ) {
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  providers(): OAuthProvidersDto {
    return { google: this.client.isEnabled('google'), facebook: this.client.isEnabled('facebook') };
  }

  // Ставит cookie транзакции и возвращает адрес провайдера. Выключенный провайдер — 404.
  start(provider: OAuthProviderName, res: Response): string {
    if (!this.client.isEnabled(provider)) throw new NotFoundException();
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res.cookie(OAUTH_TX_COOKIE, `${provider}.${state}.${verifier}`, {
      ...this.cookieOptions(),
      maxAge: TX_TTL_MS,
    });
    return this.client.authorizeUrl(provider, state, challenge);
  }

  async callback(
    provider: OAuthProviderName,
    query: { code?: unknown; state?: unknown; error?: unknown },
    txCookie: unknown,
    meta: SessionMeta,
  ): Promise<CallbackResult> {
    if (!this.client.isEnabled(provider)) throw new NotFoundException();
    const tx = typeof txCookie === 'string' ? txCookie.split('.') : [];
    const [txProvider, state, verifier] = tx;
    if (
      query.error ||
      typeof query.code !== 'string' ||
      typeof query.state !== 'string' ||
      tx.length !== 3 ||
      txProvider !== provider ||
      query.state !== state
    ) {
      return { kind: 'error' };
    }

    let profile: ExternalProfile;
    try {
      profile = await this.client.fetchProfile(provider, query.code, verifier);
    } catch {
      return { kind: 'error' }; // подробности не логируем: в них могут быть токены
    }
    return this.signInOrStartRegistration(provider, profile, meta);
  }

  private async signInOrStartRegistration(
    provider: OAuthProviderName,
    profile: ExternalProfile,
    meta: SessionMeta,
  ): Promise<CallbackResult> {
    const dbProvider = toDb(provider);
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: { provider: dbProvider, providerUserId: profile.providerUserId },
      },
      select: { user: { select: { id: true, status: true } } },
    });
    let user = linked?.user ?? null;

    // Нет связи: подтверждённый провайдером email совпал с аккаунтом -> связываем.
    if (!user && profile.email && profile.emailVerified) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
        select: { id: true, status: true, emailVerifiedAt: true },
      });
      if (byEmail) {
        await this.prisma.$transaction(async (tx) => {
          // Адрес подтвердил провайдер. Если аккаунт был неподтверждённым, пароль мог задать не владелец
          // адреса — сбрасываем его.
          if (!byEmail.emailVerifiedAt) {
            await tx.user.update({
              where: { id: byEmail.id },
              data: { emailVerifiedAt: new Date(), passwordHash: null },
            });
          }
          await tx.oAuthAccount.create({
            data: {
              provider: dbProvider,
              providerUserId: profile.providerUserId,
              userId: byEmail.id,
              email: profile.email,
            },
          });
        });
        user = byEmail;
      }
    }

    if (user) {
      if (user.status === 'BANNED') return { kind: 'error' };
      // Вход деактивированного или удаляемого аккаунта восстанавливает его (как обычный вход).
      if (user.status !== 'ACTIVE') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE', deletionScheduledAt: null },
        });
      }
      const { token } = await this.sessions.create(user.id, meta);
      return { kind: 'signed-in', token };
    }

    // Аккаунта нет: без подтверждённого email зарегистрировать нельзя.
    if (!profile.email || !profile.emailVerified) return { kind: 'error' };
    const pendingToken = randomBytes(32).toString('base64url');
    await this.prisma.oAuthPending.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.oAuthPending.create({
      data: {
        tokenHash: hashToken(pendingToken),
        provider: dbProvider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        fullName: profile.name.trim().slice(0, 64) || profile.email.split('@')[0].slice(0, 64),
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      },
    });
    return { kind: 'complete', pendingToken };
  }

  async complete(
    dto: CompleteOAuthDto,
    pendingToken: unknown,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    if (typeof pendingToken !== 'string') throw invalidPending();
    const pending = await this.prisma.oAuthPending.findUnique({
      where: { tokenHash: hashToken(pendingToken) },
    });
    if (!pending || pending.expiresAt.getTime() <= Date.now()) throw invalidPending();

    const { userName } = dto;
    assertUserNameAllowed(userName);
    const birthday = parseBirthday(dto.birthday);
    const held = await this.prisma.usernameChange.findFirst({
      where: {
        oldUserName: userName,
        changedAt: { gt: new Date(Date.now() - OLD_USER_NAME_HOLD_MS) },
      },
      select: { id: true },
    });
    const taken = await this.prisma.user.findUnique({ where: { userName }, select: { id: true } });
    if (held || taken) throw conflictError('userName', 'This username is already taken');

    // Уникальность email/имени/внешнего аккаунта при гонке (P2002) фильтр ошибок превращает в 409.
    const userId = await this.prisma.$transaction(async (tx) => {
      // Токен одноразовый: удаляем первым, параллельный запрос получит count 0.
      const used = await tx.oAuthPending.deleteMany({ where: { id: pending.id } });
      if (used.count === 0) throw invalidPending();
      const created = await tx.user.create({
        data: {
          email: pending.email,
          userName,
          fullName: pending.fullName,
          birthday,
          emailVerifiedAt: new Date(),
          settings: { create: {} },
          oauthAccounts: {
            create: {
              provider: pending.provider,
              providerUserId: pending.providerUserId,
              email: pending.email,
            },
          },
        },
        select: { id: true },
      });
      return created.id;
    });
    const { token } = await this.sessions.create(userId, meta);
    return { token, me: await this.users.getMe(userId) };
  }

  // Отвязка допустима, только если останется другой способ входа: пароль или другой провайдер.
  async unlink(userId: string, provider: OAuthProviderName): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, oauthAccounts: { select: { provider: true } } },
    });
    const dbProvider = toDb(provider);
    if (!user || !user.oauthAccounts.some((account) => account.provider === dbProvider)) {
      throw new NotFoundException();
    }
    const others = user.oauthAccounts.filter((account) => account.provider !== dbProvider);
    if (!user.passwordHash && others.length === 0) {
      throw new ConflictException({
        code: 'LIMIT_REACHED',
        message: 'Set a password or link another account before unlinking the last sign-in method',
      });
    }
    await this.prisma.oAuthAccount.deleteMany({ where: { userId, provider: dbProvider } });
  }

  setPendingCookie(res: Response, pendingToken: string): void {
    res.cookie(OAUTH_PENDING_COOKIE, pendingToken, {
      ...this.cookieOptions(),
      maxAge: PENDING_TTL_MS,
    });
  }

  // После callback нужна только очистка tx-cookie: oauth_pending ставится в том же ответе.
  clearTxCookie(res: Response): void {
    res.clearCookie(OAUTH_TX_COOKIE, this.cookieOptions());
  }

  clearOAuthCookies(res: Response): void {
    res.clearCookie(OAUTH_TX_COOKIE, this.cookieOptions());
    res.clearCookie(OAUTH_PENDING_COOKIE, this.cookieOptions());
  }

  // Lax обязателен: провайдер возвращает пользователя переходом верхнего уровня, а strict cookie бы не отправил.
  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.isProduction, path: '/' };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidPending(): BadRequestException {
  return new BadRequestException({
    code: 'BAD_REQUEST',
    message: 'Sign-in session expired, start again',
  });
}
