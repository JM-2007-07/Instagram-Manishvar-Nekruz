import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface CreateCommentOverrides {
  text?: string;
  parentId?: string | null;
  createdAt?: Date;
  isPendingApproval?: boolean;
  pinnedAt?: Date | null;
}

// Создаёт комментарий напрямую через Prisma (в обход API). Возвращает id.
export async function createComment(
  app: INestApplication,
  postId: string,
  author: { id: string },
  overrides: CreateCommentOverrides = {},
): Promise<{ id: string }> {
  return app.get(PrismaService).comment.create({
    data: {
      postId,
      authorId: author.id,
      text: overrides.text ?? 'hello',
      parentId: overrides.parentId ?? null,
      createdAt: overrides.createdAt ?? new Date(),
      isPendingApproval: overrides.isPendingApproval ?? false,
      pinnedAt: overrides.pinnedAt ?? null,
    },
    select: { id: true },
  });
}
