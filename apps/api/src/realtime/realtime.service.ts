import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

// Данные сокета, которые кладёт шлюз после проверки сессии.
export interface SocketData {
  userId: string;
  sessionId: string;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

// Отправка событий из других модулей. Сервер Socket.IO подключает шлюз (RealtimeGateway.afterInit);
// пока его нет (юнит-тесты) все методы ничего не делают.
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  // Вызывать только после успешной транзакции основного действия.
  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.server || userIds.length === 0) return;
    // Один emit в несколько комнат: сокет, состоящий в нескольких из них, получит событие один раз.
    this.server.to(userIds.map(userRoom)).emit(event, payload);
  }

  // Закрывает сокеты указанных сессий (выход, завершение сессии).
  disconnectSessions(sessionIds: string[]): void {
    const ids = new Set(sessionIds);
    this.closeSockets((data) => ids.has(data.sessionId));
  }

  // Закрывает все сокеты пользователя, кроме сокетов сессии exceptSessionId (сброс/смена пароля).
  disconnectUser(userId: string, exceptSessionId?: string): void {
    this.closeSockets((data) => data.userId === userId && data.sessionId !== exceptSessionId);
  }

  // Онлайн = есть хотя бы одно соединение. Хранится только в памяти (Q-new-6).
  isOnline(userId: string): boolean {
    return this.server?.sockets.adapter.rooms.has(userRoom(userId)) ?? false;
  }

  private closeSockets(match: (data: SocketData) => boolean): void {
    if (!this.server) return;
    for (const socket of this.server.sockets.sockets.values()) {
      if (match(socket.data as SocketData)) socket.disconnect(true);
    }
  }
}
