import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { CallsService } from './calls.service';

// PrismaService, VisibilityService, RealtimeService и UsersService — глобальные модули.
@Module({ controllers: [CallsController], providers: [CallsService, CallsGateway] })
export class CallsModule {}
