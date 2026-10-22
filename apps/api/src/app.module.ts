import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OriginGuard } from './common/guards/origin.guard';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AppConfigModule, PrismaModule, MailModule, HealthModule],
  providers: [
    // Порядок глобальных guard'ов: Origin -> Session -> Throttler (SessionGuard — T0.3, Throttler — T1.A1).
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
