import { Injectable } from '@nestjs/common';

@Injectable()
export class RealtimeService {
  // Заглушка до T2.A1: поведение — ничего не делает (Socket.IO ещё нет).
  // Вызывать только после успешной транзакции основного действия.
  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    void userIds;
    void event;
    void payload;
  }
}
