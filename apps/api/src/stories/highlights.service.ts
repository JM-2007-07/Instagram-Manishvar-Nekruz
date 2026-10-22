import { Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser } from '@/common/session/session-user';
import { validationError } from '@/common/validation';
import { MediaService } from '@/media/media.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import {
  HighlightCreateDto,
  HighlightDto,
  HighlightUpdateDto,
  HighlightWithStoriesDto,
} from './dto/stories.dto';
import { StoriesService } from './stories.service';
import { storySelect } from './story.select';

// Обложка: свой файл, а если его нет — кадр первой истории.
const highlightSelect = {
  id: true,
  ownerId: true,
  title: true,
  coverMedia: { select: { id: true, thumbnailKey: true } },
  items: {
    orderBy: { position: 'asc' },
    select: {
      story: {
        select: {
          authorId: true,
          audience: true,
          expiresAt: true,
          media: { select: { id: true, thumbnailKey: true } },
        },
      },
    },
  },
} as const;

type HighlightStory = { authorId: string; audience: string; expiresAt: Date };

@Injectable()
export class HighlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly media: MediaService,
    private readonly stories: StoriesService,
  ) {}

  // storyCount и обложка-фолбэк считаются только по историям, которые видит зритель (аудитория, «скрыть от»).
  private async toDto(
    viewerId: string,
    row: {
      id: string;
      title: string;
      coverMedia: { id: string; thumbnailKey: string | null } | null;
      items: {
        story: HighlightStory & { media: { id: string; thumbnailKey: string | null } | null };
      }[];
    },
  ): Promise<HighlightDto> {
    const visible = [];
    for (const item of row.items) {
      if (await this.stories.isAllowed(viewerId, item.story, true)) visible.push(item);
    }
    const cover = row.coverMedia ?? visible[0]?.story.media ?? null;
    return {
      id: row.id,
      title: row.title,
      coverUrl: cover
        ? `/api/v1/media/${cover.id}${cover.thumbnailKey ? '?variant=thumb' : ''}`
        : null,
      storyCount: visible.length,
    };
  }

  private async loadOwn(user: SessionUser, highlightId: string) {
    const row = await this.prisma.highlight.findFirst({
      where: { id: highlightId, ownerId: user.id },
      select: { id: true, coverMediaId: true },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async getDto(viewerId: string, highlightId: string): Promise<HighlightDto> {
    const row = await this.prisma.highlight.findUniqueOrThrow({
      where: { id: highlightId },
      select: highlightSelect,
    });
    return this.toDto(viewerId, row);
  }

  // Все истории должны быть свои (в том числе истёкшие), без повторов.
  private async assertOwnStories(userId: string, storyIds: string[]): Promise<void> {
    if (storyIds.length === 0) throw validationError('storyIds', 'storyIds must not be empty');
    if (new Set(storyIds).size !== storyIds.length) {
      throw validationError('storyIds', 'storyIds must not contain duplicates');
    }
    const count = await this.prisma.story.count({
      where: { id: { in: storyIds }, authorId: userId },
    });
    if (count !== storyIds.length)
      throw validationError('storyIds', 'Only your own stories can be added');
  }

  async listByUser(viewerId: string, userId: string): Promise<HighlightDto[]> {
    await this.visibility.assertCanViewContent(viewerId, userId);
    const rows = await this.prisma.highlight.findMany({
      where: { ownerId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: highlightSelect,
    });
    return Promise.all(rows.map((r) => this.toDto(viewerId, r)));
  }

  async getById(viewerId: string, highlightId: string): Promise<HighlightWithStoriesDto> {
    const row = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: highlightSelect,
    });
    if (!row) throw new NotFoundException();
    await this.visibility.assertCanViewContent(viewerId, row.ownerId);
    const items = await this.prisma.highlightItem.findMany({
      where: { highlightId },
      orderBy: { position: 'asc' },
      select: { story: { select: storySelect(viewerId) } },
    });
    const stories = [];
    for (const { story } of items) {
      // В актуальном видны и истёкшие истории, но аудитория и «скрыть от» действуют.
      if (await this.stories.isAllowed(viewerId, story, true)) {
        stories.push(this.stories.toStoryDto(story, viewerId));
      }
    }
    return { ...(await this.toDto(viewerId, row)), stories };
  }

  async create(user: SessionUser, dto: HighlightCreateDto): Promise<HighlightDto> {
    const title = dto.title.trim();
    if (!title) throw validationError('title', 'title must not be empty');
    await this.assertOwnStories(user.id, dto.storyIds);
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.coverMediaId) {
        await this.media.attach(user.id, [dto.coverMediaId], {
          target: 'HIGHLIGHT_COVER',
          purposes: ['HIGHLIGHT_COVER'],
          tx,
        });
      }
      return tx.highlight.create({
        data: {
          ownerId: user.id,
          title,
          coverMediaId: dto.coverMediaId ?? null,
          items: { create: dto.storyIds.map((storyId, position) => ({ storyId, position })) },
        },
        select: { id: true },
      });
    });
    return this.getDto(user.id, created.id);
  }

  async update(
    user: SessionUser,
    highlightId: string,
    dto: HighlightUpdateDto,
  ): Promise<HighlightDto> {
    const current = await this.loadOwn(user, highlightId);
    const title = dto.title?.trim();
    if (dto.title !== undefined && !title)
      throw validationError('title', 'title must not be empty');
    await this.prisma.$transaction(async (tx) => {
      if (dto.coverMediaId) {
        await this.media.attach(user.id, [dto.coverMediaId], {
          target: 'HIGHLIGHT_COVER',
          purposes: ['HIGHLIGHT_COVER'],
          tx,
        });
      }
      await tx.highlight.update({
        where: { id: highlightId },
        data: {
          ...(title ? { title } : {}),
          ...(dto.coverMediaId ? { coverMediaId: dto.coverMediaId } : {}),
        },
      });
    });
    // Старую обложку удаляем после успешной транзакции.
    if (dto.coverMediaId && current.coverMediaId)
      await this.media.removeFiles([current.coverMediaId]);
    return this.getDto(user.id, highlightId);
  }

  async setStories(
    user: SessionUser,
    highlightId: string,
    storyIds: string[],
  ): Promise<HighlightDto> {
    await this.loadOwn(user, highlightId);
    await this.assertOwnStories(user.id, storyIds);
    await this.prisma.$transaction([
      this.prisma.highlightItem.deleteMany({ where: { highlightId } }),
      this.prisma.highlightItem.createMany({
        data: storyIds.map((storyId, position) => ({ highlightId, storyId, position })),
      }),
      this.prisma.highlight.update({ where: { id: highlightId }, data: { updatedAt: new Date() } }),
    ]);
    return this.getDto(user.id, highlightId);
  }

  async remove(user: SessionUser, highlightId: string): Promise<void> {
    const current = await this.loadOwn(user, highlightId);
    await this.prisma.highlight.delete({ where: { id: highlightId } }); // элементы — каскадом, истории остаются в архиве
    if (current.coverMediaId) await this.media.removeFiles([current.coverMediaId]);
  }
}
