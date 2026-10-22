import { Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';

// Заглушка до T1.A5: поведение — всё видно всем вошедшим. Сигнатуры не меняются (IMPLEMENTATION_PLAN §3.1).
// Реальная версия учтёт блокировки в обе стороны, закрытые аккаунты и аудиторию историй.
@Injectable()
export class VisibilityService {
  // Можно ли viewer смотреть профиль owner (шапку, счётчики).
  canViewProfile(viewerId: string, ownerId: string): Promise<boolean> {
    void viewerId;
    void ownerId;
    return Promise.resolve(true);
  }

  // Можно ли viewer смотреть контент owner (посты, истории): false у закрытого аккаунта без подписки.
  canViewContent(viewerId: string, ownerId: string): Promise<boolean> {
    void viewerId;
    void ownerId;
    return Promise.resolve(true);
  }

  // Бросает 404, если профиль недоступен (блокировка).
  async assertCanViewProfile(viewerId: string, ownerId: string): Promise<void> {
    await this.canViewProfile(viewerId, ownerId);
  }

  // Бросает 404 (блокировка) или 403 PRIVATE_ACCOUNT (закрытый аккаунт).
  async assertCanViewContent(viewerId: string, ownerId: string): Promise<void> {
    await this.canViewContent(viewerId, ownerId);
  }

  // Id пользователей, чьё содержимое viewer не должен видеть в списках (блокировки, mute).
  getHiddenUserIds(viewerId: string): Promise<string[]> {
    void viewerId;
    return Promise.resolve([]);
  }

  // Условие для where по User: «этих пользователей viewer может видеть в выдаче».
  visibleUserWhere(viewerId: string): Prisma.UserWhereInput {
    void viewerId;
    return {};
  }
}
