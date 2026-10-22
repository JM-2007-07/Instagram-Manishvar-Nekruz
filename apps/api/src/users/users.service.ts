import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@/generated/prisma/client';
import { MeDto, ProfileDto } from './dto/me.dto';
import { UserSummaryDto } from './dto/user-summary.dto';
import { userSummarySelect, type UserSummaryRow } from './user-summary.select';

// Поля, из которых собирается Profile (без email и birthday).
function profileSelect(viewerId: string) {
  return {
    ...userSummarySelect(viewerId),
    bio: true,
    pronouns: true,
    links: {
      orderBy: { position: 'asc' },
      select: { url: true, title: true },
    },
    // Подписки: счётчики (только ACCEPTED и только ACTIVE-пользователи), моя подписка на него и подписан ли он на меня.
    _count: {
      select: {
        followers: { where: { status: 'ACCEPTED', follower: { status: 'ACTIVE' } } },
        following: { where: { status: 'ACCEPTED', following: { status: 'ACTIVE' } } },
      },
    },
    followers: { where: { followerId: viewerId }, select: { status: true } },
    following: { where: { followingId: viewerId, status: 'ACCEPTED' }, select: { status: true } },
  } satisfies Prisma.UserSelect;
}

type ProfileRow = Prisma.UserGetPayload<{ select: ReturnType<typeof profileSelect> }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Текущий пользователь (GET /me и ответы входа). Счётчик постов — 0 до PostsService.
  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...profileSelect(userId),
        email: true,
        emailVerifiedAt: true,
        birthday: true,
        gender: true,
        genderCustom: true,
        role: true,
        passwordHash: true, // только чтобы вычислить hasPassword, наружу не уходит
      },
    });
    if (!user) throw new NotFoundException();

    return {
      ...this.toProfile(user, userId),
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      birthday: user.birthday.toISOString().slice(0, 10),
      gender: user.gender,
      genderCustom: user.genderCustom,
      hasPassword: user.passwordHash !== null,
      role: user.role,
    };
  }

  // Профиль для viewerId (GET /users/...). null — нет такого активного подтверждённого пользователя.
  // Права просмотра (блокировки) проверяет вызывающий через VisibilityService. email и birthday не выбираются.
  async findProfile(
    viewerId: string,
    where: { id: string } | { userName: string },
  ): Promise<ProfileDto | null> {
    const user = await this.prisma.user.findFirst({
      where: { ...where, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: profileSelect(viewerId),
    });
    return user ? this.toProfile(user, viewerId) : null;
  }

  // followerCount/followingCount/followStatus/followsMe — из подписок. Остальное — значения по умолчанию:
  // mutualFollowers и canViewContent заполняет ProfileService, isBlocked/isRestricted/isMuted — T1.A5.
  private toProfile(user: ProfileRow, viewerId: string): ProfileDto {
    return {
      ...this.toSummary(user),
      bio: user.bio,
      pronouns: user.pronouns,
      links: user.links,
      postCount: 0,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      followStatus: this.followStatusOf(user.followers[0]?.status),
      followsMe: user.following.length > 0,
      isBlocked: false, // в текущем решении всегда false: блокирующий получает 404
      isRestricted: false,
      isMuted: { posts: false, stories: false },
      mutualFollowers: { users: [], total: 0 },
      canViewContent: true,
      isMe: user.id === viewerId,
    };
  }

  private followStatusOf(status: 'ACCEPTED' | 'PENDING' | undefined): ProfileDto['followStatus'] {
    if (status === 'ACCEPTED') return 'FOLLOWING';
    return status === 'PENDING' ? 'REQUESTED' : 'NONE';
  }

  // Заглушка до T1.A3 / T2.B1: avatarUrl = null (аватары — после MediaService), истории не учитываются
  // (hasActiveStory = false, isCloseFriendStory = false).
  toSummary(user: UserSummaryRow): UserSummaryDto {
    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      avatarUrl: null,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      hasActiveStory: false,
      isCloseFriendStory: false,
    };
  }
}
