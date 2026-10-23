import { useDispatch } from 'react-redux';
import { baseApi } from '@/lib/api/base-api';
import type { AppDispatch } from '@/lib/store';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Schemas } from '@/lib/api/types';
import { notificationsApi } from './api';

// События REALTIME.md: счётчики заменяются точечно, список уведомлений сбрасывается тегом.
export function useNotificationEvents() {
  const dispatch = useDispatch<AppDispatch>();

  useRealtimeEvent('notification:new', () => {
    dispatch(baseApi.util.invalidateTags(['Notification', 'Badge']));
  });

  useRealtimeEvent<Schemas['BadgesDto']>('badges:updated', (badges) => {
    dispatch(notificationsApi.util.updateQueryData('getBadges', undefined, () => badges));
  });
}
