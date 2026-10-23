import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedLocations } from './seed/locations';

// ТЕСТОВЫЕ ДАННЫЕ ДЛЯ РАЗРАБОТКИ. Пароли ниже публичные и известны всем; в production не запускать.
const DEMO_PASSWORD = 'Demo-password-123';

const users = [
  { userName: 'admin', email: 'admin@example.test', fullName: 'Admin', role: 'ADMIN' as const },
  { userName: 'alice', email: 'alice@example.test', fullName: 'Alice Demo', role: 'USER' as const },
  { userName: 'bob', email: 'bob@example.test', fullName: 'Bob Demo', role: 'USER' as const },
  { userName: 'carol', email: 'carol@example.test', fullName: 'Carol Demo', role: 'USER' as const },
  // Ещё демо-пользователи — чтобы на показе были рекомендации (prisma/demo-data.ts даёт им фото и посты).
  {
    userName: 'dasha.travel',
    email: 'dasha@example.test',
    fullName: 'Даша Путешествия',
    role: 'USER' as const,
  },
  {
    userName: 'egor_photo',
    email: 'egor@example.test',
    fullName: 'Егор Фото',
    role: 'USER' as const,
  },
  {
    userName: 'fatima.art',
    email: 'fatima@example.test',
    fullName: 'Фатима Арт',
    role: 'USER' as const,
  },
  {
    userName: 'gleb.runs',
    email: 'gleb@example.test',
    fullName: 'Глеб Бег',
    role: 'USER' as const,
  },
  {
    userName: 'hana.cooks',
    email: 'hana@example.test',
    fullName: 'Хана Кухня',
    role: 'USER' as const,
  },
  {
    userName: 'ivan.mountains',
    email: 'ivan@example.test',
    fullName: 'Иван Горы',
    role: 'USER' as const,
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  if (process.env.NODE_ENV === 'production') throw new Error('Seed must not run in production');
  const schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });

  try {
    const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
    // upsert по userName: повторный запуск ничего не дублирует и не меняет существующих пользователей.
    for (const u of users) {
      await prisma.user.upsert({
        where: { userName: u.userName },
        update: {},
        create: {
          ...u,
          passwordHash,
          emailVerifiedAt: new Date(),
          birthday: new Date('1995-05-05'),
          settings: { create: {} },
        },
      });
    }
    // Данные модулей добавляются здесь, после пользователей (CONTRIBUTING «Общие файлы»):
    await seedLocations(prisma); // prisma/seed/locations.ts (B)

    console.log(`Seed done: ${users.length} users (demo password in prisma/seed.ts)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
