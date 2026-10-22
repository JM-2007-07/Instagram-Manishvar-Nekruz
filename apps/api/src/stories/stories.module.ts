import { Global, Module } from '@nestjs/common';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

// Глобальный: StoriesService.hasActiveStory нужен кольцу аватара (UserSummary) в других модулях.
@Global()
@Module({
  controllers: [StoriesController, HighlightsController],
  providers: [StoriesService, HighlightsService],
  exports: [StoriesService],
})
export class StoriesModule {}
