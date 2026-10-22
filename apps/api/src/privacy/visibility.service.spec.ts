import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from './visibility.service';

// Юнит-тест на подмене Prisma: фиксирует сигнатуры (от них зависят модули B) и основные правила.
describe('VisibilityService', () => {
  const block = { findFirst: jest.fn(), findMany: jest.fn() };
  const user = { findUnique: jest.fn() };
  const follow = { findUnique: jest.fn() };
  const service = new VisibilityService({ block, user, follow } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    block.findFirst.mockResolvedValue(null);
  });

  it('свой профиль и контент доступны без запросов', async () => {
    await expect(service.canViewProfile('a', 'a')).resolves.toBe(true);
    await expect(service.canViewContent('a', 'a')).resolves.toBe(true);
    expect(block.findFirst).not.toHaveBeenCalled();
  });

  it('блокировка: профиль недоступен, assert даёт 404', async () => {
    block.findFirst.mockResolvedValue({ blockerId: 'b' });
    await expect(service.canViewProfile('a', 'b')).resolves.toBe(false);
    await expect(service.assertCanViewProfile('a', 'b')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.assertCanViewContent('a', 'b')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('открытый аккаунт виден, закрытый без подписки — 403', async () => {
    user.findUnique.mockResolvedValue({ isPrivate: false });
    await expect(service.canViewContent('a', 'b')).resolves.toBe(true);

    user.findUnique.mockResolvedValue({ isPrivate: true });
    follow.findUnique.mockResolvedValue({ status: 'PENDING' });
    await expect(service.canViewContent('a', 'b')).resolves.toBe(false);
    await expect(service.assertCanViewContent('a', 'b')).rejects.toBeInstanceOf(ForbiddenException);

    follow.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
    await expect(service.assertCanViewContent('a', 'b')).resolves.toBeUndefined();
  });

  it('getHiddenUserIds возвращает обе стороны блокировок без повторов', async () => {
    block.findMany.mockResolvedValue([
      { blockerId: 'a', blockedId: 'b' },
      { blockerId: 'c', blockedId: 'a' },
      { blockerId: 'b', blockedId: 'a' },
    ]);
    await expect(service.getHiddenUserIds('a')).resolves.toEqual(['b', 'c']);
  });

  it('visibleUserWhere исключает блокировки в обе стороны', () => {
    expect(service.visibleUserWhere('a')).toMatchObject({
      status: 'ACTIVE',
      blocksMade: { none: { blockedId: 'a' } },
      blocksReceived: { none: { blockerId: 'a' } },
    });
  });
});
