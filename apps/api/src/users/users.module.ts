import { Global, Module } from '@nestjs/common';
import { EmailChangeService } from './email-change.service';
import { ProfileService } from './profile.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Глобальный: UsersService.toSummary() нужен почти всем модулям (авторы, комментаторы, списки).
@Global()
@Module({
  controllers: [UsersController],
  providers: [UsersService, ProfileService, EmailChangeService],
  exports: [UsersService],
})
export class UsersModule {}
