import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

// Все переменные окружения, которые нужны приложению. Остальные из .env.example добавляют модули по мере появления.
export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // Единственный origin браузера: для проверки Origin (CSRF) и Socket.IO. Без завершающего «/».
  // Только origin: схема + хост (+ порт), без пути
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  WEB_ORIGIN!: string;

  @IsString()
  @IsNotEmpty()
  SESSION_COOKIE_NAME!: string;

  @IsInt()
  @Min(1)
  SESSION_IDLE_TTL_DAYS!: number;

  @IsInt()
  @Min(1)
  SESSION_ABSOLUTE_TTL_DAYS!: number;

  @IsInt()
  @Min(1)
  PASSWORD_RESET_TTL_MINUTES!: number;

  @IsIn(['log', 'smtp'])
  MAIL_DRIVER!: 'log' | 'smtp';

  @IsString()
  @IsNotEmpty()
  APP_NAME!: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM!: string;
}

// Значения по умолчанию для разработки (совпадают с .env.example). DATABASE_URL по умолчанию нет намеренно.
const defaults = {
  NODE_ENV: 'development',
  PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  SESSION_COOKIE_NAME: 'sid',
  SESSION_IDLE_TTL_DAYS: 7,
  SESSION_ABSOLUTE_TTL_DAYS: 30,
  PASSWORD_RESET_TTL_MINUTES: 30,
  MAIL_DRIVER: 'log',
  APP_NAME: 'Photogram',
  MAIL_FROM: 'no-reply@example.com',
};

// Вызывается ConfigModule при старте: неверная настройка = приложение не запускается, с понятной ошибкой.
export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, { ...defaults, ...raw }, { enableImplicitConversion: true });
  const errors = validateSync(env);
  if (errors.length > 0) {
    const lines = errors.map(
      (e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  env.WEB_ORIGIN = env.WEB_ORIGIN.replace(/\/+$/, ''); // завершающий «/» не ошибка, просто убираем
  const problems = [...checkDatabaseUrl(env.DATABASE_URL), ...checkWebOrigin(env.WEB_ORIGIN)];
  if (env.NODE_ENV === 'production' && env.MAIL_DRIVER === 'log') {
    problems.push('MAIL_DRIVER: "log" is not allowed in production');
  }
  // В production cookie обязана иметь префикс __Host- (AUTHENTICATION.md §2).
  if (env.NODE_ENV === 'production' && !env.SESSION_COOKIE_NAME.startsWith('__Host-')) {
    problems.push('SESSION_COOKIE_NAME: must start with "__Host-" in production');
  }
  // Иначе cookie проживёт дольше самой сессии.
  if (env.SESSION_IDLE_TTL_DAYS > env.SESSION_ABSOLUTE_TTL_DAYS) {
    problems.push('SESSION_IDLE_TTL_DAYS: must not exceed SESSION_ABSOLUTE_TTL_DAYS');
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return env;
}

// Значение DATABASE_URL в сообщение не попадает: в нём пароль.
function checkDatabaseUrl(value: string): string[] {
  try {
    const { protocol } = new URL(value);
    if (protocol === 'postgres:' || protocol === 'postgresql:') return [];
  } catch {
    // сообщение ниже
  }
  return ['DATABASE_URL: must be a valid postgres:// or postgresql:// URL'];
}

// WEB_ORIGIN сравнивается с заголовком Origin строка в строку, поэтому путь и «/» на конце недопустимы.
function checkWebOrigin(value: string): string[] {
  try {
    if (new URL(value).origin === value) return [];
  } catch {
    // сообщение ниже
  }
  return ['WEB_ORIGIN: must be an origin like http://localhost:3000 (no path)'];
}
