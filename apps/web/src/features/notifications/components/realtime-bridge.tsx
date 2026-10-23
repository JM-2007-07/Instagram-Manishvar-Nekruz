'use client';

import { useRealtimeConnection } from '@/lib/realtime';
import { useDirectRealtime } from '@/features/direct/realtime';
import { useNotificationEvents } from '../realtime';

// Невидимый компонент оболочки: подключает Socket.IO для вошедшего пользователя и слушает события значков.
// События чатов — useDirectRealtime (один раз на всё приложение).
export function RealtimeBridge() {
  useRealtimeConnection();
  useNotificationEvents();
  useDirectRealtime();
  return null;
}
