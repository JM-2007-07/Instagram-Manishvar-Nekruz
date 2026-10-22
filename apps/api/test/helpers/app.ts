import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import { PrismaService } from '@/prisma/prisma.service';

// Origin для изменяющих запросов (OriginGuard). Совпадает с WEB_ORIGIN по умолчанию.
export const ORIGIN = 'http://localhost:3000';

// Заголовки для POST/PUT/PATCH/DELETE: supertest.set(withOrigin()).
export function withOrigin(extra: Record<string, string> = {}): Record<string, string> {
  return { Origin: ORIGIN, ...extra };
}

// Приложение для e2e: тот же setupApp, что и в main.ts.
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

// Очищает все таблицы public (кроме _prisma_migrations). Работает только с БД, имя которой оканчивается на _test.
export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!name.endsWith('_test')) {
    throw new Error(`resetDb: database "${name}" must end with "_test"; refusing to truncate`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
