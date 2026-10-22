import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { CloseFriendsService } from './close-friends.service';
import { UserSummaryPageDto } from './dto/follows.dto';

@ApiTags('follows')
@Controller()
export class CloseFriendsController {
  constructor(private readonly closeFriends: CloseFriendsService) {}

  @Get('me/close-friends')
  @ApiOkResponse({ type: UserSummaryPageDto })
  listCloseFriends(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<UserSummaryPageDto> {
    return this.closeFriends.listCloseFriends(user.id, query);
  }

  @Put('me/close-friends/:userId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Добавлен (повторный вызов тоже 204)' })
  @ApiBadRequestResponse({ description: 'Добавление самого себя' })
  @ApiNotFoundResponse()
  addCloseFriend(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.closeFriends.addCloseFriend(user.id, userId);
  }

  @Delete('me/close-friends/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeCloseFriend(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.closeFriends.removeCloseFriend(user.id, userId);
  }

  @Get('me/favorite-accounts')
  @ApiOkResponse({ type: [UserSummaryDto] })
  listFavorites(@CurrentUser() user: SessionUser): Promise<UserSummaryDto[]> {
    return this.closeFriends.listFavorites(user.id);
  }

  @Put('me/favorite-accounts/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Добавление самого себя' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'LIMIT_REACHED: больше 50 избранных' })
  addFavorite(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.closeFriends.addFavorite(user.id, userId);
  }

  @Delete('me/favorite-accounts/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeFavorite(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.closeFriends.removeFavorite(user.id, userId);
  }
}
