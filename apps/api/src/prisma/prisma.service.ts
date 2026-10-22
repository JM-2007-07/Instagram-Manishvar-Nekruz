import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '@/config/env';
import { PrismaClient } from '@/generated/prisma/client';

// Prisma 7 работает через драйвер-адаптер: соединением с PostgreSQL управляет pg.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    const connectionString = config.get('DATABASE_URL', { infer: true });
    // Параметр ?schema=... pg не понимает, поэтому передаём схему адаптеру отдельно.
    const schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
    super({ adapter: new PrismaPg({ connectionString }, { schema }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
