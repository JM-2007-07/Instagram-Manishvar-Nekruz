import { BadRequestException } from '@nestjs/common';
import { decodeCursor, decodeOffsetCursor, encodeCursor, encodeOffsetCursor } from './cursor';

const b64 = (value: string) => Buffer.from(value).toString('base64url');

describe('cursor createdAt+id', () => {
  it('encode -> decode возвращает ту же позицию', () => {
    const position = { createdAt: new Date('2026-01-02T03:04:05.678Z'), id: 'abc-123' };
    const decoded = decodeCursor(encodeCursor(position));
    expect(decoded.id).toBe('abc-123');
    expect(decoded.createdAt.toISOString()).toBe('2026-01-02T03:04:05.678Z');
  });

  it.each([
    ['не base64/JSON', '%%%not-a-cursor'],
    ['JSON null', b64('null')],
    ['нет id', b64(JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z' }))],
    ['нет createdAt', b64(JSON.stringify({ id: 'x' }))],
    ['createdAt не дата', b64(JSON.stringify({ createdAt: 'yesterday', id: 'x' }))],
    ['id не строка', b64(JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z', id: 5 }))],
  ])('битый курсор (%s) -> 400 BAD_REQUEST', (_name, cursor) => {
    expect.assertions(2);
    try {
      decodeCursor(cursor);
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ code: 'BAD_REQUEST' });
    }
  });
});

describe('cursor offset', () => {
  it('encode -> decode возвращает то же смещение', () => {
    expect(decodeOffsetCursor(encodeOffsetCursor(40))).toBe(40);
    expect(decodeOffsetCursor(encodeOffsetCursor(0))).toBe(0);
  });

  it.each([
    ['отрицательное', b64(JSON.stringify({ offset: -1 }))],
    ['дробное', b64(JSON.stringify({ offset: 1.5 }))],
    ['строка', b64(JSON.stringify({ offset: '3' }))],
    ['без offset', b64(JSON.stringify({}))],
    ['курсор другого вида', encodeCursor({ createdAt: new Date(), id: 'x' })],
    ['мусор', '%%%'],
  ])('битый курсор (%s) -> 400 BAD_REQUEST', (_name, cursor) => {
    expect(() => decodeOffsetCursor(cursor)).toThrow(BadRequestException);
  });
});
