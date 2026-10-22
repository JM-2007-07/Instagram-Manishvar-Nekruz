import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import type { Env } from '@/config/env';
import { PrismaService } from '@/prisma/prisma.service';
import type { SessionUser } from './session-user';

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = 60 * 60 * 1000; // продлеваем не чаще раза в час, чтобы не писать в БД на каждый запрос

export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Серверные сессии (AUTHENTICATION.md): в cookie лежит случайный токен, в БД — только его sha256.
@Injectable()
export class SessionService {
  private readonly cookieName: string;
  private readonly idleMs: number;
  private readonly absoluteMs: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.idleMs = config.get('SESSION_IDLE_TTL_DAYS', { infer: true }) * DAY_MS;
    this.absoluteMs = config.get('SESSION_ABSOLUTE_TTL_DAYS', { infer: true }) * DAY_MS;
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  get cookie(): string {
    return this.cookieName;
  }

  async create(
    userId: string,
    meta: SessionMeta = {},
  ): Promise<{ token: string; sessionId: string }> {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    // Наружу отдаём только id: строка Session содержит tokenHash, её не должно быть в ответах.
    const session = await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
        expiresAt: new Date(now + this.idleMs),
        absoluteExpiresAt: new Date(now + this.absoluteMs),
      },
    });
    return { token, sessionId: session.id };
  }

  // Возвращает пользователя или null. Истёкшую сессию удаляет. Если передан res и сессия продлена —
  // обновляет cookie в ответе.
  async validate(token: string, res?: Response): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        lastUsedAt: true,
        expiresAt: true,
        absoluteExpiresAt: true,
        user: { select: { id: true, role: true, status: true } },
      },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now) {
      await this.revoke(session.id);
      return null;
    }
    if (session.user.status === 'BANNED') return null;

    if (now - session.lastUsedAt.getTime() >= RENEW_AFTER_MS) {
      // Продлеваем, но не дальше абсолютного срока.
      const expiresAt = new Date(Math.min(now + this.idleMs, session.absoluteExpiresAt.getTime()));
      // updateMany не бросает P2025, если сессию только что удалил параллельный выход.
      await this.prisma.session.updateMany({
        where: { id: session.id },
        data: { lastUsedAt: new Date(now), expiresAt },
      });
      if (res) this.setSessionCookie(res, token, expiresAt.getTime() - now);
    }
    return { id: session.user.id, role: session.user.role, sessionId: session.id };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  // «Выйти на всех устройствах»; exceptSessionId — текущая сессия остаётся (например, после смены пароля).
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    });
  }

  // maxAgeMs по умолчанию — полный idle-срок (для только что созданной сессии).
  setSessionCookie(res: Response, token: string, maxAgeMs: number = this.idleMs): void {
    res.cookie(this.cookieName, token, { ...this.cookieOptions(), maxAge: maxAgeMs });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.isProduction, path: '/' };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
