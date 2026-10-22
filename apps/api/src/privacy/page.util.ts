import { decodeCursor, encodeCursor } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';

// Условие курсора для списков «createdAt desc, <поле второго пользователя> desc» (ADR 0017).
export function cursorWhere(query: CursorQueryDto, idField: string): Record<string, unknown> {
  if (!query.cursor) return {};
  const c = decodeCursor(query.cursor);
  return {
    OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, [idField]: { lt: c.id } }],
  };
}

// rows загружены с take = limit + 1: лишняя строка говорит, что есть следующая страница.
export function sliceRows<R extends { createdAt: Date }>(
  rows: R[],
  limit: number,
  idOf: (row: R) => string,
): { rows: R[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    rows: items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ createdAt: last.createdAt, id: idOf(last) })
        : null,
  };
}
