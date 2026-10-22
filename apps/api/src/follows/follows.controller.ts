import { Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, hours } from '@nestjs/throttler';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import {
  FollowListPageDto,
  FollowListQueryDto,
  FollowRequestPageDto,
  FollowResultDto,
  SuggestionDto,
  SuggestionsQueryDto,
  UserSummaryPageDto,
} from './dto/follows.dto';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@Controller()
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  // Должен стоять раньше маршрутов с :userId (FollowsModule подключён в AppModule раньше UsersModule).
  @Get('users/suggestions')
  @ApiOkResponse({ type: [SuggestionDto] })
  suggestions(
    @CurrentUser() user: SessionUser,
    @Query() query: SuggestionsQueryDto,
  ): Promise<SuggestionDto[]> {
    return this.follows.suggestions(user.id, query.limit);
  }

  @Put('users/:userId/follow')
  @Throttle({ default: { limit: 60, ttl: hours(1) } })
  @ApiOkResponse({
    type: FollowResultDto,
    description: 'ACCEPTED — открытый аккаунт, PENDING — закрытый',
  })
  @ApiBadRequestResponse({ description: 'Подписка на себя' })
  @ApiNotFoundResponse({ description: 'Нет такого пользователя или блокировка' })
  @ApiTooManyRequestsResponse({ description: 'Больше 60 подписок в час' })
  follow(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<FollowResultDto> {
    return this.follows.follow(user.id, userId);
  }

  @Delete('users/:userId/follow')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Отписка или отмена запроса (повторный вызов тоже 204)' })
  @ApiNotFoundResponse()
  unfollow(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.follows.unfollow(user.id, userId);
  }

  @Get('users/:userId/followers')
  @ApiOkResponse({ type: FollowListPageDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  listFollowers(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Query() query: FollowListQueryDto,
  ): Promise<FollowListPageDto> {
    return this.follows.listFollowers(user.id, userId, query);
  }

  @Get('users/:userId/following')
  @ApiOkResponse({ type: FollowListPageDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  listFollowing(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Query() query: FollowListQueryDto,
  ): Promise<FollowListPageDto> {
    return this.follows.listFollowing(user.id, userId, query);
  }

  @Get('users/:userId/mutual-followers')
  @ApiOkResponse({ type: UserSummaryPageDto })
  @ApiNotFoundResponse()
  listMutualFollowers(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Query() query: CursorQueryDto,
  ): Promise<UserSummaryPageDto> {
    return this.follows.listMutualFollowers(user.id, userId, query);
  }

  @Delete('me/followers/:userId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Подписчик удалён без уведомления' })
  @ApiNotFoundResponse({ description: 'Этот пользователь не ваш подписчик' })
  removeFollower(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.follows.removeFollower(user.id, userId);
  }

  @Get('me/follow-requests')
  @ApiOkResponse({ type: FollowRequestPageDto })
  listRequests(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<FollowRequestPageDto> {
    return this.follows.listRequests(user.id, query);
  }

  @Post('me/follow-requests/:userId/accept')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Нет такого запроса' })
  acceptRequest(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.follows.acceptRequest(user.id, userId);
  }

  @Delete('me/follow-requests/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Нет такого запроса' })
  rejectRequest(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.follows.rejectRequest(user.id, userId);
  }
}
