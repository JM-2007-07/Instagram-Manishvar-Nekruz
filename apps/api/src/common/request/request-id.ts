import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { requestId?: string };

// Свой id на каждый запрос: попадает в поле requestId ошибки и заголовок X-Request-Id, чтобы находить запрос в логах.
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
