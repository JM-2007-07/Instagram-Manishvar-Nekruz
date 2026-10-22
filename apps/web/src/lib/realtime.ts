'use client';

import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { io, type Socket } from 'socket.io-client';
import { baseApi } from '@/lib/api/base-api';

// Одно подключение Socket.IO на вкладку (ADR 0013, API_REQUEST_ARCHITECTURE §6.6).
// Адрес — единственный публичный адрес кроме same-origin прокси; cookie сессии уходит при рукопожатии.
// Файл общий для функций: обработчики событий лежат рядом с эндпоинтами функции (features/<name>/realtime.ts).

let socket: Socket | null = null;

/** Сокет создаётся один раз, но не подключается сам: подключение — useRealtimeConnection(). */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_REALTIME_URL, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
}

/**
 * Подключает сокет, пока компонент смонтирован (его ставят в оболочку для вошедших пользователей).
 * После переподключения сбрасывает теги, чтобы не потерять пропущенное.
 */
export function useRealtimeConnection() {
  const dispatch = useDispatch();

  useEffect(() => {
    const current = getSocket();
    const onReconnect = () => {
      dispatch(baseApi.util.invalidateTags(['Chat', 'Message', 'Notification', 'Badge']));
    };
    current.io.on('reconnect', onReconnect);
    current.connect();
    return () => {
      current.io.off('reconnect', onReconnect);
      current.disconnect();
    };
  }, [dispatch]);
}

/** Подписка на событие на время жизни компонента. Свежий handler берётся без переподписки. */
export function useRealtimeEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const current = getSocket();
    const listener = (data: T) => handlerRef.current(data);
    current.on(event, listener);
    return () => {
      current.off(event, listener);
    };
  }, [event]);
}
