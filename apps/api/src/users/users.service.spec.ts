import { UsersService } from './users.service';

describe('UsersService.toSummary', () => {
  const row = { id: 'u1', userName: 'ann', fullName: 'Ann A', isVerified: true, isPrivate: false };

  it('возвращает UserSummary по контракту §1.4 с заглушками аватара и историй', () => {
    expect(new UsersService().toSummary(row)).toEqual({
      id: 'u1',
      userName: 'ann',
      fullName: 'Ann A',
      avatarUrl: null,
      isVerified: true,
      isPrivate: false,
      hasActiveStory: false,
      isCloseFriendStory: false,
    });
  });

  it('не отдаёт лишние поля строки БД', () => {
    const extra = { ...row, passwordHash: 'secret', email: 'a@b.c' };
    const summary = new UsersService().toSummary(extra);
    expect(Object.keys(summary)).not.toContain('passwordHash');
    expect(Object.keys(summary)).not.toContain('email');
  });
});
