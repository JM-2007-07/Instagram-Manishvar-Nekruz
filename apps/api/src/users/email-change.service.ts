import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import {
  CODE_MAX_ATTEMPTS,
  CODE_TTL_MS,
  conflictError,
  generateCode,
  hashCode,
  invalidCode,
  safeEqual,
} from '@/auth/auth.rules';
import { validationError } from '@/common/validation';
import type { Env } from '@/config/env';
import { Prisma } from '@/generated/prisma/client';
import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MeDto } from './dto/me.dto';
import type { ChangeEmailDto, VerifyEmailChangeDto } from './dto/profile-requests.dto';
import { UsersService } from './users.service';

// Смена email (F-ACC-12): код уходит на новый адрес, адрес меняется после подтверждения.
@Injectable()
export class EmailChangeService {
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.appName = config.get('APP_NAME', { infer: true });
  }

  async requestEmailChange(userId: string, dto: ChangeEmailDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException();

    // У аккаунта без пароля (соцвход) пароль не нужен.
    if (user.passwordHash) {
      const ok =
        dto.password !== undefined &&
        (await argon2.verify(user.passwordHash, dto.password).catch(() => false));
      if (!ok) throw validationError('password', 'Password is incorrect');
    }
    if (dto.email === user.email) {
      throw validationError('email', 'This is already your email');
    }
    const taken = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (taken) throw conflictError('email', 'An account with this email already exists');

    const code = generateCode();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.deleteMany({
        where: { userId, purpose: 'EMAIL_CHANGE', usedAt: null },
      });
      await tx.emailVerificationCode.create({
        data: {
          userId,
          email: dto.email,
          purpose: 'EMAIL_CHANGE',
          codeHash: hashCode(userId, code),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });
    });
    // Письмо — только после успешной транзакции; код уходит на новый адрес.
    await this.mail.send({
      to: dto.email,
      subject: `${this.appName}: подтверждение нового email`,
      text: `Ваш код подтверждения: ${code}\nОн действует ${CODE_TTL_MS / 60000} минут.`,
    });
  }

  async verifyEmailChange(userId: string, dto: VerifyEmailChangeDto): Promise<MeDto> {
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { userId, purpose: 'EMAIL_CHANGE', usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, codeHash: true },
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
    if (!safeEqual(record.codeHash, hashCode(userId, dto.code))) throw invalidCode();

    try {
      await this.prisma.$transaction(async (tx) => {
        const used = await tx.emailVerificationCode.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (used.count === 0) throw invalidCode();
        await tx.user.update({
          where: { id: userId },
          data: { email: record.email, emailVerifiedAt: new Date() },
        });
        // Ссылки сброса пароля, отправленные на старый адрес, больше не действуют.
        await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
      });
    } catch (error) {
      // Адрес заняли, пока код лежал в почте.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflictError('email', 'An account with this email already exists');
      }
      throw error;
    }
    return this.users.getMe(userId);
  }
}
