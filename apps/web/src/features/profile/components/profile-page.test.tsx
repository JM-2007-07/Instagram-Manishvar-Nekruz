import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/api/types';
import { ProfilePage } from './profile-page';

const profileQuery = vi.fn();
const infinite = { data: { pages: [] }, isLoading: false, isError: false, refetch: vi.fn() };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api', () => ({
  useGetProfileByUserNameQuery: () => profileQuery(),
  useGetUserPostsInfiniteQuery: () => infinite,
  useGetUserReelsInfiniteQuery: () => infinite,
  useGetUserTaggedInfiniteQuery: () => infinite,
}));
vi.mock('@/features/users/api', () => ({
  useFollowUserMutation: () => [vi.fn(), { isLoading: false }],
  useUnfollowUserMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('@/features/stories/components/highlights-row', () => ({ HighlightsRow: () => null }));
vi.mock('@/features/privacy/components/profile-actions-menu', () => ({
  ProfileActionsMenu: () => null,
}));
vi.mock('@/features/direct/api', () => ({
  useCreateChatMutation: () => [vi.fn(), { isLoading: false }],
}));

function makeProfile(patch: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    userName: 'alice',
    fullName: 'Alice A',
    avatarUrl: null,
    isVerified: false,
    isPrivate: false,
    hasActiveStory: false,
    isCloseFriendStory: false,
    bio: 'Привет',
    pronouns: null,
    links: [],
    postCount: 3,
    followerCount: 12_345,
    followingCount: 7,
    followStatus: 'NONE',
    followsMe: false,
    isBlocked: false,
    isRestricted: false,
    isMuted: { posts: false, stories: false },
    mutualFollowers: { users: [], total: 0 },
    canViewContent: true,
    isMe: false,
    ...patch,
  };
}

function ok(profile: Profile) {
  profileQuery.mockReturnValue({
    data: profile,
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  });
}

describe('ProfilePage', () => {
  beforeEach(() => {
    profileQuery.mockReset();
  });

  it('свой профиль: «Редактировать профиль» и вкладка «Сохранённое»', () => {
    ok(makeProfile({ isMe: true }));
    render(<ProfilePage userName="alice" tab="posts" />);
    expect(screen.getByRole('link', { name: 'Редактировать профиль' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/accounts\/edit\/?$/),
    );
    expect(screen.getByRole('link', { name: /Сохранённое/ })).toBeInTheDocument();
    expect(screen.getByText('12,3 тыс.')).toBeInTheDocument();
  });

  it('чужой профиль: «Подписаться» и «Отправить сообщение», нет «Сохранённого»', () => {
    ok(makeProfile());
    render(<ProfilePage userName="alice" tab="posts" />);
    expect(screen.getByRole('button', { name: 'Подписаться' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить сообщение' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Сохранённое/ })).not.toBeInTheDocument();
  });

  it('запрос отправлен: кнопка «Запрос отправлен»', () => {
    ok(makeProfile({ followStatus: 'REQUESTED', isPrivate: true, canViewContent: false }));
    render(<ProfilePage userName="alice" tab="posts" />);
    expect(screen.getByRole('button', { name: 'Запрос отправлен' })).toBeInTheDocument();
  });

  it('закрытый аккаунт: шапка и замок вместо сетки', () => {
    ok(makeProfile({ isPrivate: true, canViewContent: false }));
    render(<ProfilePage userName="alice" tab="posts" />);
    expect(screen.getByText('Это закрытый аккаунт')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'alice' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Разделы профиля' })).not.toBeInTheDocument();
  });

  it('404: «К сожалению, эта страница недоступна»', () => {
    profileQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404, data: { statusCode: 404, code: 'NOT_FOUND', message: 'x' } },
      refetch: vi.fn(),
    });
    render(<ProfilePage userName="ghost" tab="posts" />);
    expect(screen.getByText('К сожалению, эта страница недоступна')).toBeInTheDocument();
  });

  it('прочая ошибка: кнопка «Повторить»', () => {
    profileQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, data: { statusCode: 500, code: 'INTERNAL_ERROR', message: 'x' } },
      refetch: vi.fn(),
    });
    render(<ProfilePage userName="alice" tab="posts" />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('пустая сетка своего профиля', () => {
    ok(makeProfile({ isMe: true }));
    render(<ProfilePage userName="alice" tab="posts" />);
    expect(screen.getByText('Поделитесь фото')).toBeInTheDocument();
  });
});
