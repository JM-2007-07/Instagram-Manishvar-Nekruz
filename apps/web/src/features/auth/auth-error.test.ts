import { describe, expect, it } from 'vitest';
import { authErrorText } from './auth-error';
import { isUserNameFormatValid, toBirthday } from './validation';

const apiError = (status: number, code: string, extra = {}) => ({
  status,
  data: { statusCode: status, code, message: 'x' },
  ...extra,
});

describe('authErrorText', () => {
  it('неверный логин или пароль', () => {
    expect(authErrorText(apiError(401, 'INVALID_CREDENTIALS'))).toBe('Неверный логин или пароль');
  });
  it('429 использует Retry-After', () => {
    expect(authErrorText(apiError(429, 'RATE_LIMITED', { retryAfter: '30' }))).toBe(
      'Повторите попытку через 30 с',
    );
    expect(authErrorText(apiError(429, 'RATE_LIMITED', { retryAfter: '120' }))).toBe(
      'Повторите попытку через 2 мин',
    );
    expect(authErrorText(apiError(429, 'RATE_LIMITED'))).toBe(
      'Повторите попытку через несколько минут',
    );
  });
  it('неверный код', () => {
    expect(authErrorText(apiError(400, 'VERIFICATION_CODE_INVALID'))).toBe(
      'Код неверный. Повторите попытку',
    );
  });
});

describe('validation', () => {
  it('формат имени пользователя', () => {
    expect(isUserNameFormatValid('ivan.petrov_1')).toBe(true);
    expect(isUserNameFormatValid('Ivan')).toBe(false);
    expect(isUserNameFormatValid('a..b')).toBe(false);
    expect(isUserNameFormatValid('.ab')).toBe(false);
    expect(isUserNameFormatValid('')).toBe(false);
  });
  it('дата рождения', () => {
    expect(toBirthday('2000', '1', '5')).toBe('2000-01-05');
    expect(toBirthday('2000', '', '5')).toBe('');
  });
});
