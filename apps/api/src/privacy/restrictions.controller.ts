import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { UserSummaryPageDto } from '@/follows/dto/follows.dto';
import { HiddenWordsDto, MuteDto, MutedUserPageDto } from './dto/privacy.dto';
import { RestrictionsService } from './restrictions.service';

@ApiTags('privacy')
@Controller()
export class RestrictionsController {
  constructor(private readonly restrictions: RestrictionsService) {}

  @Put('users/:userId/restrict')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Ограничен (повторный вызов тоже 204)' })
  @ApiBadRequestResponse({ description: 'Ограничение самого себя' })
  @ApiNotFoundResponse()
  restrict(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.restrictions.restrict(user.id, userId);
  }

  @Delete('users/:userId/restrict')
  @HttpCode(204)
  @ApiNoContentResponse()
  unrestrict(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.restrictions.unrestrict(user.id, userId);
  }

  @Get('me/restricted')
  @ApiOkResponse({ type: UserSummaryPageDto })
  listRestricted(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<UserSummaryPageDto> {
    return this.restrictions.listRestricted(user.id, query);
  }

  @Put('users/:userId/mute')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Скрытие сохранено; posts=false и stories=false — выключено',
  })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  mute(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
    @Body() dto: MuteDto,
  ): Promise<void> {
    return this.restrictions.mute(user.id, userId, dto);
  }

  @Delete('users/:userId/mute')
  @HttpCode(204)
  @ApiNoContentResponse()
  unmute(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.restrictions.unmute(user.id, userId);
  }

  @Get('me/muted')
  @ApiOkResponse({ type: MutedUserPageDto })
  listMuted(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<MutedUserPageDto> {
    return this.restrictions.listMuted(user.id, query);
  }

  @Get('me/story-hidden-from')
  @ApiOkResponse({ type: UserSummaryPageDto })
  listStoryHiddenFrom(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<UserSummaryPageDto> {
    return this.restrictions.listStoryHiddenFrom(user.id, query);
  }

  @Put('me/story-hidden-from/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  hideStoryFrom(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.restrictions.hideStoryFrom(user.id, userId);
  }

  @Delete('me/story-hidden-from/:userId')
  @HttpCode(204)
  @ApiNoContentResponse()
  unhideStoryFrom(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.restrictions.unhideStoryFrom(user.id, userId);
  }

  @Get('me/hidden-words')
  @ApiOkResponse({ type: HiddenWordsDto })
  getHiddenWords(@CurrentUser() user: SessionUser): Promise<HiddenWordsDto> {
    return this.restrictions.getHiddenWords(user.id);
  }

  @Put('me/hidden-words')
  @ApiOkResponse({ type: HiddenWordsDto })
  @ApiBadRequestResponse()
  setHiddenWords(
    @CurrentUser() user: SessionUser,
    @Body() dto: HiddenWordsDto,
  ): Promise<HiddenWordsDto> {
    return this.restrictions.setHiddenWords(user.id, dto);
  }
}
