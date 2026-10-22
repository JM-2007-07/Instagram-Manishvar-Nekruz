import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PostType } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface CreatePostOverrides {
  type?: PostType;
  caption?: string | null;
  locationId?: string | null;
  isArchived?: boolean;
  hideLikeCount?: boolean;
  commentsDisabled?: boolean;
  createdAt?: Date;
  mediaCount?: number;
}

// Готовое (READY) фото без реального файла: для тестов, которым нужен пост (комментарии, истории, подборки).
export async function createReadyMedia(
  app: INestApplication,
  ownerId: string,
  options: { kind?: 'IMAGE' | 'VIDEO'; purpose?: 'POST' | 'REEL'; attached?: boolean } = {},
): Promise<string> {
  const prisma = app.get(PrismaService);
  const kind = options.kind ?? 'IMAGE';
  const id = randomBytes(16).toString('hex');
  const row = await prisma.mediaFile.create({
    data: {
      ownerId,
      purpose: options.purpose ?? 'POST',
      kind,
      status: 'READY',
      storageKey: `${id}.${kind === 'IMAGE' ? 'webp' : 'mp4'}`,
      mimeType: kind === 'IMAGE' ? 'image/webp' : 'video/mp4',
      sizeBytes: 1000,
      width: 1080,
      height: 1080,
      durationSec: kind === 'VIDEO' ? 5 : null,
      ...(options.attached ? { attachedTo: 'POST', attachedAt: new Date() } : {}),
    },
    select: { id: true },
  });
  return row.id;
}

// Создаёт пост напрямую через Prisma (в обход API) с фиктивным READY-медиа. Возвращает id и shortcode.
export async function createPost(
  app: INestApplication,
  author: { id: string },
  overrides: CreatePostOverrides = {},
): Promise<{ id: string; shortcode: string }> {
  const prisma = app.get(PrismaService);
  const type = overrides.type ?? 'POST';
  const count = overrides.mediaCount ?? 1;
  const media: { position: number; mediaId: string }[] = [];
  for (let position = 0; position < count; position++) {
    const mediaId = await createReadyMedia(app, author.id, {
      kind: type === 'REEL' ? 'VIDEO' : 'IMAGE',
      purpose: type === 'REEL' ? 'REEL' : 'POST',
      attached: true,
    });
    media.push({ position, mediaId });
  }
  const createdAt = overrides.createdAt ?? new Date();
  return prisma.post.create({
    data: {
      shortcode: randomBytes(9).toString('base64url'),
      authorId: author.id,
      type,
      caption: overrides.caption ?? null,
      locationId: overrides.locationId ?? null,
      isArchived: overrides.isArchived ?? false,
      hideLikeCount: overrides.hideLikeCount ?? false,
      commentsDisabled: overrides.commentsDisabled ?? false,
      createdAt,
      publishedAt: createdAt,
      media: { create: media },
    },
    select: { id: true, shortcode: true },
  });
}
