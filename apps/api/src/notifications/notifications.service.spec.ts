import { NotificationsService } from './notifications.service';

function build(overrides: { hidden?: string[]; preference?: { enabled: boolean } | null } = {}) {
  const prisma = {
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(overrides.preference ?? null),
    },
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'n1',
        type: 'FOLLOW',
        postId: null,
        commentId: null,
        readAt: null,
        createdAt: new Date(),
        actor: { id: 'a1' },
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    follow: { count: jest.fn().mockResolvedValue(0) },
  };
  const users = { toSummary: jest.fn((u: { id: string }) => ({ id: u.id })) };
  const visibility = {
    getHiddenUserIds: jest.fn().mockResolvedValue(overrides.hidden ?? []),
    visibleUserWhere: jest.fn().mockReturnValue({}),
  };
  const realtime = { emitToUsers: jest.fn() };
  const service = new NotificationsService(
    prisma as never,
    users as never,
    visibility as never,
    realtime as never,
  );
  return { service, prisma, realtime };
}

describe('NotificationsService.create', () => {
  const input = { recipientId: 'r1', actorId: 'a1', type: 'FOLLOW' as const };

  it('создаёт уведомление и шлёт notification:new и badges:updated', async () => {
    const { service, prisma, realtime } = build();
    await service.create(input);
    expect(prisma.notification.create).toHaveBeenCalled();
    const events = realtime.emitToUsers.mock.calls.map((c) => c[1] as string);
    expect(events).toEqual(['notification:new', 'badges:updated']);
  });

  it('не уведомляет себя', async () => {
    const { service, prisma } = build();
    await service.create({ ...input, actorId: 'r1' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('учитывает выключенную настройку', async () => {
    const { service, prisma } = build({ preference: { enabled: false } });
    await service.create(input);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('не создаёт при блокировке', async () => {
    const { service, prisma } = build({ hidden: ['a1'] });
    await service.create(input);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('не бросает ошибку наружу', async () => {
    const { service, prisma } = build();
    prisma.notification.create.mockRejectedValue(new Error('db down'));
    await expect(service.create(input)).resolves.toBeUndefined();
  });
});
