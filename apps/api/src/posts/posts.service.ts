import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  decodeCursor,
  decodeOffsetCursor,
  encodeCursor,
  encodeOffsetCursor,
} from '@/common/pagination/cursor';
import type { Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import type { SessionUser } from '@/common/session/session-user';
import { validationError } from '@/common/validation';
import { CommentsService } from '@/comments/comments.service';
import { FollowsService } from '@/follows/follows.service';
import type { AudienceSetting, Prisma } from '@/generated/prisma/client';
import { toLocationDto } from '@/locations/locations.service';
import { MediaService } from '@/media/media.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { TagsService } from '@/tags/tags.service';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import {
  CreatePostDto,
  LikerDto,
  LikesQueryDto,
  PostDto,
  PostTagInputDto,
  UpdatePostDto,
  MAX_COLLABORATORS,
} from './dto/posts.dto';
import { PostRow, postSelect } from './post.select';

const MAX_PINNED = 3;
const MAX_HASHTAGS = 30;
const MAX_MENTIONS = 20;
const PLAY_INTERVAL_MS = 60 * 60 * 1000;

interface TagRow {
  position: number;
  taggedUserId: string;
  x: number;
  y: number;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
    private readonly follows: FollowsService,
    private readonly media: MediaService,
    private readonly tags: TagsService,
    private readonly notifications: NotificationsService,
    private readonly comments: CommentsService,
  ) {}

  // ---------- Публичное API для других модулей (collections, chats, users, comments) ----------

  /** select для публикации с учётом зрителя. Вместе с toPostDto даёт PostDto из API_CONTRACT §1.4. */
  postSelect(viewerId: string) {
    return postSelect(viewerId);
  }

  /** PostDto из строки, выбранной через postSelect(viewerId). viewerId должен совпадать с тем, что в select. */
  toPostDto(row: PostRow, viewerId: string): PostDto {
    const isAuthor = row.authorId === viewerId;
    const hasVideo = row.media.some((m) => m.media.kind === 'VIDEO');
    return {
      id: row.id,
      shortcode: row.shortcode,
      type: row.type,
      status: row.status,
      author: this.users.toSummary(row.author),
      collaborators: row.collaborators.map((c) => this.users.toSummary(c.user)),
      items: row.media.map((m) => ({
        position: m.position,
        media: this.media.toMediaItem(m.media),
        altText: m.altText,
        tags: row.userTags
          .filter((t) => t.position === m.position)
          .map((t) => ({ user: this.users.toSummary(t.tagged), x: t.x, y: t.y })),
      })),
      caption: row.caption,
      location: row.location ? toLocationDto(row.location) : null,
      likeCount: row.hideLikeCount && !isAuthor ? null : row._count.likes,
      commentCount: row._count.comments,
      playCount: hasVideo ? row.playCount : null,
      isLikedByMe: row.likes.length > 0,
      isSavedByMe: false, // TODO(collections, A): SavedPost текущего зрителя
      commentsDisabled: row.commentsDisabled,
      hideLikeCount: row.hideLikeCount,
      isPinned: row.pinnedAt !== null,
      isArchived: row.isArchived,
      editedAt: row.editedAt ? row.editedAt.toISOString() : null,
      publishedAt: row.publishedAt.toISOString(),
      previewComments: row.comments.map((c) => this.comments.toCommentDto(c)),
    };
  }

  /** Число публикаций автора (для Profile.postCount): опубликованные, не в архиве. */
  countByAuthor(userId: string): Promise<number> {
    return this.prisma.post.count({
      where: { authorId: userId, status: 'PUBLISHED', isArchived: false },
    });
  }

  /** Публикация, если viewer может её видеть, иначе null (не бросает). Для collections и chats. */
  async findVisibleById(viewerId: string, postId: string): Promise<PostDto | null> {
    try {
      return await this.getById(viewerId, postId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) return null;
      throw error;
    }
  }

  // ---------- Создание ----------

  async create(user: SessionUser, dto: CreatePostDto): Promise<PostDto> {
    const authorId = user.id;
    const caption = dto.caption?.trim() || null;
    if (dto.type === 'REEL' && dto.items.length !== 1) {
      throw validationError('items', 'A reel must contain exactly one video');
    }
    const parsed = this.parseCaption(caption);
    if (dto.locationId) await this.assertLocationExists(dto.locationId);

    const tagRows = await this.resolveTagRows(
      authorId,
      dto.items.map((item, position) => ({ position, tags: item.tags })),
      'items',
    );
    const collaboratorIds = await this.resolveCollaborators(authorId, dto.collaboratorIds);
    const mentionIds = await this.resolveMentionIds(authorId, parsed.mentions);

    const mediaIds = dto.items.map((i) => i.mediaId);
    const postId = await this.prisma.$transaction(async (tx) => {
      await this.media.attach(authorId, mediaIds, {
        target: 'POST',
        purposes: [dto.type === 'REEL' ? 'REEL' : 'POST'],
        tx,
      });
      if (dto.type === 'REEL') {
        const file = await tx.mediaFile.findFirst({
          where: { id: mediaIds[0] },
          select: { kind: true },
        });
        if (file?.kind !== 'VIDEO')
          throw validationError('items', 'A reel must contain exactly one video');
      }
      const post = await tx.post.create({
        data: {
          shortcode: randomBytes(9).toString('base64url'),
          authorId,
          type: dto.type,
          status: 'PUBLISHED',
          caption,
          locationId: dto.locationId ?? null,
          commentsDisabled: dto.commentsDisabled ?? false,
          hideLikeCount: dto.hideLikeCount ?? false,
          media: {
            create: dto.items.map((item, position) => ({
              position,
              mediaId: item.mediaId,
              altText: item.altText?.trim() || null,
            })),
          },
        },
        select: { id: true },
      });
      await this.linkHashtags(tx, post.id, parsed.hashtags);
      if (mentionIds.length > 0) {
        await tx.postMention.createMany({
          data: mentionIds.map((userId) => ({ postId: post.id, userId })),
        });
      }
      if (tagRows.length > 0) {
        await tx.postUserTag.createMany({ data: tagRows.map((t) => ({ ...t, postId: post.id })) });
      }
      if (collaboratorIds.length > 0) {
        await tx.postCollaborator.createMany({
          data: collaboratorIds.map((userId) => ({ postId: post.id, userId })),
        });
      }
      return post.id;
    });

    // Уведомления — только после успешной транзакции.
    const tagged = [...new Set(tagRows.map((t) => t.taggedUserId))];
    await this.notifyAll(authorId, postId, 'POST_TAG', tagged);
    await this.notifyAll(
      authorId,
      postId,
      'MENTION_POST',
      mentionIds.filter((id) => !tagged.includes(id)),
    );
    await this.notifyAll(authorId, postId, 'COLLAB_INVITE', collaboratorIds);

    return this.getById(authorId, postId);
  }

  // ---------- Просмотр ----------

  getById(viewerId: string, postId: string): Promise<PostDto> {
    return this.loadVisible(viewerId, { id: postId });
  }

  getByShortcode(viewerId: string, shortcode: string): Promise<PostDto> {
    return this.loadVisible(viewerId, { shortcode });
  }

  // ---------- Изменение ----------

  async update(user: SessionUser, postId: string, dto: UpdatePostDto): Promise<PostDto> {
    await this.loadOwned(user.id, postId);
    const data: Prisma.PostUpdateInput = {};
    let edited = false;

    let parsed: { hashtags: string[]; mentions: string[] } | null = null;
    let newMentionIds: string[] = [];
    if (dto.caption !== undefined) {
      const caption = dto.caption.trim() || null;
      parsed = this.parseCaption(caption);
      data.caption = caption;
      edited = true;
    }
    if (dto.locationId !== undefined) {
      if (dto.locationId !== null) await this.assertLocationExists(dto.locationId);
      data.location =
        dto.locationId === null ? { disconnect: true } : { connect: { id: dto.locationId } };
      edited = true;
    }
    if (dto.hideLikeCount !== undefined) data.hideLikeCount = dto.hideLikeCount;
    if (dto.commentsDisabled !== undefined) data.commentsDisabled = dto.commentsDisabled;

    const positions = new Set(
      (await this.prisma.postMedia.findMany({ where: { postId }, select: { position: true } })).map(
        (m) => m.position,
      ),
    );
    const items = dto.items ?? [];
    for (const [i, item] of items.entries()) {
      if (!positions.has(item.position)) {
        throw validationError(`items.${i}.position`, 'Unknown item position');
      }
    }
    const tagRows = await this.resolveTagRows(
      user.id,
      items
        .filter((i) => i.tags !== undefined)
        .map((i) => ({ position: i.position, tags: i.tags })),
      'items',
    );
    const previousTagged = new Set(
      (
        await this.prisma.postUserTag.findMany({
          where: { postId },
          select: { taggedUserId: true },
        })
      ).map((t) => t.taggedUserId),
    );
    if (parsed) {
      const previousMentions = new Set(
        (
          await this.prisma.postMention.findMany({ where: { postId }, select: { userId: true } })
        ).map((m) => m.userId),
      );
      const mentionIds = await this.resolveMentionIds(user.id, parsed.mentions);
      newMentionIds = mentionIds.filter((id) => !previousMentions.has(id));
      parsed = { ...parsed, mentions: mentionIds };
    }
    if (items.length > 0) edited = true;
    if (edited) data.editedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.post.update({ where: { id: postId }, data });
      if (parsed) {
        await tx.postHashtag.deleteMany({ where: { postId } });
        await this.linkHashtags(tx, postId, parsed.hashtags);
        await tx.postMention.deleteMany({ where: { postId } });
        if (parsed.mentions.length > 0) {
          await tx.postMention.createMany({
            data: parsed.mentions.map((userId) => ({ postId, userId })),
          });
        }
      }
      for (const item of items) {
        if (item.altText !== undefined) {
          await tx.postMedia.update({
            where: { postId_position: { postId, position: item.position } },
            data: { altText: item.altText.trim() || null },
          });
        }
        if (item.tags !== undefined) {
          await tx.postUserTag.deleteMany({ where: { postId, position: item.position } });
        }
      }
      if (tagRows.length > 0) {
        await tx.postUserTag.createMany({ data: tagRows.map((t) => ({ ...t, postId })) });
      }
    });

    const newlyTagged = [...new Set(tagRows.map((t) => t.taggedUserId))].filter(
      (id) => !previousTagged.has(id),
    );
    await this.notifyAll(user.id, postId, 'POST_TAG', newlyTagged);
    await this.notifyAll(
      user.id,
      postId,
      'MENTION_POST',
      newMentionIds.filter((id) => !newlyTagged.includes(id)),
    );
    return this.getById(user.id, postId);
  }

  async remove(user: SessionUser, postId: string): Promise<void> {
    const post = await this.loadOwned(user.id, postId, user.role === 'ADMIN');
    const files = await this.prisma.postMedia.findMany({
      where: { postId },
      select: { mediaId: true },
    });
    // PostMedia, лайки, отметки и связи удаляются каскадом.
    await this.prisma.post.delete({ where: { id: post.id } });
    await this.prisma.notification.deleteMany({ where: { postId } });
    await this.media.removeFiles(files.map((f) => f.mediaId));
  }

  async setArchived(userId: string, postId: string, archived: boolean): Promise<void> {
    await this.loadOwned(userId, postId);
    await this.prisma.post.update({
      where: { id: postId },
      data: archived ? { isArchived: true, pinnedAt: null } : { isArchived: false },
    });
  }

  async setPinned(userId: string, postId: string, pinned: boolean): Promise<void> {
    const post = await this.loadOwned(userId, postId);
    if (!pinned) {
      await this.prisma.post.update({ where: { id: postId }, data: { pinnedAt: null } });
      return;
    }
    if (post.pinnedAt) return; // уже закреплён
    if (post.isArchived) throw validationError('postId', 'An archived post cannot be pinned');
    const count = await this.prisma.post.count({
      where: { authorId: userId, pinnedAt: { not: null } },
    });
    if (count >= MAX_PINNED) {
      throw new ConflictException({ code: 'LIMIT_REACHED', message: 'You can pin up to 3 posts' });
    }
    await this.prisma.post.update({ where: { id: postId }, data: { pinnedAt: new Date() } });
  }

  // ---------- Соавторы ----------

  async acceptCollaboration(userId: string, postId: string): Promise<void> {
    const { count } = await this.prisma.postCollaborator.updateMany({
      where: { postId, userId, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });
    if (count === 0) throw new NotFoundException();
  }

  async leaveCollaboration(userId: string, postId: string): Promise<void> {
    const { count } = await this.prisma.postCollaborator.deleteMany({ where: { postId, userId } });
    if (count === 0) throw new NotFoundException();
  }

  // ---------- Лайки и воспроизведения ----------

  async like(userId: string, postId: string): Promise<void> {
    const post = await this.loadVisibleLite(userId, postId);
    // skipDuplicates: повторный PUT ничего не меняет и не шлёт второе уведомление.
    const { count } = await this.prisma.postLike.createMany({
      data: [{ userId, postId }],
      skipDuplicates: true,
    });
    if (count > 0) {
      await this.notifications.create({
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKE',
        postId,
      });
    }
  }

  async unlike(userId: string, postId: string): Promise<void> {
    const post = await this.loadVisibleLite(userId, postId);
    const { count } = await this.prisma.postLike.deleteMany({ where: { userId, postId } });
    if (count > 0) {
      await this.notifications.remove({
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKE',
        postId,
      });
    }
  }

  async likes(viewerId: string, postId: string, query: LikesQueryDto): Promise<Page<LikerDto>> {
    const post = await this.loadVisibleLite(viewerId, postId);
    if (post.hideLikeCount && post.authorId !== viewerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'The author hid the likes' });
    }
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const q = query.q?.trim();
    const rows = await this.prisma.postLike.findMany({
      where: {
        postId,
        user: {
          AND: [
            this.visibility.visibleUserWhere(viewerId),
            q
              ? {
                  OR: [
                    { userName: { contains: q, mode: 'insensitive' } },
                    { fullName: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {},
          ],
        },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, userId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        userId: true,
        createdAt: true,
        user: { select: userSummarySelect(viewerId) },
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: pageRows.map((r) => r.userId) } },
      select: { followingId: true, status: true },
    });
    const statusOf = new Map(follows.map((f) => [f.followingId, f.status]));
    const last = pageRows[pageRows.length - 1];
    return {
      items: pageRows.map((r) => {
        const status = statusOf.get(r.userId);
        return {
          ...this.users.toSummary(r.user),
          followStatus:
            status === 'ACCEPTED' ? 'FOLLOWING' : status === 'PENDING' ? 'REQUESTED' : 'NONE',
        };
      }),
      nextCursor:
        hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.userId }) : null,
    };
  }

  async registerPlay(userId: string, postId: string): Promise<void> {
    await this.loadVisibleLite(userId, postId);
    const now = new Date();
    const threshold = new Date(now.getTime() - PLAY_INTERVAL_MS);
    await this.prisma.$transaction(async (tx) => {
      const key = { userId_postId: { userId, postId } };
      const existing = await tx.postPlay.findUnique({
        where: key,
        select: { lastCountedAt: true },
      });
      if (existing && existing.lastCountedAt > threshold) return; // не чаще раза в час
      await tx.postPlay.upsert({
        where: key,
        update: { lastCountedAt: now },
        create: { userId, postId, lastCountedAt: now },
      });
      await tx.post.update({ where: { id: postId }, data: { playCount: { increment: 1 } } });
    });
  }

  // ---------- Ленты и списки ----------

  // «Главная»: подписки и свои публикации, без скрытых (mute). Элементы CAUGHT_UP / SUGGESTED_USERS не отдаём (отложено).
  async feed(viewerId: string, query: CursorQueryDto, only?: 'favorites'): Promise<Page<PostDto>> {
    const following = await this.follows.getFollowingIds(viewerId);
    const muted = new Set(await this.visibility.getMutedUserIds(viewerId, 'posts'));
    let authors = [...following, ...(only ? [] : [viewerId])];
    if (only === 'favorites') {
      const favorites = new Set(await this.visibility.getFavoriteIds(viewerId));
      authors = following.filter((id) => favorites.has(id));
    }
    authors = authors.filter((id) => !muted.has(id));
    return this.pageByTime(viewerId, [{ authorId: { in: authors } }], query);
  }

  // «Интересное»: чужие видимые публикации и reels, по числу лайков, затем по новизне.
  explore(viewerId: string, query: CursorQueryDto): Promise<Page<PostDto>> {
    return this.pageByPopularity(viewerId, [{ authorId: { not: viewerId } }], query);
  }

  reels(viewerId: string, query: CursorQueryDto): Promise<Page<PostDto>> {
    return this.pageByTime(viewerId, [{ type: 'REEL' }], query);
  }

  // Сетка профиля: публикации (закреплённые первыми на первой странице), reels или отмеченные.
  async userGrid(
    viewerId: string,
    userId: string,
    kind: 'POSTS' | 'REELS' | 'TAGGED',
    query: CursorQueryDto,
  ): Promise<Page<PostDto>> {
    await this.visibility.assertCanViewContent(viewerId, userId);
    if (kind === 'TAGGED') {
      return this.pageByTime(viewerId, [{ userTags: { some: { taggedUserId: userId } } }], query);
    }
    const type = kind === 'REELS' ? 'REEL' : 'POST';
    if (kind === 'REELS') return this.pageByTime(viewerId, [{ authorId: userId, type }], query);

    const page = await this.pageByTime(
      viewerId,
      [{ authorId: userId, type, pinnedAt: null }],
      query,
    );
    if (query.cursor) return page;
    const pinned = await this.prisma.post.findMany({
      where: {
        authorId: userId,
        type,
        pinnedAt: { not: null },
        isArchived: false,
        status: 'PUBLISHED',
      },
      select: postSelect(viewerId),
      orderBy: { pinnedAt: 'desc' },
      take: MAX_PINNED,
    });
    return {
      items: [...pinned.map((row) => this.toPostDto(row, viewerId)), ...page.items],
      nextCursor: page.nextCursor,
    };
  }

  // Архив автора: видит только он сам.
  async archive(userId: string, query: CursorQueryDto): Promise<Page<PostDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.post.findMany({
      where: { authorId: userId, isArchived: true, ...(cursor ? this.cursorWhere(cursor) : {}) },
      select: postSelect(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return this.toTimePage(rows, userId, query.limit);
  }

  async hashtagPosts(
    viewerId: string,
    rawName: string,
    tab: 'TOP' | 'RECENT',
    query: CursorQueryDto,
  ): Promise<Page<PostDto>> {
    const name = rawName.trim().replace(/^#/, '').toLowerCase();
    const hashtag = await this.prisma.hashtag.findUnique({ where: { name }, select: { id: true } });
    if (!hashtag) throw new NotFoundException('Hashtag not found');
    const extra: Prisma.PostWhereInput[] = [{ hashtags: { some: { hashtagId: hashtag.id } } }];
    return tab === 'TOP'
      ? this.pageByPopularity(viewerId, extra, query)
      : this.pageByTime(viewerId, extra, query);
  }

  async locationPosts(
    viewerId: string,
    locationId: string,
    tab: 'TOP' | 'RECENT',
    query: CursorQueryDto,
  ): Promise<Page<PostDto>> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    const extra: Prisma.PostWhereInput[] = [{ locationId }];
    return tab === 'TOP'
      ? this.pageByPopularity(viewerId, extra, query)
      : this.pageByTime(viewerId, extra, query);
  }

  // ---------- Внутреннее ----------

  // Публикации, которые viewer может видеть в любом списке.
  private visiblePosts(viewerId: string): Prisma.PostWhereInput {
    return {
      status: 'PUBLISHED',
      isArchived: false,
      author: this.visibility.visibleAuthorWhere(viewerId),
    };
  }

  private cursorWhere(cursor: { createdAt: Date; id: string }): Prisma.PostWhereInput {
    return {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    };
  }

  private async pageByTime(
    viewerId: string,
    extra: Prisma.PostWhereInput[],
    query: CursorQueryDto,
  ): Promise<Page<PostDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.post.findMany({
      where: {
        AND: [this.visiblePosts(viewerId), ...extra, cursor ? this.cursorWhere(cursor) : {}],
      },
      select: postSelect(viewerId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return this.toTimePage(rows, viewerId, query.limit);
  }

  private toTimePage(rows: PostRow[], viewerId: string, limit: number): Page<PostDto> {
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: items.map((row) => this.toPostDto(row, viewerId)),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  // Порядок по популярности нестабилен во времени, поэтому курсор — смещение (ADR 0017).
  private async pageByPopularity(
    viewerId: string,
    extra: Prisma.PostWhereInput[],
    query: CursorQueryDto,
  ): Promise<Page<PostDto>> {
    const offset = query.cursor ? decodeOffsetCursor(query.cursor) : 0;
    const rows = await this.prisma.post.findMany({
      where: { AND: [this.visiblePosts(viewerId), ...extra] },
      select: postSelect(viewerId),
      orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    return {
      items: rows.slice(0, query.limit).map((row) => this.toPostDto(row, viewerId)),
      nextCursor: hasMore ? encodeOffsetCursor(offset + query.limit) : null,
    };
  }

  // Один объект для зрителя: блокировка -> 404, закрытый аккаунт -> 403, чужой архив -> 404.
  private async loadVisible(
    viewerId: string,
    where: { id: string } | { shortcode: string },
  ): Promise<PostDto> {
    const row = await this.prisma.post.findFirst({ where, select: postSelect(viewerId) });
    if (!row) throw new NotFoundException();
    await this.visibility.assertCanViewContent(viewerId, row.authorId);
    if ((row.isArchived || row.status !== 'PUBLISHED') && row.authorId !== viewerId) {
      throw new NotFoundException();
    }
    return this.toPostDto(row, viewerId);
  }

  // То же без сборки DTO: для лайков, воспроизведений.
  private async loadVisibleLite(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, isArchived: true, status: true, hideLikeCount: true },
    });
    if (!post) throw new NotFoundException();
    await this.visibility.assertCanViewContent(viewerId, post.authorId);
    if ((post.isArchived || post.status !== 'PUBLISHED') && post.authorId !== viewerId) {
      throw new NotFoundException();
    }
    return post;
  }

  // Публикация для изменения: автор (или админ, если allowAdmin). Остальным — 403, если пост виден, иначе 404.
  private async loadOwned(userId: string, postId: string, allowAdmin = false) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, isArchived: true, pinnedAt: true },
    });
    if (!post) throw new NotFoundException();
    if (post.authorId === userId || allowAdmin) return post;
    await this.visibility.assertCanViewContent(userId, post.authorId);
    if (post.isArchived) throw new NotFoundException();
    throw new ForbiddenException();
  }

  private parseCaption(caption: string | null): { hashtags: string[]; mentions: string[] } {
    if (!caption) return { hashtags: [], mentions: [] };
    const parsed = this.tags.parse(caption, { maxHashtags: 1000, maxMentions: 1000 });
    if (parsed.hashtags.length > MAX_HASHTAGS) {
      throw validationError('caption', `A caption can contain up to ${MAX_HASHTAGS} hashtags`);
    }
    if (parsed.mentions.length > MAX_MENTIONS) {
      throw validationError('caption', `A caption can contain up to ${MAX_MENTIONS} mentions`);
    }
    return parsed;
  }

  private async assertLocationExists(locationId: string): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) throw validationError('locationId', 'Location not found');
  }

  private async linkHashtags(
    tx: Prisma.TransactionClient,
    postId: string,
    names: string[],
  ): Promise<void> {
    const hashtagIds = await this.tags.upsertHashtags(names, tx);
    if (hashtagIds.length > 0) {
      await tx.postHashtag.createMany({
        data: hashtagIds.map((hashtagId) => ({ postId, hashtagId })),
      });
    }
  }

  /**
   * Кого из users actor может отметить/упомянуть/пригласить по настройке пользователя (tagsFrom, mentionsFrom).
   * FOLLOWING — пользователь подписан на actor, MUTUAL — подписаны друг на друга.
   */
  private async allowedByAudience(
    actorId: string,
    users: { id: string; setting: AudienceSetting }[],
  ): Promise<Set<string>> {
    const ids = users.map((u) => u.id);
    const follows = await this.prisma.follow.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { followerId: { in: ids }, followingId: actorId },
          { followerId: actorId, followingId: { in: ids } },
        ],
      },
      select: { followerId: true, followingId: true },
    });
    const followsActor = new Set(
      follows.filter((f) => f.followingId === actorId).map((f) => f.followerId),
    );
    const actorFollows = new Set(
      follows.filter((f) => f.followerId === actorId).map((f) => f.followingId),
    );
    const allowed = new Set<string>();
    for (const { id, setting } of users) {
      if (setting === 'EVERYONE') allowed.add(id);
      else if (setting === 'FOLLOWING' && followsActor.has(id)) allowed.add(id);
      else if (setting === 'MUTUAL' && followsActor.has(id) && actorFollows.has(id))
        allowed.add(id);
    }
    return allowed;
  }

  // Отметки людей: существуют, видны автору, их настройка tagsFrom разрешает автору. Иначе 400.
  private async resolveTagRows(
    authorId: string,
    items: { position: number; tags?: PostTagInputDto[] }[],
    field: string,
  ): Promise<TagRow[]> {
    const ids = [...new Set(items.flatMap((i) => (i.tags ?? []).map((t) => t.userId)))];
    if (ids.length === 0) return [];
    const found = await this.prisma.user.findMany({
      where: { id: { in: ids }, ...this.visibility.visibleUserWhere(authorId) },
      select: { id: true, settings: { select: { tagsFrom: true } } },
    });
    const allowed = await this.allowedByAudience(
      authorId,
      found.map((u) => ({ id: u.id, setting: u.settings?.tagsFrom ?? 'EVERYONE' })),
    );
    // Себя отмечать можно всегда.
    allowed.add(authorId);
    const rows: TagRow[] = [];
    for (const [i, item] of items.entries()) {
      const seen = new Set<string>();
      for (const tag of item.tags ?? []) {
        if (!found.some((u) => u.id === tag.userId) && tag.userId !== authorId) {
          throw validationError(`${field}.${i}.tags`, 'Tagged user not found');
        }
        if (!allowed.has(tag.userId)) {
          throw validationError(`${field}.${i}.tags`, 'This user does not allow being tagged');
        }
        if (seen.has(tag.userId)) continue;
        seen.add(tag.userId);
        rows.push({ position: item.position, taggedUserId: tag.userId, x: tag.x, y: tag.y });
      }
    }
    return rows;
  }

  private async resolveCollaborators(
    authorId: string,
    ids: string[] | undefined,
  ): Promise<string[]> {
    const unique = [...new Set(ids ?? [])];
    if (unique.length === 0) return [];
    if (unique.length > MAX_COLLABORATORS || unique.includes(authorId)) {
      throw validationError('collaboratorIds', 'Invalid collaborators');
    }
    const found = await this.prisma.user.count({
      where: { id: { in: unique }, ...this.visibility.visibleUserWhere(authorId) },
    });
    if (found !== unique.length) throw validationError('collaboratorIds', 'Collaborator not found');
    return unique;
  }

  // Упомянутые @userName: существуют, видны автору, mentionsFrom разрешает автору. Лишние молча пропускаются.
  private async resolveMentionIds(authorId: string, names: string[]): Promise<string[]> {
    const resolved = await this.tags.resolveMentions(names);
    const ids = resolved.map((u) => u.id).filter((id) => id !== authorId);
    if (ids.length === 0) return [];
    const found = await this.prisma.user.findMany({
      where: { id: { in: ids }, ...this.visibility.visibleUserWhere(authorId) },
      select: { id: true, settings: { select: { mentionsFrom: true } } },
    });
    const allowed = await this.allowedByAudience(
      authorId,
      found.map((u) => ({ id: u.id, setting: u.settings?.mentionsFrom ?? 'EVERYONE' })),
    );
    return found.map((u) => u.id).filter((id) => allowed.has(id));
  }

  private async notifyAll(
    actorId: string,
    postId: string,
    type: 'POST_TAG' | 'MENTION_POST' | 'COLLAB_INVITE',
    recipientIds: string[],
  ): Promise<void> {
    for (const recipientId of recipientIds) {
      await this.notifications.create({ recipientId, actorId, type, postId });
    }
  }
}
