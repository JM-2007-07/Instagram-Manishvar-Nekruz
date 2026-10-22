import { Body, Controller, Delete, HttpCode, Post, Res } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { SessionService } from '@/common/session/session.service';
import { AccountService } from './account.service';
import { DeletionScheduledDto, PasswordConfirmDto } from './dto/account.dto';

const PER_15_MIN_5 = { default: { limit: 5, ttl: minutes(15) } };

@ApiTags('users')
@Controller()
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly sessions: SessionService,
  ) {}

  @Post('me/deactivate')
  @HttpCode(204)
  @Throttle(PER_15_MIN_5)
  @ApiNoContentResponse({ description: 'Аккаунт деактивирован, все сессии завершены' })
  @ApiBadRequestResponse({ description: 'INVALID_PASSWORD' })
  @ApiTooManyRequestsResponse()
  async deactivate(
    @CurrentUser() user: SessionUser,
    @Body() dto: PasswordConfirmDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.deactivate(user.id, dto.password);
    this.sessions.clearSessionCookie(res);
  }

  @Delete('me')
  @HttpCode(202)
  @Throttle(PER_15_MIN_5)
  @ApiAcceptedResponse({
    type: DeletionScheduledDto,
    description: 'Удаление через 30 дней, все сессии завершены; вход отменяет удаление',
  })
  @ApiBadRequestResponse({ description: 'INVALID_PASSWORD' })
  @ApiTooManyRequestsResponse()
  async requestDeletion(
    @CurrentUser() user: SessionUser,
    @Body() dto: PasswordConfirmDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeletionScheduledDto> {
    const result = await this.account.requestDeletion(user.id, dto.password);
    this.sessions.clearSessionCookie(res);
    return result;
  }
}
