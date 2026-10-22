import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { validationError } from '@/common/validation';
import { SessionService } from '@/common/session/session.service';
import type { Env } from '@/config/env';
import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { assertPasswordAllowed, hashPassword } from './auth.rules';
import type { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';

// Пароль: «забыли пароль», сброс по ссылке, смена из настроек.
@Injectable()
export class PasswordService {
  private readonly webOrigin: string;
  private readonly appName: string;
  private readonly resetTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
    this.appName = config.get('APP_NAME', { infer: true });
    this.resetTtlMs = config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true }) * 60 * 1000;
  }

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
    const passwordHash = await hashPassword(dto.newPassword);

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

    const passwordHash = await hashPassword(dto.newPassword);
    // Пароль, ссылки сброса и остальные сессии меняются вместе: либо всё, либо ничего.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
      await tx.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
