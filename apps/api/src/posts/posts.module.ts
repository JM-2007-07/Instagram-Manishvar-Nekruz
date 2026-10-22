import { Global, Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

// Глобальный: PostsService нужен профилю (postCount), подборкам, чатам, комментариям, историям.
@Global()
@Module({
  controllers: [PostsController, FeedController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
