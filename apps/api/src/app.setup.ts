import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/request/request-id';
import { createValidationPipe } from './common/validation';

// Общая настройка приложения: вызывается и из main.ts, и из e2e-тестов, чтобы тесты шли через те же pipe/filter.
export function setupApp(app: INestApplication): void {
  // За локальным прокси (Next.js) берём настоящий IP клиента из X-Forwarded-For (нужно для rate limit).
  (app as NestExpressApplication).set('trust proxy', 'loopback');
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
}
