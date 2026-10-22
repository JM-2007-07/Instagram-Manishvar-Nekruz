import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import {
  HighlightCreateDto,
  HighlightDto,
  HighlightStoriesDto,
  HighlightUpdateDto,
  HighlightWithStoriesDto,
} from './dto/stories.dto';
import { HighlightsService } from './highlights.service';

@ApiTags('highlights')
@Controller()
export class HighlightsController {
  constructor(private readonly highlights: HighlightsService) {}

  @Get('users/:userId/highlights')
  @ApiOkResponse({ type: [HighlightDto] })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  byUser(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<HighlightDto[]> {
    return this.highlights.listByUser(user.id, userId);
  }

  @Get('highlights/:highlightId')
  @ApiOkResponse({ type: HighlightWithStoriesDto })
  @ApiForbiddenResponse({ description: 'PRIVATE_ACCOUNT' })
  @ApiNotFoundResponse()
  get(
    @CurrentUser() user: SessionUser,
    @Param('highlightId', ParseUuidPipe) highlightId: string,
  ): Promise<HighlightWithStoriesDto> {
    return this.highlights.getById(user.id, highlightId);
  }

  @Post('highlights')
  @ApiCreatedResponse({ type: HighlightDto })
  @ApiBadRequestResponse({ description: 'Не свои истории' })
  create(@CurrentUser() user: SessionUser, @Body() dto: HighlightCreateDto): Promise<HighlightDto> {
    return this.highlights.create(user, dto);
  }

  @Patch('highlights/:highlightId')
  @ApiOkResponse({ type: HighlightDto })
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: SessionUser,
    @Param('highlightId', ParseUuidPipe) highlightId: string,
    @Body() dto: HighlightUpdateDto,
  ): Promise<HighlightDto> {
    return this.highlights.update(user, highlightId, dto);
  }

  @Put('highlights/:highlightId/stories')
  @ApiOkResponse({ type: HighlightDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  setStories(
    @CurrentUser() user: SessionUser,
    @Param('highlightId', ParseUuidPipe) highlightId: string,
    @Body() dto: HighlightStoriesDto,
  ): Promise<HighlightDto> {
    return this.highlights.setStories(user, highlightId, dto.storyIds);
  }

  @Delete('highlights/:highlightId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: SessionUser,
    @Param('highlightId', ParseUuidPipe) highlightId: string,
  ): Promise<void> {
    return this.highlights.remove(user, highlightId);
  }
}
