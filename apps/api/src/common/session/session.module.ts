import { Global, Module } from '@nestjs/common';
import { SessionService } from './session.service';

// Глобальный, чтобы AuthModule и будущий Socket.IO шлюз брали SessionService без импорта.
@Global()
@Module({ providers: [SessionService], exports: [SessionService] })
export class SessionModule {}
