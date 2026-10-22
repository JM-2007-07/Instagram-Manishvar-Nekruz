import { ForbiddenException, INestApplication, NotFoundException } from '@nestjs/common';
import { VisibilityService } from '@/privacy/visibility.service';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, resetDb } from './helpers';
import type { TestUser } from './helpers';

// Настоящий VisibilityService на реальной БД. Матрица: viewer (v) против owner (o).
describe('VisibilityService', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let visibility: VisibilityService;
  let v: TestUser;
  let open: TestUser;
  let priv: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    visibility = app.get(VisibilityService);
  });

  beforeEach(async () => {
    await resetDb(app);
    v = await createUser(app, { userName: 'viewer' });
    open = await createUser(app, { userName: 'open' });
    priv = await createUser(app, { userName: 'secret', isPrivate: true });
  });

  afterAll(async () => {
    await app.close();
  });

  const follow = (followerId: string, followingId: string, status: 'ACCEPTED' | 'PENDING') =>
    prisma.follow.create({ data: { followerId, followingId, status } });
  const blockUser = (blockerId: string, blockedId: string) =>
    prisma.block.create({ data: { blockerId, blockedId } });

  describe('canViewProfile / canViewContent', () => {
    it('я сам: профиль и контент доступны, даже если аккаунт закрытый', async () => {
      await expect(visibility.canViewProfile(priv.id, priv.id)).resolves.toBe(true);
      await expect(visibility.canViewContent(priv.id, priv.id)).resolves.toBe(true);
    });

    it('открытый аккаунт: доступно всё', async () => {
      await expect(visibility.canViewProfile(v.id, open.id)).resolves.toBe(true);
      await expect(visibility.canViewContent(v.id, open.id)).resolves.toBe(true);
    });

    it('закрытый без подписки: профиль виден, контент нет', async () => {
      await expect(visibility.canViewProfile(v.id, priv.id)).resolves.toBe(true);
      await expect(visibility.canViewContent(v.id, priv.id)).resolves.toBe(false);
    });

    it('закрытый, запрос PENDING: контент недоступен', async () => {
      await follow(v.id, priv.id, 'PENDING');
      await expect(visibility.canViewContent(v.id, priv.id)).resolves.toBe(false);
    });

    it('закрытый, подписка ACCEPTED: контент доступен', async () => {
      await follow(v.id, priv.id, 'ACCEPTED');
      await expect(visibility.canViewContent(v.id, priv.id)).resolves.toBe(true);
    });

    it('подписка в обратную сторону не открывает закрытый аккаунт', async () => {
      await follow(priv.id, v.id, 'ACCEPTED');
      await expect(visibility.canViewContent(v.id, priv.id)).resolves.toBe(false);
    });

    it('я заблокировал owner: ни профиль, ни контент', async () => {
      await blockUser(v.id, open.id);
      await expect(visibility.canViewProfile(v.id, open.id)).resolves.toBe(false);
      await expect(visibility.canViewContent(v.id, open.id)).resolves.toBe(false);
    });

    it('меня заблокировал owner: ни профиль, ни контент', async () => {
      await blockUser(open.id, v.id);
      await expect(visibility.canViewProfile(v.id, open.id)).resolves.toBe(false);
      await expect(visibility.canViewContent(v.id, open.id)).resolves.toBe(false);
    });

    it('блокировка перекрывает ACCEPTED-подписку на закрытый аккаунт', async () => {
      await follow(v.id, priv.id, 'ACCEPTED');
      await blockUser(priv.id, v.id);
      await expect(visibility.canViewContent(v.id, priv.id)).resolves.toBe(false);
    });
  });

  describe('assertCanViewProfile / assertCanViewContent', () => {
    it('открытый и я сам: не бросают', async () => {
      await expect(visibility.assertCanViewProfile(v.id, open.id)).resolves.toBeUndefined();
      await expect(visibility.assertCanViewContent(v.id, open.id)).resolves.toBeUndefined();
      await expect(visibility.assertCanViewContent(priv.id, priv.id)).resolves.toBeUndefined();
    });

    it('закрытый без подписки: профиль доступен, контент -> 403 PRIVATE_ACCOUNT', async () => {
      await expect(visibility.assertCanViewProfile(v.id, priv.id)).resolves.toBeUndefined();
      const err = await visibility.assertCanViewContent(v.id, priv.id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(JSON.stringify((err as ForbiddenException).getResponse())).toContain(
        'PRIVATE_ACCOUNT',
      );
    });

    it('закрытый, PENDING -> 403; ACCEPTED -> не бросает', async () => {
      await follow(v.id, priv.id, 'PENDING');
      await expect(visibility.assertCanViewContent(v.id, priv.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await prisma.follow.updateMany({ data: { status: 'ACCEPTED' } });
      await expect(visibility.assertCanViewContent(v.id, priv.id)).resolves.toBeUndefined();
    });

    it.each([
      ['я заблокировал', true],
      ['меня заблокировали', false],
    ])('%s: оба assert -> 404 (не 403)', async (_name, iBlocked) => {
      if (iBlocked) await blockUser(v.id, priv.id);
      else await blockUser(priv.id, v.id);
      await expect(visibility.assertCanViewProfile(v.id, priv.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(visibility.assertCanViewContent(v.id, priv.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getHiddenUserIds / visibleUserWhere', () => {
    it('без блокировок: список пуст и visibleUserWhere не отсекает никого', async () => {
      await expect(visibility.getHiddenUserIds(v.id)).resolves.toEqual([]);
      const users = await prisma.user.findMany({ where: visibility.visibleUserWhere(v.id) });
      expect(users.map((u) => u.id).sort()).toEqual([v.id, open.id, priv.id].sort());
    });

    it('getHiddenUserIds: заблокированные мной и заблокировавшие меня, без дублей', async () => {
      const third = await createUser(app, { userName: 'third' });
      await blockUser(v.id, open.id);
      await blockUser(priv.id, v.id);
      await blockUser(v.id, priv.id);
      await blockUser(third.id, open.id); // чужая блокировка не влияет на v
      const hidden = await visibility.getHiddenUserIds(v.id);
      expect([...hidden].sort()).toEqual([open.id, priv.id].sort());
    });

    it('visibleUserWhere исключает заблокированных в обе стороны, остальных оставляет', async () => {
      const third = await createUser(app, { userName: 'third' });
      await blockUser(v.id, open.id);
      await blockUser(priv.id, v.id);
      const users = await prisma.user.findMany({ where: visibility.visibleUserWhere(v.id) });
      expect(users.map((u) => u.id).sort()).toEqual([v.id, third.id].sort());
    });

    it('после снятия блокировки пользователь снова виден', async () => {
      await blockUser(v.id, open.id);
      await prisma.block.deleteMany();
      await expect(visibility.getHiddenUserIds(v.id)).resolves.toEqual([]);
    });
  });
});
