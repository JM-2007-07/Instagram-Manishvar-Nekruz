import { Global, Module } from '@nestjs/common';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { SuggestionsService } from './suggestions.service';

// Глобальный: FollowsService нужен профилю, лентам, историям, privacy.
@Global()
@Module({
  controllers: [FollowsController],
  providers: [FollowsService, SuggestionsService],
  exports: [FollowsService, SuggestionsService],
})
export class FollowsModule {}
