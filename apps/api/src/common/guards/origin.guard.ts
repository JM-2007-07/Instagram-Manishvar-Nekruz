import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '@/config/env';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Защита от CSRF (SECURITY.md): изменяющий запрос обязан прийти с Origin = WEB_ORIGIN.
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!UNSAFE_METHODS.has(req.method)) return true;

    const fetchSite = req.headers['sec-fetch-site'];
    const crossSite = typeof fetchSite === 'string' && fetchSite !== 'same-origin';
    if (req.headers.origin !== this.allowedOrigin || crossSite) {
      throw new ForbiddenException({ code: 'CSRF_REJECTED', message: 'Origin is not allowed' });
    }
    return true;
  }
}
