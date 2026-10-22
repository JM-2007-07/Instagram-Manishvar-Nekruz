import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

// SessionService и ConfigService — глобальные модули.
@Global()
@Module({ providers: [RealtimeService, RealtimeGateway], exports: [RealtimeService] })
export class RealtimeModule {}
