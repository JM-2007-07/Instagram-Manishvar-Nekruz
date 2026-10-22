import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MeDto } from './dto/me.dto';
import { UserSummaryDto } from './dto/user-summary.dto';
import { userSummarySelect, type UserSummaryRow } from './user-summary.select';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Текущий пользователь (GET /me и ответы входа). Счётчики подписок и постов — 0 до T1.A4 / PostsService.
  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...userSummarySelect(userId),
        email: true,
        emailVerifiedAt: true,
        birthday: true,
        gender: true,
        genderCustom: true,
        bio: true,
        pronouns: true,
        role: true,
        passwordHash: true, // только чтобы вычислить hasPassword, наружу не уходит
      },
    });
    if (!user) throw new NotFoundException();

    return {
      ...this.toSummary(user),
      bio: user.bio,
      pronouns: user.pronouns,
      links: [],
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
      followStatus: 'NONE',
      followsMe: false,
      isBlocked: false,
      isRestricted: false,
      isMuted: { posts: false, stories: false },
      mutualFollowers: { users: [], total: 0 },
      canViewContent: true,
      isMe: true,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      birthday: user.birthday.toISOString().slice(0, 10),
      gender: user.gender,
      genderCustom: user.genderCustom,
      hasPassword: user.passwordHash !== null,
      role: user.role,
    };
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
