import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RegistrationService } from './registration.service';

// SessionService, UsersService, MailService и PrismaService — глобальные модули, импортировать не нужно.
@Module({
  controllers: [AuthController],
  providers: [AuthService, RegistrationService, PasswordService],
})
export class AuthModule {}
