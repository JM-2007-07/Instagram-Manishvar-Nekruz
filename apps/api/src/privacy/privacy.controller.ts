import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
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
import { BlocksService } from './blocks.service';

@ApiTags('privacy')
@Controller()
export class PrivacyController {
  constructor(private readonly blocks: BlocksService) {}

  @Put('users/:userId/block')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Заблокирован (повторный вызов тоже 204)' })
  @ApiBadRequestResponse({ description: 'Блокировка самого себя' })
  @ApiNotFoundResponse({ description: 'Нет такого пользователя' })
  block(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.blocks.block(user.id, userId);
  }

  @Delete('users/:userId/block')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Разблокирован (повторный вызов тоже 204)' })
  @ApiNotFoundResponse({ description: 'Нет такого пользователя' })
  unblock(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.blocks.unblock(user.id, userId);
  }

  @Get('me/blocked')
  @ApiOkResponse({ type: UserSummaryPageDto })
  listBlocked(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<UserSummaryPageDto> {
    return this.blocks.listBlocked(user.id, query);
  }
}
