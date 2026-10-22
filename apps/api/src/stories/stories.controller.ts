import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, hours } from '@nestjs/throttler';
import { MessageDto } from '@/chats/dto/chats.dto';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import {
  CreateStoryDto,
  ReactStoryDto,
  ReplyStoryDto,
  StickerResponseDto,
  StickerResponsesPageDto,
  StoryDto,
  StoryPageDto,
  StoryTrayItemDto,
  StoryViewerPageDto,
} from './dto/stories.dto';
import { StoriesService } from './stories.service';

@ApiTags('stories')
@Controller()
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get('stories/tray')
  @ApiOkResponse({
    type: [StoryTrayItemDto],
    description: 'Свои первыми, затем с непросмотренными',
  })
  tray(@CurrentUser() user: SessionUser): Promise<StoryTrayItemDto[]> {
    return this.stories.tray(user.id);
  }

  @Get('me/archive/stories')
  @ApiOkResponse({ type: StoryPageDto, description: 'Свои истории, включая истёкшие' })
  archive(@CurrentUser() user: SessionUser, @Query() query: CursorQueryDto): Promise<StoryPageDto> {
    return this.stories.archive(user.id, query);
  }

  @Get('users/:userId/stories')
  @ApiOkResponse({ type: [StoryDto], description: 'Активные истории, видимые зрителю' })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  byUser(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<StoryDto[]> {
    return this.stories.listByUser(user.id, userId);
  }

  @Post('stories')
  @Throttle({ default: { limit: 25, ttl: hours(1) } })
  @ApiCreatedResponse({ type: StoryDto })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse({ description: 'Автор поста запретил делиться в истории' })
  @ApiConflictResponse({ description: 'MEDIA_NOT_READY / MEDIA_ALREADY_USED' })
  @ApiTooManyRequestsResponse()
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateStoryDto): Promise<StoryDto> {
    return this.stories.create(user, dto);
  }

  @Get('stories/:storyId')
  @ApiOkResponse({ type: StoryDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse({ description: 'Нет, истекла, не та аудитория или блокировка' })
  get(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
  ): Promise<StoryDto> {
    return this.stories.getById(user.id, storyId);
  }

  @Delete('stories/:storyId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
  ): Promise<void> {
    return this.stories.remove(user, storyId);
  }

  @Put('stories/:storyId/view')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Идемпотентно; автор — без записи' })
  @ApiNotFoundResponse()
  view(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
  ): Promise<void> {
    return this.stories.markViewed(user.id, storyId);
  }

  @Put('stories/:storyId/like')
  @Throttle({ default: { limit: 300, ttl: hours(1) } })
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  like(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
  ): Promise<void> {
    return this.stories.like(user.id, storyId);
  }

  @Delete('stories/:storyId/like')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  unlike(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
  ): Promise<void> {
    return this.stories.unlike(user.id, storyId);
  }

  @Get('stories/:storyId/viewers')
  @ApiOkResponse({ type: StoryViewerPageDto })
  @ApiNotFoundResponse({ description: 'Не автор' })
  viewers(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
    @Query() query: CursorQueryDto,
  ): Promise<StoryViewerPageDto> {
    return this.stories.viewers(user, storyId, query);
  }

  @Post('stories/:storyId/reply')
  @Throttle({ default: { limit: 60, ttl: hours(1) } })
  @ApiCreatedResponse({ type: MessageDto, description: 'Сообщение в личном чате с автором' })
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  reply(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
    @Body() dto: ReplyStoryDto,
  ): Promise<MessageDto> {
    return this.stories.reply(user, storyId, dto.text);
  }

  @Post('stories/:storyId/reactions')
  @Throttle({ default: { limit: 120, ttl: hours(1) } })
  @ApiCreatedResponse({ type: MessageDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  react(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
    @Body() dto: ReactStoryDto,
  ): Promise<MessageDto> {
    return this.stories.react(user, storyId, dto.emoji);
  }

  @Put('stories/:storyId/stickers/:stickerId/response')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  respond(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
    @Param('stickerId', ParseUuidPipe) stickerId: string,
    @Body() dto: StickerResponseDto,
  ): Promise<void> {
    return this.stories.respondToSticker(user, storyId, stickerId, dto.value);
  }

  @Get('stories/:storyId/stickers/:stickerId/responses')
  @ApiOkResponse({ type: StickerResponsesPageDto })
  @ApiNotFoundResponse({ description: 'Не автор' })
  responses(
    @CurrentUser() user: SessionUser,
    @Param('storyId', ParseUuidPipe) storyId: string,
    @Param('stickerId', ParseUuidPipe) stickerId: string,
    @Query() query: CursorQueryDto,
  ): Promise<StickerResponsesPageDto> {
    return this.stories.stickerResponses(user, storyId, stickerId, query);
  }
}
