import { getApiError, getErrorText } from '@/lib/api/errors';

// Секунды из Retry-After → «через N мин» / «через N с».
function waitText(retryAfter: string | undefined): string {
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Повторите попытку через несколько минут';
  if (seconds < 60) return `Повторите попытку через ${Math.ceil(seconds)} с`;
  return `Повторите попытку через ${Math.ceil(seconds / 60)} мин`;
}

// Текст ошибки для форм входа. Серверная ошибка — источник истины, здесь только перевод в текст.
export function authErrorText(error: unknown): string {
  const apiError = getApiError(error);
  if (apiError.status === 429) {
    return waitText((error as { retryAfter?: string } | undefined)?.retryAfter);
  }
  if (apiError.code === 'VERIFICATION_CODE_INVALID') return 'Код неверный. Повторите попытку';
  if (apiError.code === 'VALIDATION_ERROR' && apiError.status === 400) {
    return 'Ссылка устарела или данные неверны. Запросите ссылку ещё раз';
  }
  return getErrorText(apiError.code);
}
