import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { getApiError, getErrorText, showApiError } from './errors';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('getApiError', () => {
  it('разбирает тело ошибки по API_CONTRACT §1.2', () => {
    const details = [{ field: 'email', message: 'Некорректный email' }];
    const error = {
      status: 400,
      data: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Bad data', details },
    };
    expect(getApiError(error)).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Bad data',
      details,
    });
  });

  it('HTTP-статус без тела §1.2 даёт INTERNAL_ERROR', () => {
    expect(getApiError({ status: 502, data: '<html>Bad gateway</html>' })).toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
    });
    expect(getApiError({ status: 500 })).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });

  it('FETCH_ERROR даёт NETWORK_ERROR без статуса', () => {
    expect(getApiError({ status: 'FETCH_ERROR', error: 'x' })).toMatchObject({
      status: null,
      code: 'NETWORK_ERROR',
    });
  });

  it('PARSING_ERROR сохраняется как есть', () => {
    expect(
      getApiError({ status: 'PARSING_ERROR', originalStatus: 200, data: '', error: 'x' }),
    ).toMatchObject({ status: null, code: 'PARSING_ERROR' });
  });

  it('SerializedError и undefined дают UNKNOWN_ERROR', () => {
    expect(getApiError({ message: 'boom' })).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: 'boom',
    });
    expect(getApiError(undefined)).toMatchObject({ code: 'UNKNOWN_ERROR' });
  });
});

describe('showApiError', () => {
  const validationError = {
    status: 400,
    data: {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Bad data',
      details: [
        { field: 'email', message: 'Некорректный email' },
        { field: 'password', message: 'Слишком короткий' },
      ],
    },
  };

  beforeEach(() => vi.mocked(toast.error).mockClear());

  it('VALIDATION_ERROR с form: ошибки уходят в поля, тоста нет', () => {
    const form = { setError: vi.fn() };
    showApiError(validationError, form);
    expect(form.setError).toHaveBeenCalledTimes(2);
    expect(form.setError).toHaveBeenCalledWith('email', { message: 'Некорректный email' });
    expect(form.setError).toHaveBeenCalledWith('password', { message: 'Слишком короткий' });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('VALIDATION_ERROR без form: показывается тост', () => {
    showApiError(validationError);
    expect(toast.error).toHaveBeenCalledWith(getErrorText('VALIDATION_ERROR'));
  });

  it('другой код: тост с текстом по коду, form не трогается', () => {
    const form = { setError: vi.fn() };
    showApiError({ status: 403, data: { statusCode: 403, code: 'FORBIDDEN', message: 'x' } }, form);
    expect(toast.error).toHaveBeenCalledWith(getErrorText('FORBIDDEN'));
    expect(form.setError).not.toHaveBeenCalled();
  });

  it('неизвестный код: текст по умолчанию', () => {
    showApiError({ status: 418, data: { statusCode: 418, code: 'TEAPOT', message: 'x' } });
    expect(toast.error).toHaveBeenCalledWith(getErrorText('SOMETHING_ELSE'));
  });
});
