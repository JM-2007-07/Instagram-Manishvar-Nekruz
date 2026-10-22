import { describe, expect, it } from 'vitest';
import type { Notification } from '@/lib/api/types';
import { formatAge, groupNotifications } from './group';

const now = new Date(2026, 9, 22, 15, 0, 0); // 22 октября 2026, 15:00

function at(daysAgo: number, id = String(daysAgo)): Notification {
  const date = new Date(2026, 9, 22 - daysAgo, 10, 0, 0);
  return { id, createdAt: date.toISOString() } as Notification;
}

describe('groupNotifications', () => {
  it('раскладывает по группам, сохраняя порядок', () => {
    const groups = groupNotifications([at(0, 'a'), at(0, 'b'), at(3), at(15), at(90)], now);
    expect(groups.map((g) => g.title)).toEqual([
      'Сегодня',
      'На этой неделе',
      'В этом месяце',
      'Ранее',
    ]);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('пустой список — нет групп', () => {
    expect(groupNotifications([], now)).toEqual([]);
  });
});

describe('formatAge', () => {
  it('короткие подписи времени', () => {
    expect(formatAge(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('сейчас');
    expect(formatAge(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('5 мин');
    expect(formatAge(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe('3 ч');
    expect(formatAge(new Date(now.getTime() - 2 * 86_400_000).toISOString(), now)).toBe('2 д');
  });
});
