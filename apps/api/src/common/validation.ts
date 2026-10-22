import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

// Раскладывает вложенные ошибки class-validator в плоский список { field, message }.
function flatten(errors: ValidationError[], parent = ''): { field: string; message: string }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

// Формат 400 для ошибок валидации; нужен и ParseArrayPipe (тело-массив), у которого свой внутренний pipe.
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: flatten(errors),
  });
}

// 400 VALIDATION_ERROR с одной ошибкой поля (для проверок в сервисах и pipe'ах).
export function validationError(field: string, message: string): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [{ field, message }],
  });
}

// Общие настройки ValidationPipe: лишние поля = ошибка, строки из query приводятся к типам DTO.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  });
}
