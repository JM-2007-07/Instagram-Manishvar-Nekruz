import { ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorageService,
  hours,
  minutes,
} from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../session/session-user';

// Хранилище счётчиков в памяти процесса (SECURITY.md). reset() нужен тестам: обнуляет все счётчики.
export class ResettableThrottlerStorage extends ThrottlerStorageService {
  reset(): void {
    this.onApplicationShutdown(); // очищает счётчики и останавливает таймер очистки
  }
}

// Имя второго (часового) лимита. Он включается только на маршрутах, где есть @Throttle({ hourly: ... }).
export const HOURLY = 'hourly';
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT'; // ключ метаданных @nestjs/throttler (+ имя лимита)

// Лимит по умолчанию — 300 запросов в минуту (SECURITY.md); на чувствительных маршрутах
// переопределяется через @Throttle({ default: { limit, ttl } }).
export const AppThrottlerModule = ThrottlerModule.forRoot({
  storage: new ResettableThrottlerStorage(),
  throttlers: [
    { name: 'default', limit: 300, ttl: minutes(1) },
    {
      name: HOURLY,
      limit: 1000000, // не используется, пока маршрут не задал свой лимит
      ttl: hours(1),
      skipIf: (context: ExecutionContext) =>
        !Reflect.getMetadata(THROTTLER_LIMIT_KEY + HOURLY, context.getHandler()),
    },
  ],
});

// Ключ счётчика: пользователь (если вошёл), иначе IP. Для не-HTTP контекстов (Socket.IO) лимитер не работает.
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(context.getType() !== 'http');
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as unknown as AuthenticatedRequest).user;
    return user ? user.id : super.getTracker(req);
  }
}
