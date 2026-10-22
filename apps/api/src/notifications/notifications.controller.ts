import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { BadgesDto, MarkReadDto, NotificationPageDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  @ApiOkResponse({ type: NotificationPageDto })
  list(
    @CurrentUser() user: SessionUser,
    @Query() query: CursorQueryDto,
  ): Promise<NotificationPageDto> {
    return this.notifications.list(user.id, query);
  }

  @Post('notifications/read')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Уведомления отмечены прочитанными' })
  async markRead(@CurrentUser() user: SessionUser, @Body() dto: MarkReadDto): Promise<void> {
    await this.notifications.markRead(user.id, dto.upToId);
  }

  @Get('me/badges')
  @ApiOkResponse({ type: BadgesDto })
  badges(@CurrentUser() user: SessionUser): Promise<BadgesDto> {
    return this.notifications.badges(user.id);
  }
}
