import { Global, Module } from '@nestjs/common';
import { CloseFriendsController } from './close-friends.controller';
import { CloseFriendsService } from './close-friends.service';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { SuggestionsService } from './suggestions.service';

// Глобальный: FollowsService нужен профилю, лентам, историям, privacy.
@Global()
@Module({
  controllers: [FollowsController, CloseFriendsController],
  providers: [FollowsService, SuggestionsService, CloseFriendsService],
  exports: [FollowsService, SuggestionsService],
})
export class FollowsModule {}
