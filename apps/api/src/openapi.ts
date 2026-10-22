/* eslint-disable no-restricted-properties -- скрипт работает до загрузки config */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { buildOpenApiDocument } from './swagger';

// Экспорт контракта в docs/api/openapi.json. БД не нужна: приложение не запускается (нет init/listen),
// поэтому адрес БД — заглушка, только чтобы пройти проверку env.
async function exportOpenApi(): Promise<void> {
  process.env.DATABASE_URL ??= 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });
  setupApp(app);
  const document = buildOpenApiDocument(app);
  // dist/openapi.js -> корень репозитория
  const target = join(__dirname, '..', '..', '..', 'docs', 'api', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void exportOpenApi();
