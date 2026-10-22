import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env';

// Глобальный модуль: ConfigService<Env, true> доступен везде без импорта.
// Читать process.env напрямую вне src/config запрещено линтером.
@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  exports: [ConfigModule],
})
export class AppConfigModule {}
