import type { Request } from 'express';
import type { UserRole } from '@/generated/prisma/client';

// Текущий пользователь, которого SessionGuard кладёт в запрос. Читается только через @CurrentUser().
export interface SessionUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { user?: SessionUser };
