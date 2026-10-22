import { BadRequestException, ConflictException } from '@nestjs/common';

// Эта часть API ждёт модули Студента B (media, posts, stories): тип заложен в схеме, отправка — позже.
export function notImplemented(what: string, task: string): BadRequestException {
  return new BadRequestException({
    code: 'NOT_IMPLEMENTED',
    message: `${what} is not available yet (${task})`,
  });
}

export function limitReached(): ConflictException {
  return new ConflictException({ code: 'LIMIT_REACHED', message: 'Group is full' });
}
