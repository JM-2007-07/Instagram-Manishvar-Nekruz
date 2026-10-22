import { execSync } from 'node:child_process';
import * as dotenv from 'dotenv';

// Запускается один раз перед всеми e2e-тестами: выбирает тестовую БД и применяет миграции.
export default function globalSetup(): void {
  dotenv.config({ quiet: true }); // читаем apps/api/.env, но не перезаписываем уже заданные переменные

  const testUrl = process.env.DATABASE_URL_TEST || deriveTestUrl(process.env.DATABASE_URL);

  // Защита: тесты чистят таблицы, поэтому работают только с БД, имя которой оканчивается на _test.
  const dbName = new URL(testUrl).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`e2e: database name "${dbName}" must end with "_test"; refusing to run`);
  }

  // Приложение и Prisma CLI в этом процессе увидят тестовую БД.
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}

// Если DATABASE_URL_TEST не задана — берём DATABASE_URL и меняем имя БД на instagram_test.
function deriveTestUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('e2e: set DATABASE_URL (or DATABASE_URL_TEST) in apps/api/.env');
  }
  const url = new URL(databaseUrl);
  url.pathname = '/instagram_test';
  return url.toString();
}
