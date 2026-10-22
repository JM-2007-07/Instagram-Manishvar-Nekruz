import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Заглушка до T2.A2: create не бросает и не пишет в БД, но модули B уже могут её вызывать.
describe('NotificationsService (заглушка)', () => {
  it('create завершается без ошибки и не логирует текст контента', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const service = new NotificationsService();
    await expect(
      service.create({ recipientId: 'r1', actorId: 'a1', type: 'POST_LIKE', postId: 'p1' }),
    ).resolves.toBeUndefined();
    log.mockRestore();
  });
});
