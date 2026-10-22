import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { Prisma } from '@/generated/prisma/client';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { TagsService } from '@/tags/tags.service';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';
import { userSummarySelect } from '@/users/user-summary.select';
import { UsersService } from '@/users/users.service';
import { CommentRow, commentSelect, visibleCommentWhere } from './comment.select';
import {
  CommentDto,
  CommentsQueryDto,
  CreateCommentDto,
  UpdateCommentDto,
} from './dto/comments.dto';

const MAX_PINNED = 3;
const MAX_MENTIONS = 5;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly visibility: VisibilityService,
    private readonly tags: TagsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Публичное API для других модулей (posts) ----------

  /** Число комментариев (с ответами) к публикации, видимых зрителю. */
  countByPost(viewerId: string, postId: string): Promise<number> {
    return this.prisma.comment.count({ where: { postId, ...visibleCommentWhere(viewerId) } });
  }

  /** CommentDto из строки, выбранной через commentSelect(viewerId). */
  toCommentDto(row: CommentRow): CommentDto {
    return {
      id: row.id,
      postId: row.postId,
      parentId: row.parentId,
      author: this.users.toSummary(row.author),
      text: row.text,
      likeCount: row._count.likes,
      isLikedByMe: row.likes.length > 0,
      replyCount: row._count.replies,
      isPinned: row.pinnedAt !== null,
      isPendingApproval: row.isPendingApproval,
      editedAt: row.editedAt ? row.editedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ---------- Чтение ----------

  async list(viewerId: string, postId: string, query: CommentsQueryDto): Promise<Page<CommentDto>> {
    await this.loadPost(viewerId, postId);
    const base: Prisma.CommentWhereInput = {
      postId,
      parentId: null,
      ...visibleCommentWhere(viewerId),
    };
    const select = commentSelect(viewerId);
    // Закреплённые — только на первой странице, дальше листаем остальные.
    const pinned = query.cursor
      ? []
      : await this.prisma.comment.findMany({
          where: { ...base, pinnedAt: { not: null } },
          select,
          orderBy: { pinnedAt: 'desc' },
          take: MAX_PINNED,
        });
    const rest: Prisma.CommentWhereInput = { ...base, pinnedAt: null };

    if (query.sort === 'NEWEST') {
      const cursor = query.cursor ? decodeCursor(query.cursor) : null;
      const rows = await this.prisma.comment.findMany({
        where: {
          AND: [
            rest,
            cursor
              ? {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                }
              : {},
          ],
        },
        select,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      const hasMore = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      const last = items[items.length - 1];
      return {
        items: [...pinned, ...items].map((row) => this.toCommentDto(row)),
        nextCursor:
          hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
      };
    }

    // TOP: по числу лайков, порядок нестабилен во времени, поэтому курсор — смещение (ADR 0017).
    const offset = query.cursor ? decodeOffsetCursor(query.cursor) : 0;
    const rows = await this.prisma.comment.findMany({
      where: rest,
      select,
      orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    return {
      items: [...pinned, ...rows.slice(0, query.limit)].map((row) => this.toCommentDto(row)),
      nextCursor: hasMore ? encodeOffsetCursor(offset + query.limit) : null,
    };
  }

  async replies(
    viewerId: string,
    commentId: string,
    query: CursorQueryDto,
  ): Promise<Page<CommentDto>> {
    const parent = await this.loadVisibleComment(viewerId, commentId);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.comment.findMany({
      where: {
        AND: [
          { parentId: parent.id, ...visibleCommentWhere(viewerId) },
          cursor
            ? {
                OR: [
                  { createdAt: { gt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                ],
              }
            : {},
        ],
      },
      select: commentSelect(viewerId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map((row) => this.toCommentDto(row)),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  // ---------- Создание, правка, удаление ----------

  async create(user: SessionUser, postId: string, dto: CreateCommentDto): Promise<CommentDto> {
    const post = await this.loadPost(user.id, postId);
    const text = this.cleanText(dto.text);
    if (post.commentsDisabled) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Comments are disabled' });
    }
    if (post.authorId !== user.id) await this.assertCommentsFrom(post.authorId, user.id);

    let parent: { id: string; authorId: string } | null = null;
    if (dto.parentId) {
      const found = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, postId, ...visibleCommentWhere(user.id) },
        select: { id: true, authorId: true, parentId: true },
      });
      if (!found) throw new NotFoundException();
      if (found.parentId) {
        throw validationError('parentId', 'You can reply only to a top-level comment');
      }
      parent = found;
    }

    const mentionIds = await this.resolveMentionIds(user.id, text);
    // Комментарий ограниченного автором поста пользователя ждёт одобрения.
    const pending =
      post.authorId !== user.id && (await this.visibility.isRestricted(post.authorId, user.id));

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          postId,
          authorId: user.id,
          parentId: parent?.id ?? null,
          text,
          isPendingApproval: pending,
        },
        select: { id: true },
      });
      if (mentionIds.length > 0) {
        await tx.commentMention.createMany({
          data: mentionIds.map((userId) => ({ commentId: created.id, userId })),
        });
      }
      return created;
    });

    // Уведомления — только после успешной транзакции; о комментарии на одобрении не сообщаем.
    if (!pending) {
      const notified = new Set<string>();
      const notify = async (
        recipientId: string,
        type: 'COMMENT' | 'COMMENT_REPLY' | 'MENTION_COMMENT',
      ) => {
        if (notified.has(recipientId)) return;
        notified.add(recipientId);
        await this.notifications.create({
          recipientId,
          actorId: user.id,
          type,
          postId,
          commentId: comment.id,
        });
      };
      if (parent) await notify(parent.authorId, 'COMMENT_REPLY');
      await notify(post.authorId, 'COMMENT');
      for (const id of mentionIds) await notify(id, 'MENTION_COMMENT');
    }

    return this.getOne(user.id, comment.id);
  }

  async update(user: SessionUser, commentId: string, dto: UpdateCommentDto): Promise<CommentDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        postId: true,
        createdAt: true,
        post: { select: { authorId: true } },
      },
    });
    if (!comment) throw new NotFoundException();
    if (comment.authorId !== user.id) {
      await this.visibility.assertCanViewContent(user.id, comment.post.authorId);
      throw new ForbiddenException();
    }
    if (Date.now() - comment.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ConflictException({
        code: 'EDIT_WINDOW_EXPIRED',
        message: 'A comment can be edited within 15 minutes',
      });
    }
    const text = this.cleanText(dto.text);
    const mentionIds = await this.resolveMentionIds(user.id, text);
    const previous = new Set(
      (
        await this.prisma.commentMention.findMany({
          where: { commentId },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({ where: { id: commentId }, data: { text, editedAt: new Date() } });
      await tx.commentMention.deleteMany({ where: { commentId } });
      if (mentionIds.length > 0) {
        await tx.commentMention.createMany({
          data: mentionIds.map((userId) => ({ commentId, userId })),
        });
      }
    });

    for (const recipientId of mentionIds.filter((id) => !previous.has(id))) {
      await this.notifications.create({
        recipientId,
        actorId: user.id,
        type: 'MENTION_COMMENT',
        postId: comment.postId,
        commentId,
      });
    }
    return this.getOne(user.id, commentId);
  }

  async remove(user: SessionUser, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, post: { select: { authorId: true } } },
    });
    if (!comment) throw new NotFoundException();
    const allowed =
      comment.authorId === user.id || comment.post.authorId === user.id || user.role === 'ADMIN';
    if (!allowed) {
      await this.visibility.assertCanViewContent(user.id, comment.post.authorId);
      await this.loadVisibleComment(user.id, commentId);
      throw new ForbiddenException();
    }
    const replies = await this.prisma.comment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });
    const ids = [commentId, ...replies.map((r) => r.id)];
    // Ответы, лайки и упоминания удаляются каскадом.
    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.prisma.notification.deleteMany({ where: { commentId: { in: ids } } });
  }

  // ---------- Лайки ----------

  async like(userId: string, commentId: string): Promise<void> {
    const comment = await this.loadVisibleComment(userId, commentId);
    // skipDuplicates: повторный PUT ничего не меняет и не шлёт второе уведомление.
    const { count } = await this.prisma.commentLike.createMany({
      data: [{ userId, commentId }],
      skipDuplicates: true,
    });
    if (count > 0) {
      await this.notifications.create({
        recipientId: comment.authorId,
        actorId: userId,
        type: 'COMMENT_LIKE',
        postId: comment.postId,
        commentId,
      });
    }
  }

  async unlike(userId: string, commentId: string): Promise<void> {
    const comment = await this.loadVisibleComment(userId, commentId);
    const { count } = await this.prisma.commentLike.deleteMany({ where: { userId, commentId } });
    if (count > 0) {
      await this.notifications.remove({
        recipientId: comment.authorId,
        actorId: userId,
        type: 'COMMENT_LIKE',
        postId: comment.postId,
        commentId,
      });
    }
  }

  async likes(
    viewerId: string,
    commentId: string,
    query: CursorQueryDto,
  ): Promise<Page<UserSummaryDto>> {
    await this.loadVisibleComment(viewerId, commentId);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.commentLike.findMany({
      where: {
        commentId,
        user: this.visibility.visibleUserWhere(viewerId),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, userId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: { userId: true, createdAt: true, user: { select: userSummarySelect(viewerId) } },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map((r) => this.users.toSummary(r.user)),
      nextCursor:
        hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.userId }) : null,
    };
  }

  // ---------- Закрепление и одобрение (автор поста) ----------

  async setPinned(userId: string, commentId: string, pinned: boolean): Promise<void> {
    const comment = await this.loadOwnedByPostAuthor(userId, commentId);
    if (!pinned) {
      await this.prisma.comment.update({ where: { id: commentId }, data: { pinnedAt: null } });
      return;
    }
    if (comment.parentId) throw validationError('commentId', 'A reply cannot be pinned');
    if (comment.pinnedAt) return; // уже закреплён
    const count = await this.prisma.comment.count({
      where: { postId: comment.postId, pinnedAt: { not: null } },
    });
    if (count >= MAX_PINNED) {
      throw new ConflictException({
        code: 'LIMIT_REACHED',
        message: 'You can pin up to 3 comments',
      });
    }
    await this.prisma.comment.update({ where: { id: commentId }, data: { pinnedAt: new Date() } });
  }

  // Показать комментарий ограниченного пользователя. Не автору поста — 404.
  async approve(userId: string, commentId: string): Promise<void> {
    const { count } = await this.prisma.comment.updateMany({
      where: { id: commentId, post: { authorId: userId } },
      data: { isPendingApproval: false },
    });
    if (count === 0) throw new NotFoundException();
  }

  // ---------- Внутреннее ----------

  private async getOne(viewerId: string, commentId: string): Promise<CommentDto> {
    const row = await this.prisma.comment.findFirst({
      where: { id: commentId, ...visibleCommentWhere(viewerId) },
      select: commentSelect(viewerId),
    });
    if (!row) throw new NotFoundException();
    return this.toCommentDto(row);
  }

  private cleanText(raw: string): string {
    const text = raw.trim();
    if (!text) throw validationError('text', 'Comment text must not be empty');
    return text;
  }

  // Публикация, к которой viewer может обращаться: блокировка -> 404, закрытый аккаунт -> 403, чужой архив -> 404.
  private async loadPost(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, isArchived: true, status: true, commentsDisabled: true },
    });
    if (!post) throw new NotFoundException();
    await this.visibility.assertCanViewContent(viewerId, post.authorId);
    if ((post.isArchived || post.status !== 'PUBLISHED') && post.authorId !== viewerId) {
      throw new NotFoundException();
    }
    return post;
  }

  // Комментарий, который viewer видит (и пост которого он видит), иначе 404/403.
  private async loadVisibleComment(viewerId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, ...visibleCommentWhere(viewerId) },
      select: { id: true, postId: true, authorId: true, parentId: true },
    });
    if (!comment) throw new NotFoundException();
    await this.loadPost(viewerId, comment.postId);
    return comment;
  }

  // Комментарий к посту viewer-а; чужой пост -> 404 (контракт: approve/pin только автору поста; видимый чужой -> 403).
  private async loadOwnedByPostAuthor(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        parentId: true,
        pinnedAt: true,
        post: { select: { authorId: true } },
      },
    });
    if (!comment) throw new NotFoundException();
    if (comment.post.authorId !== userId) {
      await this.loadVisibleComment(userId, commentId);
      throw new ForbiddenException();
    }
    return comment;
  }

  // Настройка commentsFrom автора поста: FOLLOWING — автор подписан на комментатора, MUTUAL — взаимно.
  private async assertCommentsFrom(postAuthorId: string, commenterId: string): Promise<void> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId: postAuthorId },
      select: { commentsFrom: true },
    });
    const setting = settings?.commentsFrom ?? 'EVERYONE';
    if (setting === 'EVERYONE') return;
    let allowed = false;
    if (setting !== 'NO_ONE') {
      const follows = await this.prisma.follow.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { followerId: postAuthorId, followingId: commenterId },
            { followerId: commenterId, followingId: postAuthorId },
          ],
        },
        select: { followerId: true },
      });
      const authorFollows = follows.some((f) => f.followerId === postAuthorId);
      const followsAuthor = follows.some((f) => f.followerId === commenterId);
      allowed = setting === 'FOLLOWING' ? authorFollows : authorFollows && followsAuthor;
    }
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'The author does not allow you to comment',
      });
    }
  }

  // Упомянутые @userName: до 5, существуют, видны автору. Себя пропускаем.
  private async resolveMentionIds(authorId: string, text: string): Promise<string[]> {
    const parsed = this.tags.parse(text, { maxHashtags: 0, maxMentions: 1000 });
    if (parsed.mentions.length > MAX_MENTIONS) {
      throw validationError('text', `A comment can contain up to ${MAX_MENTIONS} mentions`);
    }
    const resolved = await this.tags.resolveMentions(parsed.mentions);
    const ids = resolved.map((u) => u.id).filter((id) => id !== authorId);
    if (ids.length === 0) return [];
    const found = await this.prisma.user.findMany({
      where: { id: { in: ids }, ...this.visibility.visibleUserWhere(authorId) },
      select: { id: true },
    });
    return found.map((u) => u.id);
  }
}
