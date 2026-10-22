import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

// Раскладывает вложенные ошибки class-validator в плоский список { field, message }.
function flatten(errors: ValidationError[], parent = ''): { field: string; message: string }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

// Общие настройки ValidationPipe: лишние поля = ошибка, строки из query приводятся к типам DTO.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: flatten(errors),
      }),
  });
}
