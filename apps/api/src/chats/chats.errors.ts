import { ConflictException } from '@nestjs/common';

export function limitReached(): ConflictException {
  return new ConflictException({ code: 'LIMIT_REACHED', message: 'Group is full' });
}
