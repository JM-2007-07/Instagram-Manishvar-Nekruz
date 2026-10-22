import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: адрес БД задаётся здесь, а не в schema. Схема разбита на файлы в prisma/schema (ADR 0018).
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Без env(): `prisma generate` должен работать и без .env (например, при npm install в CI).
    url: process.env.DATABASE_URL,
  },
});
