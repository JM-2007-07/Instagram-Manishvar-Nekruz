import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

// PostsService, MediaService, VisibilityService и PrismaService — из глобальных модулей.
@Module({
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
