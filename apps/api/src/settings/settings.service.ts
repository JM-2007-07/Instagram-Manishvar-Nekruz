import { Injectable } from '@nestjs/common';
import { validationError } from '@/common/validation';
import { PrismaService } from '@/prisma/prisma.service';
import {
  NOTIFICATION_TYPES,
  type NotificationPreferenceDto,
  type SettingsDto,
  type UpdateSettingsDto,
} from './dto/settings.dto';

const settingsSelect = {
  commentsFrom: true,
  tagsFrom: true,
  mentionsFrom: true,
  showActivityStatus: true,
  hideLikeCounts: true,
  allowStoryResharing: true,
  theme: true,
  language: true,
} as const;

// Те же значения, что у полей UserSettings в schema/account.prisma.
const DEFAULT_SETTINGS: SettingsDto = {
  commentsFrom: 'EVERYONE',
  tagsFrom: 'EVERYONE',
  mentionsFrom: 'EVERYONE',
  showActivityStatus: true,
  hideLikeCounts: false,
  allowStoryResharing: true,
  theme: 'SYSTEM',
  language: 'ru',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Строка настроек создаётся при регистрации; если её нет, отдаём значения по умолчанию (GET ничего не пишет).
  async getSettings(userId: string): Promise<SettingsDto> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: settingsSelect,
    });
    return row ?? DEFAULT_SETTINGS;
  }

  updateSettings(userId: string, dto: UpdateSettingsDto): Promise<SettingsDto> {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select: settingsSelect,
    });
  }

  // Все типы уведомлений; для которых нет строки, enabled = true.
  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceDto[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
      select: { type: true, enabled: true },
    });
    const byType = new Map(rows.map((row) => [row.type, row.enabled]));
    return NOTIFICATION_TYPES.map((type) => ({ type, enabled: byType.get(type) ?? true }));
  }

  async updateNotificationPreferences(
    userId: string,
    items: NotificationPreferenceDto[],
  ): Promise<NotificationPreferenceDto[]> {
    if (items.length > NOTIFICATION_TYPES.length) {
      throw validationError('body', 'Too many items');
    }
    // Если тип повторяется, побеждает последнее значение.
    const latest = new Map(items.map((item) => [item.type, item.enabled]));
    await this.prisma.$transaction(
      [...latest].map(([type, enabled]) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type } },
          create: { userId, type, enabled },
          update: { enabled },
        }),
      ),
    );
    return this.getNotificationPreferences(userId);
  }
}
