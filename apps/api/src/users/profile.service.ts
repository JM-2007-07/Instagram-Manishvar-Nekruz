import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertUserNameAllowed,
  conflictError,
  OLD_USER_NAME_HOLD_MS,
  UNVERIFIED_TTL_MS,
} from '@/auth/auth.rules';
import { validationError } from '@/common/validation';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { MediaService } from '@/media/media.service';
import { FollowsService } from '@/follows/follows.service';
import { SuggestionsService } from '@/follows/suggestions.service';
import { MeDto, ProfileDto } from './dto/me.dto';
import type { ChangeUserNameDto, SetLinksDto, UpdateProfileDto } from './dto/profile-requests.dto';
import { UsersService } from './users.service';

const MAX_LINKS = 5;
const MAX_USER_NAME_CHANGES = 2; // за 14 дней (F-ACC-11)

// 429 при слишком частой смене имени; контроллер добавляет заголовок Retry-After.
export class UserNameRateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      { code: 'RATE_LIMITED', message: 'Username can be changed twice per 14 days' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// Профиль: чтение чужого, редактирование своего, имя, ссылки. Аватар — MediaService; email — EmailChangeService.
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
    private readonly follows: FollowsService,
    private readonly suggestions: SuggestionsService,
    private readonly media: MediaService,
  ) {}

  // --- Чтение ------------------------------------------------------------------------------------

  async getProfile(
    viewerId: string,
    where: { id: string } | { userName: string },
  ): Promise<ProfileDto> {
    const profile = await this.users.findProfile(viewerId, where);
    if (!profile) throw new NotFoundException();
    // Блокировка в любую сторону = 404, как будто пользователя нет.
    await this.visibility.assertCanViewProfile(viewerId, profile.id);

    // Контент виден: себе, всем у открытого аккаунта, ACCEPTED-подписчикам у закрытого.
    profile.canViewContent = await this.visibility.canViewContent(viewerId, profile.id);
    profile.mutualFollowers = await this.suggestions.mutualPreview(viewerId, profile.id);
    return profile;
  }

  // --- Редактирование ----------------------------------------------------------------------------

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<MeDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true, genderCustom: true },
    });
    if (!current) throw new NotFoundException();

    // Свой текст пола имеет смысл только при gender = CUSTOM.
    const gender = dto.gender === undefined ? current.gender : dto.gender;
    let genderCustom = dto.genderCustom === undefined ? current.genderCustom : dto.genderCustom;
    if (gender !== 'CUSTOM') genderCustom = null;
    else if (!genderCustom) {
      throw validationError('genderCustom', 'genderCustom is required when gender is CUSTOM');
    }

    // Открытие аккаунта (isPrivate = false) принимает все запросы на подписку — в одной транзакции.
    const accepted = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: dto.fullName,
          bio: dto.bio,
          pronouns: dto.pronouns,
          isPrivate: dto.isPrivate,
          gender,
          genderCustom,
        },
      });
      return dto.isPrivate === false ? this.follows.acceptAllPending(tx, userId) : [];
    });
    await this.follows.notifyAccepted(userId, accepted);
    // Q-new-1: лимит смены fullName (2 раза за 14 дней) не реализован.
    return this.users.getMe(userId);
  }

  // PUT /me/avatar: своё изображение READY с purpose AVATAR (проверяет MediaService.attach). Прежний файл удаляется.
  async setAvatar(userId: string, mediaId: string): Promise<MeDto> {
    const oldId = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { avatarMediaId: true },
      });
      if (!current) throw new NotFoundException();
      if (current.avatarMediaId === mediaId) return null;
      await this.media.attach(userId, [mediaId], {
        target: 'AVATAR',
        purposes: ['AVATAR'],
        tx,
      });
      await tx.user.update({ where: { id: userId }, data: { avatarMediaId: mediaId } });
      return current.avatarMediaId;
    });
    if (oldId) await this.media.removeFiles([oldId]);
    return this.users.getMe(userId);
  }

  // DELETE /me/avatar: повторный вызов безопасен.
  async removeAvatar(userId: string): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarMediaId: true },
    });
    if (!current?.avatarMediaId) return;
    await this.prisma.user.updateMany({
      where: { id: userId, avatarMediaId: current.avatarMediaId },
      data: { avatarMediaId: null },
    });
    await this.media.removeFiles([current.avatarMediaId]);
  }

  async changeUserName(userId: string, dto: ChangeUserNameDto): Promise<MeDto> {
    const newName = dto.userName;
    assertUserNameAllowed(newName);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Блокировка строки пользователя: две параллельные смены не обойдут лимит.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { userName: true },
        });
        if (!user) throw new NotFoundException();
        if (user.userName === newName) return;

        const since = new Date(Date.now() - OLD_USER_NAME_HOLD_MS);
        const recent = await tx.usernameChange.findMany({
          where: { userId, changedAt: { gt: since } },
          orderBy: { changedAt: 'asc' },
          select: { changedAt: true },
        });
        if (recent.length >= MAX_USER_NAME_CHANGES) {
          // Освободится место, когда самая старая из смен выйдет за 14 дней.
          const oldest = recent[recent.length - MAX_USER_NAME_CHANGES].changedAt;
          const seconds = Math.ceil((oldest.getTime() + OLD_USER_NAME_HOLD_MS - Date.now()) / 1000);
          throw new UserNameRateLimitedException(Math.max(seconds, 1));
        }

        // Неподтверждённые аккаунты старше 7 дней освобождают имя (как при регистрации).
        await tx.user.deleteMany({
          where: {
            userName: newName,
            emailVerifiedAt: null,
            createdAt: { lt: new Date(Date.now() - UNVERIFIED_TTL_MS) },
          },
        });
        // Чужое имя, освобождённое меньше 14 дней назад, ещё закреплено за прежним владельцем.
        const held = await tx.usernameChange.findFirst({
          where: { oldUserName: newName, changedAt: { gt: since }, NOT: { userId } },
          select: { id: true },
        });
        if (held) throw conflictError('userName', 'This username is already taken');

        await tx.user.update({ where: { id: userId }, data: { userName: newName } });
        await tx.usernameChange.create({
          data: { userId, oldUserName: user.userName, newUserName: newName },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflictError('userName', 'This username is already taken');
      }
      throw error;
    }
    return this.users.getMe(userId);
  }

  async setLinks(userId: string, dto: SetLinksDto): Promise<MeDto> {
    if (dto.links.length > MAX_LINKS) {
      throw new ConflictException({
        code: 'LIMIT_REACHED',
        message: `At most ${MAX_LINKS} links are allowed`,
      });
    }
    await this.prisma.$transaction([
      this.prisma.userLink.deleteMany({ where: { userId } }),
      this.prisma.userLink.createMany({
        data: dto.links.map((link, position) => ({
          userId,
          url: link.url,
          title: link.title ?? null,
          position,
        })),
      }),
    ]);
    return this.users.getMe(userId);
  }
}
