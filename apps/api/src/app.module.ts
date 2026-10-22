import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { ChatsModule } from './chats/chats.module';
import { OriginGuard } from './common/guards/origin.guard';
import { SessionGuard } from './common/session/session.guard';
import { SessionModule } from './common/session/session.module';
import { AppThrottlerGuard, AppThrottlerModule } from './common/throttler/app-throttler';
import { AppConfigModule } from './config/app-config.module';
import { FollowsModule } from './follows/follows.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

// Модули общих сервисов (Session, Users, Privacy, Notifications, Realtime) глобальные: их сервисы
// доступны везде без импорта, как PrismaService.
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    MailModule,
    SessionModule,
    AppThrottlerModule,
    // FollowsModule раньше UsersModule: маршрут users/suggestions должен быть выше users/:userId.
    FollowsModule,
    UsersModule,
    PrivacyModule,
    NotificationsModule,
    RealtimeModule,
    HealthModule,
    AuthModule,
    SettingsModule,
    SearchModule,
    CallsModule,
    ChatsModule,
  ],
  providers: [
    // Порядок глобальных guard'ов: Origin -> Session -> Throttler.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
