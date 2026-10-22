import { BadRequestException } from '@nestjs/common';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function invalidCursor(): BadRequestException {
  return new BadRequestException({ code: 'BAD_REQUEST', message: 'Invalid cursor' });
}

// Курсор непрозрачный для клиента (ADR 0017): base64url от JSON.
function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
}

// Курсор по времени создания: позиция в списке «createdAt desc, id desc».
export function encodeCursor(position: { createdAt: Date; id: string }): string {
  return encode({ createdAt: position.createdAt.toISOString(), id: position.id });
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const value = decode(cursor) as { createdAt?: unknown; id?: unknown } | null;
  const createdAt = typeof value?.createdAt === 'string' ? new Date(value.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime()) || typeof value?.id !== 'string') {
    throw invalidCursor();
  }
  return { createdAt, id: value.id };
}

// Курсор-смещение — для выдачи по релевантности (поиск), где нет стабильного createdAt.
export function encodeOffsetCursor(offset: number): string {
  return encode({ offset });
}

export function decodeOffsetCursor(cursor: string): number {
  const value = decode(cursor) as { offset?: unknown } | null;
  if (typeof value?.offset !== 'number' || !Number.isInteger(value.offset) || value.offset < 0) {
    throw invalidCursor();
  }
  return value.offset;
}
