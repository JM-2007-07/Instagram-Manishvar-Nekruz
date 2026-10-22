import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseArrayPipe,
  Patch,
  Res,
} from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { validationExceptionFactory } from '@/common/validation';
import type { Env } from '@/config/env';
import { NotificationPreferenceDto, SettingsDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

// ParseArrayPipe передаёт в фабрику строку, если тело вообще не массив.
function bodyErrorFactory(errors: ValidationError[] | string): BadRequestException {
  if (typeof errors === 'string') {
    return new BadRequestException({ code: 'VALIDATION_ERROR', message: errors });
  }
  return validationExceptionFactory(errors);
}

const THEME_COOKIE = 'theme';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@ApiTags('settings')
@Controller('me')
export class SettingsController {
  private readonly isProduction: boolean;

  constructor(
    private readonly settings: SettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Get('settings')
  @ApiOkResponse({ type: SettingsDto })
  getSettings(@CurrentUser() user: SessionUser): Promise<SettingsDto> {
    return this.settings.getSettings(user.id);
  }

  @Patch('settings')
  @ApiOkResponse({ type: SettingsDto, description: 'Тема дублируется в cookie `theme`' })
  @ApiBadRequestResponse()
  async updateSettings(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateSettingsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SettingsDto> {
    const result = await this.settings.updateSettings(user.id, dto);
    if (dto.theme !== undefined) {
      // Cookie не HttpOnly: страница читает тему до первой отрисовки (Q-new-3). Значения: light, dark, system.
      res.cookie(THEME_COOKIE, result.theme.toLowerCase(), {
        httpOnly: false,
        sameSite: 'lax',
        secure: this.isProduction,
        path: '/',
        maxAge: YEAR_MS,
      });
    }
    return result;
  }

  @Get('notification-preferences')
  @ApiOkResponse({ type: [NotificationPreferenceDto] })
  getNotificationPreferences(
    @CurrentUser() user: SessionUser,
  ): Promise<NotificationPreferenceDto[]> {
    return this.settings.getNotificationPreferences(user.id);
  }

  @Patch('notification-preferences')
  @ApiBody({ type: [NotificationPreferenceDto] })
  @ApiOkResponse({ type: [NotificationPreferenceDto] })
  @ApiBadRequestResponse()
  updateNotificationPreferences(
    @CurrentUser() user: SessionUser,
    @Body(
      new ParseArrayPipe({
        items: NotificationPreferenceDto,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: bodyErrorFactory,
      }),
    )
    items: NotificationPreferenceDto[],
  ): Promise<NotificationPreferenceDto[]> {
    return this.settings.updateNotificationPreferences(user.id, items);
  }
}
