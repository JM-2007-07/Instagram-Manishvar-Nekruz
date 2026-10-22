import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SessionService } from '@/common/session/session.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';

const DELETION_GRACE_DAYS = 30;

// Деактивация (F-ACC-13) и удаление (F-ACC-14) аккаунта. Скрытие из выдач — через status != ACTIVE
// (VisibilityService.visibleUserWhere). Восстановление — вход (AuthService.login).
// Окончательное удаление данных по истечении 30 дней — фоновая задача (не входит в T4.A4, см. STATUS).
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly realtime: RealtimeService,
  ) {}

  async deactivate(userId: string, password: string | undefined): Promise<void> {
    await this.assertPassword(userId, password);
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED' } });
    await this.closeAllSessions(userId);
  }

  async requestDeletion(
    userId: string,
    password: string | undefined,
  ): Promise<{ deletionScheduledAt: string }> {
    await this.assertPassword(userId, password);
    const deletionScheduledAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'PENDING_DELETION', deletionScheduledAt },
    });
    await this.closeAllSessions(userId);
    return { deletionScheduledAt: deletionScheduledAt.toISOString() };
  }

  // Пароль обязателен, если он есть у аккаунта. Аккаунт только с соцвходом пароля не имеет:
  // для него подтверждением служит действующая сессия (Q по спецификации — значение по умолчанию).
  private async assertPassword(userId: string, password: string | undefined): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException();
    if (!user.passwordHash) return;
    const ok = password
      ? await argon2.verify(user.passwordHash, password).catch(() => false)
      : false;
    if (!ok)
      throw new BadRequestException({ code: 'INVALID_PASSWORD', message: 'Invalid password' });
  }

  private async closeAllSessions(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId);
    this.realtime.disconnectUser(userId);
  }
}
