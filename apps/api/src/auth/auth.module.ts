import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthClient } from './oauth.client';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { PasswordService } from './password.service';
import { RegistrationService } from './registration.service';
import { TwoFactorService } from './two-factor.service';

// SessionService, UsersService, MailService и PrismaService — глобальные модули, импортировать не нужно.
@Module({
  controllers: [AuthController, OAuthController],
  providers: [
    OAuthClient,
    OAuthService,
    AuthService,
    RegistrationService,
    PasswordService,
    TwoFactorService,
  ],
})
export class AuthModule {}
