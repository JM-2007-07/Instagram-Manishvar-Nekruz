import { toast } from 'sonner';
import type { ApiErrorBody } from './types';

/** Нормализованная ошибка: всегда есть status, code и message. */
export type ApiError = {
  status: number | null; // null — ответа не было
  code: string;
  message: string;
  details?: ApiErrorBody['details'];
};

/** Форма, в которую можно записать ошибку поля (совместима с react-hook-form). */
export type FormErrorTarget = {
  setError(name: string, error: { message: string }): void;
};

function isBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' && data !== null && typeof (data as ApiErrorBody).code === 'string'
  );
}

// Ошибка RTK Query (FetchBaseQueryError или SerializedError) → ApiError.
export function getApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status, data } = error as { status: unknown; data?: unknown };
    if (typeof status === 'number') {
      if (isBody(data)) {
        return { status, code: data.code, message: data.message, details: data.details };
      }
      return { status, code: 'INTERNAL_ERROR', message: 'Unexpected error response' };
    }
    if (status === 'FETCH_ERROR') {
      return { status: null, code: 'NETWORK_ERROR', message: 'Network error' };
    }
    if (status === 'PARSING_ERROR') {
      return { status: null, code: 'PARSING_ERROR', message: 'Invalid server response' };
    }
  }
  // SerializedError ({ message }) и всё неизвестное
  const message = (error as { message?: string } | null)?.message;
  return { status: null, code: 'UNKNOWN_ERROR', message: message ?? 'Unknown error' };
}

// Тексты для пользователя по code (черновик, уточняется на ревью).
const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Проверьте введённые данные',
  BAD_REQUEST: 'Это действие недоступно',
  VERIFICATION_CODE_INVALID: 'Неверный или просроченный код',
  OAUTH_FAILED: 'Не удалось войти через внешний сервис',
  UNAUTHENTICATED: 'Войдите в аккаунт, чтобы продолжить',
  INVALID_CREDENTIALS: 'Неверный логин или пароль',
  EMAIL_NOT_VERIFIED: 'Подтвердите email, чтобы войти',
  FORBIDDEN: 'Недостаточно прав для этого действия',
  PRIVATE_ACCOUNT: 'Это закрытый аккаунт',
  CSRF_REJECTED: 'Запрос отклонён. Обновите страницу и попробуйте снова',
  NOT_FOUND: 'Не найдено',
  CONFLICT: 'Такое значение уже занято',
  EDIT_WINDOW_EXPIRED: 'Время для редактирования истекло',
  LIMIT_REACHED: 'Достигнут лимит',
  CALL_BUSY: 'Собеседник сейчас в другом звонке. Попробуйте позже',
  MEDIA_NOT_READY: 'Файл ещё обрабатывается',
  MEDIA_FAILED: 'Не удалось обработать видео',
  MEDIA_TIMEOUT: 'Обработка видео занимает слишком долго. Попробуйте ещё раз',
  PAYLOAD_TOO_LARGE: 'Файл слишком большой',
  UNSUPPORTED_MEDIA_TYPE: 'Этот тип файла не поддерживается',
  RATE_LIMITED: 'Слишком много запросов. Попробуйте позже',
  INTERNAL_ERROR: 'Что-то пошло не так. Попробуйте позже',
  NETWORK_ERROR: 'Нет соединения с сервером',
};
const DEFAULT_MESSAGE = 'Что-то пошло не так. Попробуйте позже';

export function getErrorText(code: string): string {
  return MESSAGES[code] ?? DEFAULT_MESSAGE;
}

// Ошибки полей (VALIDATION_ERROR.details) — в форму; остальное — toast.
export function showApiError(error: unknown, form?: FormErrorTarget): void {
  const apiError = getApiError(error);
  if (form && apiError.code === 'VALIDATION_ERROR' && apiError.details?.length) {
    for (const { field, message } of apiError.details) form.setError(field, { message });
    return;
  }
  toast.error(getErrorText(apiError.code));
}
