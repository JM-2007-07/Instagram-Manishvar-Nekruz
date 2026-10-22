import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  PipeTransform,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { SessionService, type SessionMeta } from '@/common/session/session.service';
import type { Env } from '@/config/env';
import { MeDto } from '@/users/dto/me.dto';
import { OAUTH_PROVIDERS, type OAuthProviderName } from './oauth.client';
import { CompleteOAuthDto, OAuthProvidersDto } from './oauth.dto';
import { OAUTH_PENDING_COOKIE, OAUTH_TX_COOKIE, OAuthService } from './oauth.service';

// Неизвестный провайдер = 404, как выключенный.
const parseProvider: PipeTransform<string, OAuthProviderName> = {
  transform(value: string): OAuthProviderName {
    if ((OAUTH_PROVIDERS as string[]).includes(value)) return value as OAuthProviderName;
    throw new NotFoundException();
  },
};

const OAUTH_LIMIT = { default: { limit: 20, ttl: minutes(15) } };

@ApiTags('auth')
@Controller()
export class OAuthController {
  private readonly webOrigin: string;

  constructor(
    private readonly oauth: OAuthService,
    private readonly sessions: SessionService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  @Public()
  @Get('auth/oauth/providers')
  @ApiOkResponse({ type: OAuthProvidersDto, description: 'Какие провайдеры включены ключами' })
  providers(): OAuthProvidersDto {
    return this.oauth.providers();
  }

  @Public()
  @Get('auth/oauth/:provider')
  @Throttle(OAUTH_LIMIT)
  @ApiFoundResponse({ description: 'Редирект к провайдеру (PKCE, state в короткой cookie)' })
  @ApiNotFoundResponse({ description: 'Провайдер выключен' })
  start(@Param('provider', parseProvider) provider: OAuthProviderName, @Res() res: Response): void {
    res.redirect(302, this.oauth.start(provider, res));
  }

  @Public()
  @Get('auth/oauth/:provider/callback')
  @Throttle(OAUTH_LIMIT)
  @ApiFoundResponse({
    description: 'Редирект: `/` (вход), `/accounts/oauth/complete/` или `?error=oauth`',
  })
  @ApiNotFoundResponse({ description: 'Провайдер выключен' })
  async callback(
    @Param('provider', parseProvider) provider: OAuthProviderName,
    @Query() query: { code?: unknown; state?: unknown; error?: unknown },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const result = await this.oauth.callback(
      provider,
      query,
      cookies?.[OAUTH_TX_COOKIE],
      sessionMeta(req),
    );
    this.oauth.clearTxCookie(res);
    if (result.kind === 'signed-in') {
      this.sessions.setSessionCookie(res, result.token);
      res.redirect(302, `${this.webOrigin}/`);
    } else if (result.kind === 'complete') {
      this.oauth.setPendingCookie(res, result.pendingToken);
      res.redirect(302, `${this.webOrigin}/accounts/oauth/complete/`);
    } else {
      res.redirect(302, `${this.webOrigin}/accounts/login/?error=oauth`);
    }
  }

  @Public()
  @Post('auth/oauth/complete')
  @Throttle(OAUTH_LIMIT)
  @ApiCreatedResponse({ type: MeDto, description: 'Аккаунт создан, cookie сессии установлена' })
  @ApiBadRequestResponse({ description: 'Нет или истёк незавершённый вход; неверные данные' })
  @ApiConflictResponse({ description: 'Имя пользователя занято' })
  async complete(
    @Body() dto: CompleteOAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeDto> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const { token, me } = await this.oauth.complete(
      dto,
      cookies?.[OAUTH_PENDING_COOKIE],
      sessionMeta(req),
    );
    this.oauth.clearOAuthCookies(res);
    this.sessions.setSessionCookie(res, token);
    return me;
  }

  @Delete('me/oauth/:provider')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Провайдер отвязан' })
  @ApiNotFoundResponse({ description: 'Провайдер не привязан' })
  @ApiConflictResponse({ description: 'LIMIT_REACHED: это единственный способ входа' })
  unlink(
    @CurrentUser() user: SessionUser,
    @Param('provider', parseProvider) provider: OAuthProviderName,
  ): Promise<void> {
    return this.oauth.unlink(user.id, provider);
  }
}

function sessionMeta(req: Request): SessionMeta {
  const userAgent = req.headers['user-agent'];
  return { ipAddress: req.ip ?? null, userAgent: userAgent ? userAgent.slice(0, 255) : null };
}
