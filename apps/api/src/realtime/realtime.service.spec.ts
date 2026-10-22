import { RealtimeService } from './realtime.service';

// Без подключённого сервера Socket.IO методы ничего не делают (юнит-тесты других модулей).
describe('RealtimeService без сервера', () => {
  const service = new RealtimeService();

  it('emitToUsers не бросает исключение', () => {
    expect(() => service.emitToUsers(['a', 'b'], 'notification:new', { id: 1 })).not.toThrow();
  });

  it('disconnect и isOnline безопасны', () => {
    expect(() => service.disconnectSessions(['s'])).not.toThrow();
    expect(() => service.disconnectUser('u', 's')).not.toThrow();
    expect(service.isOnline('u')).toBe(false);
  });
});
