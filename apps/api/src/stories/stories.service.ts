import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decodeCursor, encodeCursor } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import type { SessionUser } from '@/common/session/session-user';
import { validationError } from '@/common/validation';
import { ChatsService } from '@/chats/chats.service';
import type { MessageDto } from '@/chats/dto/chats.dto';
import { FollowsService } from '@/follows/follows.service';
import type { Prisma } from '@/generated/prisma/client';
import { MediaService } from '@/media/media.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import {
  CreateStoryDto,
  StickerResponsesPageDto,
  StoryDto,
  StoryPageDto,
  StoryTrayItemDto,
  StoryViewerPageDto,
} from './dto/stories.dto';
import {
  isInteractive,
  normalizeStickerData,
  parseStickerResponse,
  summarizeResponses,
} from './stickers.rules';
import { StoryRow, isSharedPostVisible, storySelect } from './story.select';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_SEC = 5;
const TRAY_LIMIT = 1000;

interface ActiveStory {
  id: string;
  authorId: string;
  audience: 'EVERYONE' | 'CLOSE_FRIENDS';
  createdAt: Date;
  viewed: boolean;
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
    private readonly follows: FollowsService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
    // forwardRef: chats и stories ссылаются друг на друга (ответы на истории ↔ «поделиться историей»).
    @Inject(forwardRef(() => ChatsService)) private readonly chats: ChatsService,
  ) {}

  // ---------- Публичное API для других модулей ----------

  /**
   * Для кольца вокруг аватара (UserSummary.hasActiveStory / isCloseFriendStory): у каких из userIds есть
   * активная история, которую видит viewer. Пользователей без истории в Map нет.
   */
  async hasActiveStory(
    viewerId: string,
    userIds: string[],
  ): Promise<Map<string, { hasActiveStory: boolean; isCloseFriendStory: boolean }>> {
    const result = new Map<string, { hasActiveStory: boolean; isCloseFriendStory: boolean }>();
    for (const story of await this.visibleActive(viewerId, [...new Set(userIds)])) {
      const entry = result.get(story.authorId) ?? {
        hasActiveStory: true,
        isCloseFriendStory: false,
      };
      if (story.audience === 'CLOSE_FRIENDS') entry.isCloseFriendStory = true;
      result.set(story.authorId, entry);
    }
    return result;
  }

  // ---------- Видимость ----------

  // Активные (не истёкшие) истории этих авторов, которые видит viewer: автор виден и открыт/подписан,
  // CLOSE_FRIENDS — только близким, «скрыть историю от» исключает. Свои истории видны всегда.
  private async visibleActive(viewerId: string, authorIds: string[]): Promise<ActiveStory[]> {
    if (authorIds.length === 0) return [];
    const rows = await this.prisma.story.findMany({
      where: {
        authorId: { in: authorIds },
        expiresAt: { gt: new Date() },
        author: this.visibility.visibleAuthorWhere(viewerId),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: TRAY_LIMIT,
      select: {
        id: true,
        authorId: true,
        audience: true,
        createdAt: true,
        views: { where: { viewerId }, select: { viewerId: true }, take: 1 },
      },
    });
    const others = [...new Set(rows.map((r) => r.authorId).filter((id) => id !== viewerId))];
    const [closeOf, hiddenBy] =
      others.length === 0
        ? [[], []]
        : await Promise.all([
            this.prisma.closeFriend.findMany({
              where: { friendId: viewerId, ownerId: { in: others } },
              select: { ownerId: true },
            }),
            this.prisma.storyHiddenFrom.findMany({
              where: { viewerId, ownerId: { in: others } },
              select: { ownerId: true },
            }),
          ]);
    const closeSet = new Set(closeOf.map((r) => r.ownerId));
    const hiddenSet = new Set(hiddenBy.map((r) => r.ownerId));
    return rows
      .filter((r) => {
        if (r.authorId === viewerId) return true;
        if (hiddenSet.has(r.authorId)) return false;
        return r.audience !== 'CLOSE_FRIENDS' || closeSet.has(r.authorId);
      })
      .map((r) => ({
        id: r.id,
        authorId: r.authorId,
        audience: r.audience,
        createdAt: r.createdAt,
        viewed: r.views.length > 0,
      }));
  }

  // Аудитория, «скрыть от» и срок для одной истории. Блокировки и закрытый аккаунт проверяет assertCanViewContent.
  async isAllowed(
    viewerId: string,
    story: { authorId: string; audience: string; expiresAt: Date },
    allowExpired = false,
  ): Promise<boolean> {
    if (story.authorId === viewerId) return true;
    if (!allowExpired && story.expiresAt.getTime() <= Date.now()) return false;
    if (
      story.audience === 'CLOSE_FRIENDS' &&
      !(await this.visibility.isCloseFriend(story.authorId, viewerId))
    ) {
      return false;
    }
    return !(await this.visibility.getStoryHiddenFromIds(story.authorId)).includes(viewerId);
  }

  // Историю видит viewer, иначе 404 (или 403 PRIVATE_ACCOUNT для закрытого аккаунта).
  private async loadVisible(viewerId: string, storyId: string): Promise<StoryRow> {
    const row = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: storySelect(viewerId),
    });
    if (!row) throw new NotFoundException();
    await this.visibility.assertCanViewContent(viewerId, row.authorId);
    if (!(await this.isAllowed(viewerId, row))) throw new NotFoundException();
    return row;
  }

  private async loadAny(storyId: string) {
    const row = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, mediaId: true },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async loadOwn(user: SessionUser, storyId: string) {
    const row = await this.prisma.story.findFirst({
      where: { id: storyId, authorId: user.id },
      select: { id: true, mediaId: true },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  // ---------- DTO ----------

  toStoryDto(row: StoryRow, viewerId: string): StoryDto {
    const isAuthor = row.authorId === viewerId;
    const post =
      row.sharedPost && isSharedPostVisible(row.sharedPost, viewerId) ? row.sharedPost : null;
    const previewMedia = post?.media[0]?.media;
    return {
      id: row.id,
      author: this.users.toSummary(row.author),
      media: row.media ? this.media.toMediaItem(row.media) : null,
      sharedPost: post
        ? {
            id: post.id,
            shortcode: post.shortcode,
            previewUrl: previewMedia
              ? `/api/v1/media/${previewMedia.id}${previewMedia.thumbnailKey ? '?variant=thumb' : ''}`
              : null,
            author: this.users.toSummary(post.author),
          }
        : null,
      audience: row.audience,
      stickers: row.stickers.map((s) => ({
        id: s.id,
        type: s.type,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        rotation: s.rotation,
        data: this.stickerDataFor(s.type, s.data as Record<string, unknown>, isAuthor),
        myResponse: s.responses[0]?.value ?? null,
      })),
      durationSec: row.durationSec,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      isViewedByMe: isAuthor || row.views.length > 0,
      isLikedByMe: row.likes.length > 0,
      viewerCount: isAuthor ? row._count.views : null,
      likeCount: isAuthor ? row._count.likes : null,
    };
  }

  // Правильный ответ викторины видит только автор истории.
  private stickerDataFor(
    type: string,
    data: Record<string, unknown>,
    isAuthor: boolean,
  ): Record<string, unknown> {
    if (type !== 'QUIZ' || isAuthor) return data;
    const { correctIndex: _hidden, ...rest } = data;
    void _hidden;
    return rest;
  }

  private async getDto(viewerId: string, storyId: string): Promise<StoryDto> {
    const row = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      select: storySelect(viewerId),
    });
    return this.toStoryDto(row, viewerId);
  }

  // ---------- Лента, просмотр ----------

  async tray(viewerId: string): Promise<StoryTrayItemDto[]> {
    const [followingIds, muted] = await Promise.all([
      this.follows.getFollowingIds(viewerId),
      this.visibility.getMutedUserIds(viewerId, 'stories'),
    ]);
    const mutedSet = new Set(muted);
    const authorIds = [viewerId, ...followingIds.filter((id) => !mutedSet.has(id))];
    const stories = await this.visibleActive(viewerId, authorIds);

    const groups = new Map<string, ActiveStory[]>();
    for (const story of stories) {
      const list = groups.get(story.authorId) ?? [];
      list.push(story);
      groups.set(story.authorId, list);
    }
    if (groups.size === 0) return [];

    const authors = await this.prisma.user.findMany({
      where: { id: { in: [...groups.keys()] } },
      select: userSummarySelect(viewerId),
    });
    const items: StoryTrayItemDto[] = [];
    for (const author of authors) {
      const list = groups.get(author.id) ?? [];
      const latest = list[list.length - 1];
      if (!latest) continue;
      const isCloseFriends = list.some((s) => s.audience === 'CLOSE_FRIENDS');
      items.push({
        author: {
          ...this.users.toSummary(author),
          hasActiveStory: true,
          isCloseFriendStory: isCloseFriends,
        },
        storyIds: list.map((s) => s.id),
        hasUnseen: author.id !== viewerId && list.some((s) => !s.viewed),
        isCloseFriends,
        latestAt: latest.createdAt.toISOString(),
      });
    }
    // Свои первыми, затем с непросмотренными, затем по свежести.
    const rank = (i: StoryTrayItemDto) => (i.author.id === viewerId ? 0 : i.hasUnseen ? 1 : 2);
    return items.sort((a, b) => rank(a) - rank(b) || b.latestAt.localeCompare(a.latestAt));
  }

  async listByUser(viewerId: string, userId: string): Promise<StoryDto[]> {
    await this.visibility.assertCanViewContent(viewerId, userId);
    const rows = await this.prisma.story.findMany({
      where: { authorId: userId, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: storySelect(viewerId),
    });
    const result: StoryDto[] = [];
    for (const row of rows) {
      if (await this.isAllowed(viewerId, row)) result.push(this.toStoryDto(row, viewerId));
    }
    return result;
  }

  async getById(viewerId: string, storyId: string): Promise<StoryDto> {
    return this.toStoryDto(await this.loadVisible(viewerId, storyId), viewerId);
  }

  async archive(userId: string, query: CursorQueryDto): Promise<StoryPageDto> {
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.story.findMany({
      where: {
        authorId: userId,
        ...(c
          ? {
              OR: [
                { createdAt: { lt: c.createdAt } },
                { createdAt: c.createdAt, id: { lt: c.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: storySelect(userId),
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => this.toStoryDto(r, userId)),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  // ---------- Создание и удаление ----------

  async create(user: SessionUser, dto: CreateStoryDto): Promise<StoryDto> {
    const authorId = user.id;
    if (!dto.mediaId === !dto.sharedPostId) {
      throw validationError('mediaId', 'Provide exactly one of mediaId or sharedPostId');
    }
    if (dto.sharedPostId) await this.assertCanShare(authorId, dto.sharedPostId);

    const stickers = await this.prepareStickers(authorId, dto.stickers ?? []);
    const now = new Date();
    const story = await this.prisma.$transaction(async (tx) => {
      let durationSec = dto.durationSec ?? DEFAULT_DURATION_SEC;
      if (dto.mediaId) {
        await this.media.attach(authorId, [dto.mediaId], {
          target: 'STORY',
          purposes: ['STORY'],
          tx,
        });
        const file = await tx.mediaFile.findUniqueOrThrow({
          where: { id: dto.mediaId },
          select: { kind: true, durationSec: true },
        });
        // У видео длительность берём из файла (не больше 60 с), у фото — из запроса.
        if (file.kind === 'VIDEO' && file.durationSec) {
          durationSec = Math.min(60, Math.max(1, Math.ceil(file.durationSec)));
        }
      }
      return tx.story.create({
        data: {
          authorId,
          mediaId: dto.mediaId ?? null,
          sharedPostId: dto.sharedPostId ?? null,
          audience: dto.audience ?? 'EVERYONE',
          durationSec,
          expiresAt: new Date(now.getTime() + STORY_TTL_MS),
          stickers: { create: stickers },
        },
        select: { id: true },
      });
    });

    // Уведомления об упоминаниях — после успешной транзакции.
    const mentioned = new Set(
      stickers
        .filter((s) => s.type === 'MENTION')
        .map((s) => (s.data as { userId: string }).userId),
    );
    for (const recipientId of mentioned) {
      if (recipientId === authorId) continue;
      await this.notifications.create({
        recipientId,
        actorId: authorId,
        type: 'MENTION_STORY',
        storyId: story.id,
      });
    }
    return this.getDto(authorId, story.id);
  }

  // Делиться можно своей публикацией или видимой чужой, если её автор разрешил (allowStoryResharing).
  private async assertCanShare(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: 'PUBLISHED', isArchived: false },
      select: {
        authorId: true,
        author: {
          select: { isPrivate: true, settings: { select: { allowStoryResharing: true } } },
        },
      },
    });
    if (!post) throw new NotFoundException();
    if (post.authorId === userId) return;
    await this.visibility.assertCanViewContent(userId, post.authorId);
    if (post.author.isPrivate || post.author.settings?.allowStoryResharing === false) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'The author does not allow sharing this post to stories',
      });
    }
  }

  private async prepareStickers(authorId: string, input: NonNullable<CreateStoryDto['stickers']>) {
    const rows: {
      type: NonNullable<CreateStoryDto['stickers']>[number]['type'];
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      data: Prisma.InputJsonObject;
    }[] = [];
    for (const [index, sticker] of input.entries()) {
      const data = normalizeStickerData(sticker, index);
      if (sticker.type === 'MENTION') {
        const user = await this.prisma.user.findFirst({
          where: { id: data.userId as string, ...this.visibility.visibleUserWhere(authorId) },
          select: { id: true },
        });
        if (!user) throw validationError(`stickers.${index}.data`, 'Mentioned user not found');
      }
      if (sticker.type === 'LOCATION') {
        const place = await this.prisma.location.findUnique({
          where: { id: data.locationId as string },
          select: { id: true },
        });
        if (!place) throw validationError(`stickers.${index}.data`, 'Location not found');
      }
      rows.push({
        type: sticker.type,
        x: sticker.x,
        y: sticker.y,
        width: sticker.width,
        height: sticker.height,
        rotation: sticker.rotation,
        data,
      });
    }
    return rows;
  }

  async remove(user: SessionUser, storyId: string): Promise<void> {
    // Автор удаляет свою историю, администратор — любую (по жалобе).
    const story =
      user.role === 'ADMIN' ? await this.loadAny(storyId) : await this.loadOwn(user, storyId);
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { storyId } }),
      this.prisma.story.delete({ where: { id: storyId } }), // стикеры, просмотры, лайки, актуальное — каскадом
    ]);
    // Файл удаляем после успешной транзакции.
    if (story.mediaId) await this.media.removeFiles([story.mediaId]);
  }

  // ---------- Просмотры, лайки, зрители ----------

  async markViewed(viewerId: string, storyId: string): Promise<void> {
    const story = await this.loadVisible(viewerId, storyId);
    if (story.authorId === viewerId) return; // автор свои просмотры не создаёт
    await this.prisma.storyView.createMany({
      data: [{ storyId, viewerId }],
      skipDuplicates: true,
    });
  }

  async like(userId: string, storyId: string): Promise<void> {
    await this.loadVisible(userId, storyId);
    await this.prisma.storyLike.createMany({ data: [{ storyId, userId }], skipDuplicates: true });
  }

  async unlike(userId: string, storyId: string): Promise<void> {
    await this.loadVisible(userId, storyId);
    await this.prisma.storyLike.deleteMany({ where: { storyId, userId } });
  }

  async viewers(
    user: SessionUser,
    storyId: string,
    query: CursorQueryDto,
  ): Promise<StoryViewerPageDto> {
    await this.loadOwn(user, storyId);
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.storyView.findMany({
      where: {
        storyId,
        viewer: this.visibility.visibleUserWhere(user.id),
        ...(c
          ? {
              OR: [
                { viewedAt: { lt: c.createdAt } },
                { viewedAt: c.createdAt, viewerId: { lt: c.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ viewedAt: 'desc' }, { viewerId: 'desc' }],
      take: query.limit + 1,
      select: { viewedAt: true, viewerId: true, viewer: { select: userSummarySelect(user.id) } },
    });
    const page = rows.slice(0, query.limit);
    const ids = page.map((r) => r.viewerId);
    const [likes, reactions] = await Promise.all([
      this.prisma.storyLike.findMany({
        where: { storyId, userId: { in: ids } },
        select: { userId: true },
      }),
      this.prisma.message.findMany({
        where: { storyId, type: 'STORY_REACTION', senderId: { in: ids }, unsentAt: null },
        orderBy: { createdAt: 'desc' },
        select: { senderId: true, text: true },
      }),
    ]);
    const liked = new Set(likes.map((l) => l.userId));
    const reactionOf = new Map<string, string | null>();
    for (const r of reactions)
      if (r.senderId && !reactionOf.has(r.senderId)) reactionOf.set(r.senderId, r.text);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        ...this.users.toSummary(r.viewer),
        liked: liked.has(r.viewerId),
        reaction: reactionOf.get(r.viewerId) ?? null,
        viewedAt: r.viewedAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.viewedAt, id: last.viewerId })
          : null,
    };
  }

  // ---------- Ответы и реакции → Direct (T2.B2) ----------

  async reply(user: SessionUser, storyId: string, text: string): Promise<MessageDto> {
    const story = await this.loadReplyTarget(user.id, storyId);
    return this.chats.sendSystemMessage({
      senderId: user.id,
      recipientId: story.authorId,
      type: 'STORY_REPLY',
      storyId,
      text,
    });
  }

  async react(user: SessionUser, storyId: string, emoji: string): Promise<MessageDto> {
    const story = await this.loadReplyTarget(user.id, storyId);
    return this.chats.sendSystemMessage({
      senderId: user.id,
      recipientId: story.authorId,
      type: 'STORY_REACTION',
      storyId,
      text: emoji,
    });
  }

  private async loadReplyTarget(userId: string, storyId: string): Promise<StoryRow> {
    const story = await this.loadVisible(userId, storyId);
    if (story.authorId === userId) {
      throw validationError('storyId', 'You cannot reply to your own story');
    }
    return story;
  }

  // ---------- Интерактивные стикеры ----------

  async respondToSticker(
    user: SessionUser,
    storyId: string,
    stickerId: string,
    value: unknown,
  ): Promise<void> {
    const story = await this.loadVisible(user.id, storyId);
    const sticker = story.stickers.find((s) => s.id === stickerId);
    if (!sticker) throw new NotFoundException();
    if (story.authorId === user.id) {
      throw validationError('stickerId', 'You cannot respond to your own sticker');
    }
    if (!isInteractive(sticker.type)) {
      throw validationError('stickerId', 'This sticker does not accept responses');
    }
    const parsed = parseStickerResponse(
      sticker.type,
      sticker.data as Record<string, unknown>,
      value,
    );
    await this.prisma.storyStickerResponse.upsert({
      where: { stickerId_userId: { stickerId, userId: user.id } },
      create: { stickerId, userId: user.id, value: parsed },
      update: { value: parsed },
    });
  }

  async stickerResponses(
    user: SessionUser,
    storyId: string,
    stickerId: string,
    query: CursorQueryDto,
  ): Promise<StickerResponsesPageDto> {
    await this.loadOwn(user, storyId);
    const sticker = await this.prisma.storySticker.findFirst({
      where: { id: stickerId, storyId },
      select: { type: true, data: true },
    });
    if (!sticker) throw new NotFoundException();

    const base: Prisma.StoryStickerResponseWhereInput = {
      stickerId,
      user: this.visibility.visibleUserWhere(user.id),
    };
    const c = query.cursor ? decodeCursor(query.cursor) : null;
    const [rows, all] = await Promise.all([
      this.prisma.storyStickerResponse.findMany({
        where: {
          ...base,
          ...(c
            ? {
                OR: [
                  { createdAt: { lt: c.createdAt } },
                  { createdAt: c.createdAt, userId: { lt: c.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
        take: query.limit + 1,
        select: {
          userId: true,
          value: true,
          createdAt: true,
          user: { select: userSummarySelect(user.id) },
        },
      }),
      this.prisma.storyStickerResponse.findMany({ where: base, select: { value: true } }),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        user: this.users.toSummary(r.user),
        value: r.value,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.createdAt, id: last.userId })
          : null,
      total: all.length,
      summary: summarizeResponses(
        sticker.type,
        sticker.data as Record<string, unknown>,
        all.map((r) => r.value),
      ),
    };
  }
}
