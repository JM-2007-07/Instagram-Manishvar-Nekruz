import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from './session.service';
import type { AuthenticatedRequest } from './session-user';

// Глобальный guard: без действующей сессии любой маршрут, кроме @Public(), отвечает 401.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest & { cookies?: Record<string, unknown> }>();
    const token: unknown = req.cookies?.[this.sessions.cookie];
    if (typeof token !== 'string' || token === '') throw new UnauthorizedException();

    const user = await this.sessions.validate(token, http.getResponse<Response>());
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}
