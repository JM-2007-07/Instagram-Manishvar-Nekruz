import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, SessionUser } from './session-user';

// Текущий пользователь из сессии. Никогда не берём id из body/query.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      // Сюда попадаем только на @Public() маршруте, где @CurrentUser() использовать нельзя.
      throw new UnauthorizedException();
    }
    return user;
  },
);
