import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Res } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, hours } from '@nestjs/throttler';
import type { Response } from 'express';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { MeDto, ProfileDto } from './dto/me.dto';
import {
  ChangeEmailDto,
  ChangeUserNameDto,
  SetLinksDto,
  UpdateProfileDto,
  VerifyEmailChangeDto,
} from './dto/profile-requests.dto';
import { EmailChangeService } from './email-change.service';
import { ProfileService, UserNameRateLimitedException } from './profile.service';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
    private readonly emailChange: EmailChangeService,
  ) {}

  @Get('me')
  @ApiOkResponse({ type: MeDto, description: 'Текущий пользователь; также проверка сессии' })
  getMe(@CurrentUser() user: SessionUser): Promise<MeDto> {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ description: 'Неверные значения или лишние поля' })
  updateMe(@CurrentUser() user: SessionUser, @Body() dto: UpdateProfileDto): Promise<MeDto> {
    return this.profiles.updateProfile(user.id, dto);
  }

  @Put('me/username')
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Имя занято или закреплено за прежним владельцем' })
  @ApiTooManyRequestsResponse({ description: 'Больше 2 смен за 14 дней' })
  async changeUserName(
    @CurrentUser() user: SessionUser,
    @Body() dto: ChangeUserNameDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    try {
      return await this.profiles.changeUserName(user.id, dto);
    } catch (error) {
      if (error instanceof UserNameRateLimitedException) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }

  @Put('me/email')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @ApiAcceptedResponse({ description: 'Код отправлен на новый адрес' })
  @ApiBadRequestResponse({ description: 'Неверный пароль или тот же адрес' })
  @ApiConflictResponse({ description: 'Email занят' })
  @ApiTooManyRequestsResponse()
  requestEmailChange(@CurrentUser() user: SessionUser, @Body() dto: ChangeEmailDto): Promise<void> {
    return this.emailChange.requestEmailChange(user.id, dto);
  }

  @Post('me/email/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ description: 'VERIFICATION_CODE_INVALID' })
  @ApiConflictResponse({ description: 'Email уже занят' })
  @ApiTooManyRequestsResponse()
  verifyEmailChange(
    @CurrentUser() user: SessionUser,
    @Body() dto: VerifyEmailChangeDto,
  ): Promise<MeDto> {
    return this.emailChange.verifyEmailChange(user.id, dto);
  }

  @Put('me/links')
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'LIMIT_REACHED: больше 5 ссылок' })
  setLinks(@CurrentUser() user: SessionUser, @Body() dto: SetLinksDto): Promise<MeDto> {
    return this.profiles.setLinks(user.id, dto);
  }

  @Get('users/by-username/:userName')
  @ApiOkResponse({ type: ProfileDto })
  @ApiNotFoundResponse({ description: 'Нет такого пользователя или блокировка' })
  getByUserName(
    @CurrentUser() user: SessionUser,
    @Param('userName') userName: string,
  ): Promise<ProfileDto> {
    return this.profiles.getProfile(user.id, { userName: userName.toLowerCase() });
  }

  @Get('users/:userId')
  @ApiOkResponse({ type: ProfileDto })
  @ApiNotFoundResponse({ description: 'Нет такого пользователя или блокировка' })
  getById(
    @CurrentUser() user: SessionUser,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<ProfileDto> {
    return this.profiles.getProfile(user.id, { id: userId });
  }
}
