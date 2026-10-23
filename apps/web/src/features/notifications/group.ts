import type { Notification } from '@/lib/api/types';

export type NotificationGroup = { title: string; items: Notification[] };

const DAY = 24 * 60 * 60 * 1000;

// Начало суток в местном времени: «Сегодня» считается по календарю, а не по 24 часам.
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function titleFor(createdAt: string, now: Date): string {
  const age = startOfDay(now) - startOfDay(new Date(createdAt));
  if (age <= 0) return 'Сегодня';
  if (age < 7 * DAY) return 'На этой неделе';
  if (age < 30 * DAY) return 'В этом месяце';
  return 'Ранее';
}

/** Список приходит новыми сначала — порядок групп и элементов сохраняется. */
export function groupNotifications(items: Notification[], now = new Date()): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const title = titleFor(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}

/** Короткое время для строки: «5 мин», «3 ч», «2 д», «4 нед». */
export function formatAge(createdAt: string, now = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return 'сейчас';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} д`;
  return `${Math.floor(days / 7)} нед`;
}
