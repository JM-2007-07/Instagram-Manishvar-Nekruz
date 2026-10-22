import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';

// Ключ лимита для входа и «забыли пароль»: IP + login (SECURITY.md). Guard срабатывает до валидации,
// поэтому тело проверяем сами.
export const ipAndLogin: ThrottlerGetTrackerFunction = (req) => {
  const body = req.body as { login?: unknown } | undefined;
  const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
  return `${String(req.ip)}:${login}`;
};
