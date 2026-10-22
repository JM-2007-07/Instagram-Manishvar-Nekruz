import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { PostPageDto, PostsTabQueryDto } from './dto/posts.dto';
import { PostsService } from './posts.service';

// Ленты и списки публикаций. Выдачи хэштега и места лежат здесь же, чтобы модули tags/locations не зависели от posts.
@ApiTags('posts')
@Controller()
export class FeedController {
  constructor(private readonly posts: PostsService) {}

  @Get('feed')
  @ApiOkResponse({ type: PostPageDto, description: 'Подписки и свои публикации, новые сначала' })
  @ApiBadRequestResponse({ description: 'Неверный курсор' })
  feed(@CurrentUser() user: SessionUser, @Query() query: CursorQueryDto): Promise<PostPageDto> {
    return this.posts.feed(user.id, query);
  }

  @Get('feed/following')
  @ApiOkResponse({ type: PostPageDto })
  following(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.feed(user.id, query);
  }

  @Get('feed/favorites')
  @ApiOkResponse({ type: PostPageDto })
  favorites(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.feed(user.id, query, 'favorites');
  }

  @Get('explore')
  @ApiOkResponse({ type: PostPageDto })
  explore(@CurrentUser() user: SessionUser, @Query() query: CursorQueryDto): Promise<PostPageDto> {
    return this.posts.explore(user.id, query);
  }

  @Get('reels')
  @ApiOkResponse({ type: PostPageDto })
  reels(@CurrentUser() user: SessionUser, @Query() query: CursorQueryDto): Promise<PostPageDto> {
    return this.posts.reels(user.id, query);
  }

  @Get('users/:userId/posts')
  @ApiOkResponse({ type: PostPageDto, description: 'Закреплённые — первыми на первой странице' })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  userPosts(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Query() query: CursorQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.userGrid(user.id, userId, 'POSTS', query);
  }

  @Get('users/:userId/reels')
  @ApiOkResponse({ type: PostPageDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  userReels(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Query() query: CursorQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.userGrid(user.id, userId, 'REELS', query);
  }

  @Get('users/:userId/tagged')
  @ApiOkResponse({ type: PostPageDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  userTagged(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Query() query: CursorQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.userGrid(user.id, userId, 'TAGGED', query);
  }

  @Get('me/archive/posts')
  @ApiOkResponse({ type: PostPageDto })
  archive(@CurrentUser() user: SessionUser, @Query() query: CursorQueryDto): Promise<PostPageDto> {
    return this.posts.archive(user.id, query);
  }

  @Get('hashtags/:name/posts')
  @ApiOkResponse({ type: PostPageDto })
  @ApiNotFoundResponse({ description: 'Хэштег не найден' })
  hashtagPosts(
    @CurrentUser() user: SessionUser,
    @Param('name') name: string,
    @Query() query: PostsTabQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.hashtagPosts(user.id, name, query.tab, query);
  }

  @Get('locations/:locationId/posts')
  @ApiOkResponse({ type: PostPageDto })
  @ApiNotFoundResponse({ description: 'Место не найдено' })
  locationPosts(
    @CurrentUser() user: SessionUser,
    @Param('locationId', ParseUuidPipe) locationId: string,
    @Query() query: PostsTabQueryDto,
  ): Promise<PostPageDto> {
    return this.posts.locationPosts(user.id, locationId, query.tab, query);
  }
}
