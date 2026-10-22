import { Global, Module } from '@nestjs/common';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaProcessingService } from './media-processing.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

// Глобальный: MediaService нужен постам, историям, профилю (аватар) и чатам.
@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaProcessingService, MediaCleanupService],
  exports: [MediaService],
})
export class MediaModule {}
