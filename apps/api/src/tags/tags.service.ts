import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ParseLimits, ParsedTags, parseTags } from './tags.parse';

export interface HashtagInfo {
  name: string;
  postCount: number;
}

export interface MentionedUser {
  id: string;
  userName: string;
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  // Хэштеги и упоминания из текста (см. tags.parse.ts).
  parse(text: string, limits?: ParseLimits): ParsedTags {
    return parseTags(text, limits);
  }

  // Создаёт недостающие хэштеги и возвращает id всех. Для posts: вызывать внутри транзакции (передать tx).
  async upsertHashtags(names: string[], tx?: Prisma.TransactionClient): Promise<string[]> {
    const unique = [...new Set(names.map((n) => n.toLowerCase()))];
    if (unique.length === 0) return [];
    const db = tx ?? this.prisma;
    await db.hashtag.createMany({ data: unique.map((name) => ({ name })), skipDuplicates: true });
    const rows = await db.hashtag.findMany({
      where: { name: { in: unique } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // Существующие активные пользователи среди упомянутых имён. Видимость и mentionsFrom проверяет вызывающий.
  async resolveMentions(
    userNames: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<MentionedUser[]> {
    const unique = [...new Set(userNames.map((n) => n.toLowerCase()))];
    if (unique.length === 0) return [];
    const db = tx ?? this.prisma;
    return db.user.findMany({
      where: { userName: { in: unique }, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { id: true, userName: true },
    });
  }

  // Для /search/hashtags (модуль search): префиксный поиск по имени.
  async searchHashtags(query: string, limit: number): Promise<HashtagInfo[]> {
    const q = query.trim().replace(/^#/, '').toLowerCase();
    if (!q) return [];
    const rows = await this.prisma.hashtag.findMany({
      where: { name: { startsWith: q } },
      orderBy: { name: 'asc' },
      take: limit,
      select: { name: true },
    });
    const counts = await Promise.all(rows.map((r) => this.countPosts(r.name)));
    return rows.map((r, i) => ({ name: r.name, postCount: counts[i] }));
  }

  // GET /hashtags/:name
  async getInfo(rawName: string): Promise<HashtagInfo> {
    const name = rawName.trim().replace(/^#/, '').toLowerCase();
    const row = await this.prisma.hashtag.findUnique({ where: { name }, select: { name: true } });
    if (!row) throw new NotFoundException('Hashtag not found');
    return { name: row.name, postCount: await this.countPosts(row.name) };
  }

  // Опубликованные публикации не из архива. Приватность авторов здесь не учитывается: счётчик общий.
  private countPosts(name: string): Promise<number> {
    return this.prisma.postHashtag.count({
      where: { hashtag: { name }, post: { status: 'PUBLISHED', isArchived: false } },
    });
  }
}
