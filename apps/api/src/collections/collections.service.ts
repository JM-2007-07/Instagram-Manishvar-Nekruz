import { Injectable, NotFoundException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from '@/common/pagination/cursor';
import type { Page } from '@/common/pagination/cursor';
import type { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { validationError } from '@/common/validation';
import type { Prisma } from '@/generated/prisma/client';
import { mediaItemSelect, MediaService } from '@/media/media.service';
import { PostDto } from '@/posts/dto/posts.dto';
import type { PostRow } from '@/posts/post.select';
import { PostsService } from '@/posts/posts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { CollectionDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collections.dto';

interface CollectionRow {
  id: string;
  name: string;
  coverPostId: string | null;
}

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly posts: PostsService,
    private readonly media: MediaService,
  ) {}

  // ---------- Сохранённое ----------

  // Сохранить пост. Идемпотентно. Недоступный пост (нет, удалён, архив, блок, закрытый аккаунт) — 404.
  async save(userId: string, postId: string): Promise<void> {
    await this.assertPostsVisible(userId, [postId]);
    await this.prisma.savedPost.createMany({ data: [{ userId, postId }], skipDuplicates: true });
  }

  // Убрать пост из «Сохранённого» и из всех подборок пользователя. Идемпотентно; видимость не проверяем:
  // пользователь всегда может убрать то, что сохранил сам, даже если пост стал недоступен.
  async unsave(userId: string, postId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.collectionItem.deleteMany({ where: { postId, collection: { ownerId: userId } } }),
      this.prisma.savedPost.deleteMany({ where: { userId, postId } }),
    ]);
  }

  // «Сохранённое»: недавно сохранённые первыми, недоступные посты скрыты.
  async listSaved(userId: string, query: CursorQueryDto): Promise<Page<PostDto>> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.savedPost.findMany({
      where: {
        userId,
        post: this.visiblePost(userId),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, postId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: { createdAt: true, postId: true, post: { select: this.posts.postSelect(userId) } },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: query.limit + 1,
    });
    return this.toPage(
      rows.map((r) => ({ position: r.createdAt, id: r.postId, post: r.post })),
      userId,
      query.limit,
    );
  }

  // ---------- Подборки ----------

  async listCollections(userId: string): Promise<CollectionDto[]> {
    const rows = await this.prisma.collection.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, coverPostId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(rows.map((row) => this.toDto(userId, row)));
  }

  async create(userId: string, dto: CreateCollectionDto): Promise<CollectionDto> {
    const postIds = [...new Set(dto.postIds ?? [])];
    await this.assertPostsVisible(userId, postIds);
    const created = await this.prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: { ownerId: userId, name: dto.name },
        select: { id: true, name: true, coverPostId: true },
      });
      if (postIds.length > 0) {
        await tx.savedPost.createMany({
          data: postIds.map((postId) => ({ userId, postId })),
          skipDuplicates: true,
        });
        await tx.collectionItem.createMany({
          data: postIds.map((postId) => ({ collectionId: collection.id, postId })),
        });
      }
      return collection;
    });
    return this.toDto(userId, created);
  }

  async update(
    userId: string,
    collectionId: string,
    dto: UpdateCollectionDto,
  ): Promise<CollectionDto> {
    await this.findOwned(userId, collectionId);
    if (dto.coverPostId) {
      const item = await this.prisma.collectionItem.findUnique({
        where: { collectionId_postId: { collectionId, postId: dto.coverPostId } },
        select: { postId: true },
      });
      if (!item) throw validationError('coverPostId', 'The post is not in this collection');
    }
    const updated = await this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.coverPostId !== undefined ? { coverPostId: dto.coverPostId } : {}),
      },
      select: { id: true, name: true, coverPostId: true },
    });
    return this.toDto(userId, updated);
  }

  // Посты остаются в «Сохранённом» (удаляется только подборка и её CollectionItem).
  async remove(userId: string, collectionId: string): Promise<void> {
    await this.findOwned(userId, collectionId);
    await this.prisma.collection.delete({ where: { id: collectionId } });
  }

  async listPosts(
    userId: string,
    collectionId: string,
    query: CursorQueryDto,
  ): Promise<Page<PostDto>> {
    await this.findOwned(userId, collectionId);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.prisma.collectionItem.findMany({
      where: {
        collectionId,
        post: this.visiblePost(userId),
        ...(cursor
          ? {
              OR: [
                { addedAt: { lt: cursor.createdAt } },
                { addedAt: cursor.createdAt, postId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: { addedAt: true, postId: true, post: { select: this.posts.postSelect(userId) } },
      orderBy: [{ addedAt: 'desc' }, { postId: 'desc' }],
      take: query.limit + 1,
    });
    return this.toPage(
      rows.map((r) => ({ position: r.addedAt, id: r.postId, post: r.post })),
      userId,
      query.limit,
    );
  }

  // Добавить пост в подборку; если он ещё не сохранён — сохраняется. Идемпотентно.
  async addPost(userId: string, collectionId: string, postId: string): Promise<void> {
    await this.findOwned(userId, collectionId);
    await this.assertPostsVisible(userId, [postId]);
    await this.prisma.$transaction([
      this.prisma.savedPost.createMany({ data: [{ userId, postId }], skipDuplicates: true }),
      this.prisma.collectionItem.createMany({
        data: [{ collectionId, postId }],
        skipDuplicates: true,
      }),
    ]);
  }

  // Убрать пост из подборки (в «Сохранённом» остаётся). Идемпотентно.
  async removePost(userId: string, collectionId: string, postId: string): Promise<void> {
    await this.findOwned(userId, collectionId);
    await this.prisma.collectionItem.deleteMany({ where: { collectionId, postId } });
  }

  // ---------- Внутреннее ----------

  // Пост, который зритель может видеть в списках (как в лентах модуля posts).
  private visiblePost(viewerId: string): Prisma.PostWhereInput {
    return {
      status: 'PUBLISHED',
      isArchived: false,
      author: this.visibility.visibleAuthorWhere(viewerId),
    };
  }

  // Все посты должны быть видны, иначе 404 (не раскрываем, какие именно).
  private async assertPostsVisible(userId: string, postIds: string[]): Promise<void> {
    if (postIds.length === 0) return;
    const count = await this.prisma.post.count({
      where: { id: { in: postIds }, ...this.visiblePost(userId) },
    });
    if (count !== postIds.length) throw new NotFoundException('Post not found');
  }

  // Чужая или несуществующая подборка — одинаковый 404.
  private async findOwned(userId: string, collectionId: string): Promise<void> {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, ownerId: userId },
      select: { id: true },
    });
    if (!collection) throw new NotFoundException('Collection not found');
  }

  private async toDto(userId: string, row: CollectionRow): Promise<CollectionDto> {
    const visible = this.visiblePost(userId);
    const postCount = await this.prisma.collectionItem.count({
      where: { collectionId: row.id, post: visible },
    });
    // Обложка: выбранный пост, если он ещё в подборке и виден, иначе последний добавленный.
    const select = {
      post: {
        select: {
          media: {
            orderBy: { position: 'asc' },
            take: 1,
            select: { media: { select: mediaItemSelect } },
          },
        },
      },
    } satisfies Prisma.CollectionItemSelect;
    const chosen = row.coverPostId
      ? await this.prisma.collectionItem.findFirst({
          where: { collectionId: row.id, postId: row.coverPostId, post: visible },
          select,
        })
      : null;
    const cover =
      chosen ??
      (await this.prisma.collectionItem.findFirst({
        where: { collectionId: row.id, post: visible },
        orderBy: [{ addedAt: 'desc' }, { postId: 'desc' }],
        select,
      }));
    const file = cover?.post.media[0]?.media;
    const item = file ? this.media.toMediaItem(file) : null;
    return {
      id: row.id,
      name: row.name,
      coverUrl: item ? (item.thumbnailUrl ?? item.url) : null,
      postCount,
    };
  }

  private toPage(
    rows: { position: Date; id: string; post: PostRow }[],
    userId: string,
    limit: number,
  ): Page<PostDto> {
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: items.map((r) => this.posts.toPostDto(r.post, userId)),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.position, id: last.id }) : null,
    };
  }
}
