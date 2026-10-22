import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';

// Глобальный: UsersService.toSummary() нужен почти всем модулям (авторы, комментаторы, списки).
@Global()
@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
