import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// SessionService, UsersService, MailService и PrismaService — глобальные модули, импортировать не нужно.
@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
