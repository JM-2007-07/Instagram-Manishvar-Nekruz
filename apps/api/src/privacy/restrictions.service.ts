import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { PrismaService } from '@/prisma/prisma.service';
import type { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import type { HiddenWordsDto, MuteDto, MutedUserDto } from './dto/privacy.dto';
import { cursorWhere, sliceRows } from './page.util';

// Ограничение (F-PRV-03), скрытие (F-PRV-04), «скрыть историю от» (F-PRV-05), скрытые слова (F-PRV-08).
// Правила применения (комментарии, чаты, ленты) — в VisibilityService и у владельцев тех модулей.
@Injectable()
export class RestrictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  // --- Ограничение ---------------------------------------------------------------------------

  async restrict(ownerId: string, targetId: string): Promise<void> {
    await this.assertTarget(ownerId, targetId, 'restrict');
    await this.prisma.restrict.createMany({ data: [{ ownerId, targetId }], skipDuplicates: true });
  }

  async unrestrict(ownerId: string, targetId: string): Promise<void> {
    await this.assertTarget(ownerId, targetId, 'restrict', false);
    await this.prisma.restrict.deleteMany({ where: { ownerId, targetId } });
  }

  async listRestricted(ownerId: string, query: CursorQueryDto): Promise<Page<UserSummaryDto>> {
    const rows = await this.prisma.restrict.findMany({
      where: { ownerId, target: { status: 'ACTIVE' }, ...cursorWhere(query, 'targetId') },
      orderBy: [{ createdAt: 'desc' }, { targetId: 'desc' }],
      take: query.limit + 1,
      select: { createdAt: true, target: { select: userSummarySelect(ownerId) } },
    });
    const page = sliceRows(rows, query.limit, (r) => r.target.id);
    return {
      items: page.rows.map((r) => this.users.toSummary(r.target)),
      nextCursor: page.nextCursor,
    };
  }

  // --- Скрытие -------------------------------------------------------------------------------

  // Обе галочки сняты = скрытие выключено.
  async mute(ownerId: string, targetId: string, dto: MuteDto): Promise<void> {
    await this.assertTarget(ownerId, targetId, 'mute');
    if (!dto.posts && !dto.stories) {
      await this.prisma.mute.deleteMany({ where: { ownerId, targetId } });
      return;
    }
    await this.prisma.mute.upsert({
      where: { ownerId_targetId: { ownerId, targetId } },
      create: { ownerId, targetId, mutePosts: dto.posts, muteStories: dto.stories },
      update: { mutePosts: dto.posts, muteStories: dto.stories },
    });
  }

  async unmute(ownerId: string, targetId: string): Promise<void> {
    await this.prisma.mute.deleteMany({ where: { ownerId, targetId } });
  }

  async listMuted(ownerId: string, query: CursorQueryDto): Promise<Page<MutedUserDto>> {
    const rows = await this.prisma.mute.findMany({
      where: { ownerId, target: { status: 'ACTIVE' }, ...cursorWhere(query, 'targetId') },
      orderBy: [{ createdAt: 'desc' }, { targetId: 'desc' }],
      take: query.limit + 1,
      select: {
        createdAt: true,
        mutePosts: true,
        muteStories: true,
        target: { select: userSummarySelect(ownerId) },
      },
    });
    const page = sliceRows(rows, query.limit, (r) => r.target.id);
    return {
      items: page.rows.map((r) => ({
        ...this.users.toSummary(r.target),
        posts: r.mutePosts,
        stories: r.muteStories,
      })),
      nextCursor: page.nextCursor,
    };
  }

  // --- Скрыть историю от ---------------------------------------------------------------------

  async hideStoryFrom(ownerId: string, viewerId: string): Promise<void> {
    await this.assertTarget(ownerId, viewerId, 'hide your story from');
    await this.prisma.storyHiddenFrom.createMany({
      data: [{ ownerId, viewerId }],
      skipDuplicates: true,
    });
  }

  async unhideStoryFrom(ownerId: string, viewerId: string): Promise<void> {
    await this.prisma.storyHiddenFrom.deleteMany({ where: { ownerId, viewerId } });
  }

  async listStoryHiddenFrom(ownerId: string, query: CursorQueryDto): Promise<Page<UserSummaryDto>> {
    const rows = await this.prisma.storyHiddenFrom.findMany({
      where: { ownerId, viewer: { status: 'ACTIVE' }, ...cursorWhere(query, 'viewerId') },
      orderBy: [{ createdAt: 'desc' }, { viewerId: 'desc' }],
      take: query.limit + 1,
      select: { createdAt: true, viewer: { select: userSummarySelect(ownerId) } },
    });
    const page = sliceRows(rows, query.limit, (r) => r.viewer.id);
    return {
      items: page.rows.map((r) => this.users.toSummary(r.viewer)),
      nextCursor: page.nextCursor,
    };
  }

  // --- Скрытые слова -------------------------------------------------------------------------

  async getHiddenWords(userId: string): Promise<HiddenWordsDto> {
    const row = await this.prisma.hiddenWord.findUnique({
      where: { userId },
      select: { words: true, filterOffensive: true },
    });
    return row ?? { words: [], filterOffensive: false };
  }

  async setHiddenWords(userId: string, dto: HiddenWordsDto): Promise<HiddenWordsDto> {
    const words = [...new Set(dto.words.filter((w) => w.length > 0))];
    return this.prisma.hiddenWord.upsert({
      where: { userId },
      create: { userId, words, filterOffensive: dto.filterOffensive },
      update: { words, filterOffensive: dto.filterOffensive },
      select: { words: true, filterOffensive: true },
    });
  }

  // Себя нельзя (400); несуществующий или неактивный пользователь — 404.
  private async assertTarget(
    ownerId: string,
    targetId: string,
    action: string,
    mustExist = true,
  ): Promise<void> {
    if (ownerId === targetId) throw new BadRequestException(`You cannot ${action} yourself`);
    if (!mustExist) return;
    const user = await this.prisma.user.findFirst({
      where: { id: targetId, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    if (!user) throw new NotFoundException();
  }
}
