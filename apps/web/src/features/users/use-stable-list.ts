'use client';

import { useState } from 'react';

/**
 * Список, из которого не пропадают уже показанные элементы (рекомендации, как в Instagram).
 * После «Подписаться» сервер перестаёт рекомендовать человека, список перезапрашивается —
 * без этого строка исчезала бы прямо под курсором. Новые элементы добавляются в конец.
 */
export function useStableList<T extends { id: string }>(items: T[] | undefined): T[] {
  const [shown, setShown] = useState<T[]>([]);
  if (items) {
    const known = new Set(shown.map((item) => item.id));
    const added = items.filter((item) => !known.has(item.id));
    if (added.length > 0) setShown([...shown, ...added]);
  }
  return shown.length > 0 ? shown : (items ?? []);
}
