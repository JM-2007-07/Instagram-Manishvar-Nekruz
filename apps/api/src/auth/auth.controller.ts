import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, hours, minutes } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { SessionService, type SessionMeta } from '@/common/session/session.service';
import { HOURLY } from '@/common/throttler/app-throttler';
import { MeDto } from '@/users/dto/me.dto';
import { AuthService } from './auth.service';
import { ipAndLogin } from './auth.throttle';
import {
  ChangePasswordDto,
  EmailDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RegisterResponseDto,
  ResetPasswordDto,
  SessionDto,
  UserNameAvailabilityDto,
  UserNameAvailabilityQueryDto,
  VerifyEmailDto,
} from './dto/auth.dto';

// Лимиты чувствительных операций — SECURITY.md «Ограничение частоты запросов».
const PER_HOUR_5 = { default: { limit: 5, ttl: hours(1) } };
const PER_15_MIN_5 = { default: { limit: 5, ttl: minutes(15) } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Get('username-availability')
  @ApiOkResponse({ type: UserNameAvailabilityDto })
  @ApiBadRequestResponse({ description: 'Неверный формат имени' })
  usernameAvailability(
    @Query() query: UserNameAvailabilityQueryDto,
  ): Promise<UserNameAvailabilityDto> {
    return this.auth.checkUserName(query.userName);
  }

  @Public()
  @Post('register')
  @Throttle(PER_HOUR_5)
  @ApiCreatedResponse({ type: RegisterResponseDto, description: 'Код отправлен письмом' })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Имя пользователя или email заняты' })
  @ApiTooManyRequestsResponse()
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('register/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @ApiOkResponse({ type: MeDto, description: 'Email подтверждён, cookie сессии установлена' })
  @ApiBadRequestResponse({ description: 'VERIFICATION_CODE_INVALID' })
  @ApiTooManyRequestsResponse()
  async verify(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const { token, me } = await this.auth.verifyEmail(dto, sessionMeta(req));
    this.sessions.setSessionCookie(res, token);
    return me;
  }

  @Public()
  @Post('register/resend-code')
  @HttpCode(202)
  @Throttle(PER_HOUR_5)
  @ApiAcceptedResponse({ description: 'Всегда 202, даже если email неизвестен' })
  @ApiTooManyRequestsResponse()
  resendCode(@Body() dto: EmailDto): Promise<void> {
    return this.auth.resendCode(dto.email);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({
    default: { limit: 5, ttl: minutes(1), getTracker: ipAndLogin },
    [HOURLY]: { limit: 20, ttl: hours(1), getTracker: ipAndLogin },
  })
  @ApiOkResponse({ type: MeDto, description: 'Cookie сессии установлена' })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS' })
  @ApiForbiddenResponse({ description: 'EMAIL_NOT_VERIFIED или аккаунт заблокирован' })
  @ApiTooManyRequestsResponse()
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const { token, me } = await this.auth.login(dto, sessionMeta(req));
    this.sessions.setSessionCookie(res, token);
    return me;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Сессия завершена, cookie удалена' })
  async logout(
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user.sessionId);
    this.sessions.clearSessionCookie(res);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: hours(1), getTracker: ipAndLogin } })
  @ApiAcceptedResponse({ description: 'Всегда 202, даже если аккаунта нет' })
  @ApiTooManyRequestsResponse()
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  @Throttle(PER_15_MIN_5)
  @ApiNoContentResponse({ description: 'Пароль изменён, все сессии завершены' })
  @ApiBadRequestResponse({ description: 'Ссылка недействительна или слабый пароль' })
  @ApiTooManyRequestsResponse()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto);
  }

  @Post('password/change')
  @HttpCode(204)
  @Throttle(PER_15_MIN_5)
  @ApiNoContentResponse({ description: 'Пароль изменён, остальные сессии завершены' })
  @ApiBadRequestResponse({ description: 'Неверный текущий пароль или слабый новый' })
  @ApiTooManyRequestsResponse()
  changePassword(@CurrentUser() user: SessionUser, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.auth.changePassword(user.id, user.sessionId, dto);
  }

  @Get('sessions')
  @ApiOkResponse({ type: [SessionDto] })
  listSessions(@CurrentUser() user: SessionUser): Promise<SessionDto[]> {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Сессия не найдена или принадлежит другому пользователю' })
  async revokeSession(
    @CurrentUser() user: SessionUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const wasCurrent = await this.auth.revokeSession(user.id, sessionId, user.sessionId);
    if (wasCurrent) this.sessions.clearSessionCookie(res);
  }
}

// IP и браузер для списка «Где вы вошли». userAgent обрезаем, чтобы не копить мусор в БД.
function sessionMeta(req: Request): SessionMeta {
  const userAgent = req.headers['user-agent'];
  return { ipAddress: req.ip ?? null, userAgent: userAgent ? userAgent.slice(0, 255) : null };
}
