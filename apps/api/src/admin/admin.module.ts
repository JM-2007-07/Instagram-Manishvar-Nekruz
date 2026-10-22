import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// PostsService, MediaService, SessionService, RealtimeService, PrismaService — глобальные модули.
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
