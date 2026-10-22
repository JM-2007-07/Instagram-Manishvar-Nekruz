import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { StoryAudience } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

// Готовое (READY) фото для истории без реального файла. attached — сразу привязано к истории.
export async function createStoryMedia(
  app: INestApplication,
  ownerId: string,
  options: { attached?: boolean } = {},
): Promise<string> {
  const prisma = app.get(PrismaService);
  const id = randomBytes(16).toString('hex');
  const row = await prisma.mediaFile.create({
    data: {
      ownerId,
      purpose: 'STORY',
      kind: 'IMAGE',
      status: 'READY',
      storageKey: `${id}.webp`,
      mimeType: 'image/webp',
      sizeBytes: 1000,
      width: 1080,
      height: 1920,
      ...(options.attached ? { attachedTo: 'STORY', attachedAt: new Date() } : {}),
    },
    select: { id: true },
  });
  return row.id;
}

export interface CreateStoryOverrides {
  audience?: StoryAudience;
  expiresAt?: Date;
  createdAt?: Date;
}

// История напрямую через Prisma (в обход API). По умолчанию активна ещё 24 часа.
export async function createStory(
  app: INestApplication,
  author: { id: string },
  overrides: CreateStoryOverrides = {},
): Promise<{ id: string; mediaId: string }> {
  const prisma = app.get(PrismaService);
  const mediaId = await createStoryMedia(app, author.id, { attached: true });
  const createdAt = overrides.createdAt ?? new Date();
  const story = await prisma.story.create({
    data: {
      authorId: author.id,
      mediaId,
      audience: overrides.audience ?? 'EVERYONE',
      createdAt,
      expiresAt: overrides.expiresAt ?? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  return { id: story.id, mediaId };
}
