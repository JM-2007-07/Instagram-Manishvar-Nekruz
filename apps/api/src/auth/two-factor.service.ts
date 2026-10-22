import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Env } from '@/config/env';
import { PrismaService } from '@/prisma/prisma.service';
import type { BackupCodesDto, TwoFactorSetupDto } from './dto/two-factor.dto';
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  hashBackupCode,
  otpauthUrl,
  verifyTotp,
} from './two-factor.crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;

// Двухфакторная аутентификация TOTP (F-ACC-15). Без TWO_FACTOR_ENCRYPTION_KEY функция выключена:
// setup/enable отвечают 409 TWO_FACTOR_UNAVAILABLE.
@Injectable()
export class TwoFactorService {
  private readonly key: string | undefined;
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.key = config.get('TWO_FACTOR_ENCRYPTION_KEY', { infer: true }) || undefined;
    this.appName = config.get('APP_NAME', { infer: true });
  }

  // Шаг 1: создаём (или пересоздаём, пока не включена) секрет. Включится только после enable.
  async setup(userId: string): Promise<TwoFactorSetupDto> {
    const key = this.requireKey();
    const existing = await this.prisma.twoFactorSecret.findUnique({
      where: { userId },
      select: { enabledAt: true },
    });
    if (existing?.enabledAt) {
      throw new ConflictException({
        code: 'TWO_FACTOR_ALREADY_ENABLED',
        message: 'Two-factor authentication is already enabled',
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const secret = generateSecret();
    const secretEncrypted = encryptSecret(secret, key);
    await this.prisma.twoFactorSecret.upsert({
      where: { userId },
      create: { userId, secretEncrypted },
      update: { secretEncrypted, backupCodeHashes: [] },
    });
    return { secret, otpauthUrl: otpauthUrl(secret, this.appName, user.email) };
  }

  // Шаг 2: код из приложения подтверждает, что секрет добавлен. Возвращает резервные коды (один раз).
  async enable(userId: string, code: string): Promise<BackupCodesDto> {
    const key = this.requireKey();
    const record = await this.prisma.twoFactorSecret.findUnique({
      where: { userId },
      select: { secretEncrypted: true, enabledAt: true },
    });
    if (!record || record.enabledAt) {
      throw new BadRequestException({
        code: 'TWO_FACTOR_SETUP_REQUIRED',
        message: 'Start setup first',
      });
    }
    if (!verifyTotp(decryptSecret(record.secretEncrypted, key), code)) {
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'Invalid code' });
    }
    const backupCodes = generateBackupCodes();
    await this.prisma.twoFactorSecret.update({
      where: { userId },
      data: { enabledAt: new Date(), backupCodeHashes: backupCodes.map(hashBackupCode) },
    });
    return { backupCodes };
  }

  async disable(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const ok = user.passwordHash
      ? await argon2.verify(user.passwordHash, password).catch(() => false)
      : false;
    if (!ok)
      throw new BadRequestException({ code: 'INVALID_PASSWORD', message: 'Invalid password' });
    await this.prisma.twoFactorSecret.deleteMany({ where: { userId } });
  }

  // --- Вход -----------------------------------------------------------------------------------

  async isEnabled(userId: string): Promise<boolean> {
    const record = await this.prisma.twoFactorSecret.findUnique({
      where: { userId },
      select: { enabledAt: true },
    });
    return record?.enabledAt != null;
  }

  async createChallenge(userId: string): Promise<string> {
    await this.prisma.twoFactorChallenge.deleteMany({
      where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] },
    });
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: { userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
      select: { id: true },
    });
    return challenge.id;
  }

  // Проверяет код (TOTP или резервный) и погашает challenge. Возвращает id пользователя.
  async completeChallenge(challengeId: string, code: string): Promise<string> {
    const invalid = () =>
      new BadRequestException({ code: 'INVALID_CODE', message: 'Invalid code' });
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, userId: true, attempts: true, expiresAt: true },
    });
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'CHALLENGE_EXPIRED',
        message: 'Login attempt expired, sign in again',
      });
    }
    if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
      await this.prisma.twoFactorChallenge.delete({ where: { id: challenge.id } });
      throw invalid();
    }
    await this.prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    if (!(await this.checkCode(challenge.userId, code))) throw invalid();
    await this.prisma.twoFactorChallenge.delete({ where: { id: challenge.id } });
    return challenge.userId;
  }

  private async checkCode(userId: string, code: string): Promise<boolean> {
    const record = await this.prisma.twoFactorSecret.findUnique({
      where: { userId },
      select: { secretEncrypted: true, backupCodeHashes: true, enabledAt: true },
    });
    if (!record?.enabledAt) return false;
    if (/^\d{6}$/.test(code)) {
      return verifyTotp(decryptSecret(record.secretEncrypted, this.requireKey()), code);
    }
    // Резервный код одноразовый: удаляем его хеш. updateMany с условием защищает от двойного использования.
    const hash = hashBackupCode(code);
    if (!record.backupCodeHashes.includes(hash)) return false;
    const rest = record.backupCodeHashes.filter((h) => h !== hash);
    const result = await this.prisma.twoFactorSecret.updateMany({
      where: { userId, backupCodeHashes: { has: hash } },
      data: { backupCodeHashes: rest },
    });
    return result.count === 1;
  }

  private requireKey(): string {
    if (!this.key) {
      throw new ConflictException({
        code: 'TWO_FACTOR_UNAVAILABLE',
        message: 'Two-factor authentication is not configured on the server',
      });
    }
    return this.key;
  }
}
