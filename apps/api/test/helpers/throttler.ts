import { INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ResettableThrottlerStorage } from '@/common/throttler/app-throttler';

// Обнуляет счётчики rate limit, чтобы лимиты одного теста не мешали другим.
export function resetThrottler(app: INestApplication): void {
  (app.get(ThrottlerStorage) as ResettableThrottlerStorage).reset();
}
