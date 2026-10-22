import { RealtimeService } from './realtime.service';

// Заглушка до T2.A1: emitToUsers ничего не делает, но модули B уже могут её вызывать.
describe('RealtimeService (заглушка)', () => {
  it('emitToUsers не бросает исключение', () => {
    const service = new RealtimeService();
    expect(() => service.emitToUsers(['a', 'b'], 'notification:new', { id: 1 })).not.toThrow();
  });
});
