import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { decodeCursor, encodeCursor } from '@/common/pagination/cursor';
import type { Page } from '@/common/pagination/cursor';
import type { SessionUser } from '@/common/session/session-user';
import { SessionService } from '@/common/session/session.service';
import { validationError } from '@/common/validation';
import type { Prisma } from '@/generated/prisma/client';
import { MediaService } from '@/media/media.service';
import { PostsService } from '@/posts/posts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimeService } from '@/realtime/realtime.service';
import type {
  CreateReportDto,
  ReportDto,
  ReportsQueryDto,
  ResolveReportDto,
  TargetType,
} from './dto/admin.dto';

interface TargetInfo {
  ownerId: string | null;
  preview: string | null;
}

// Модели Comment и Story создают другие задачи; обращаемся к ним по имени, пока их нет — объект «не найден».
interface DynamicDelegate {
  findUnique(args: unknown): Promise<{ authorId?: string | null } | null>;
  deleteMany(args: unknown): Promise<unknown>;
}

const reportSelect = {
  id: true,
  targetType: true,
  targetId: true,
  reason: true,
  details: true,
  status: true,
  resolvedById: true,
  resolvedAt: true,
  createdAt: true,
  reporter: { select: { id: true, userName: true } },
} satisfies Prisma.ReportSelect;

type ReportRow = Prisma.ReportGetPayload<{ select: typeof reportSelect }>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly media: MediaService,
    private readonly sessions: SessionService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------- Пользователь: жалоба ----------

  async createReport(userId: string, dto: CreateReportDto): Promise<{ id: string }> {
    // Чужой невидимый пост (блокировка, закрытый аккаунт) — как несуществующий.
    if (dto.targetType === 'POST' && !(await this.posts.findVisibleById(userId, dto.targetId))) {
      throw new NotFoundException();
    }
    if (dto.targetType === 'MESSAGE') await this.assertMessageParticipant(userId, dto.targetId);

    const target = await this.findTarget(dto.targetType, dto.targetId);
    if (!target) throw new NotFoundException();
    const ownerId = dto.targetType === 'USER' ? dto.targetId : target.ownerId;
    if (ownerId === userId) {
      throw validationError('targetId', 'You cannot report your own content');
    }

    // Повторная жалоба на тот же объект идемпотентна: возвращаем прежнюю.
    const where = {
      reporterId_targetType_targetId: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
    };
    const existing = await this.prisma.report.findUnique({ where, select: { id: true } });
    if (existing) return existing;
    return this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details?.trim() || null,
      },
      select: { id: true },
    });
  }

  // ---------- Админ: жалобы ----------

  async listReports(user: SessionUser, query: ReportsQueryDto): Promise<Page<ReportDto>> {
    this.assertAdmin(user);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.ReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.report.findMany({
      where,
      select: reportSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: await Promise.all(page.map((row) => this.toDto(row))),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  async getReport(user: SessionUser, reportId: string): Promise<ReportDto> {
    this.assertAdmin(user);
    const row = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: reportSelect,
    });
    if (!row) throw new NotFoundException();
    return this.toDto(row);
  }

  async resolveReport(
    user: SessionUser,
    reportId: string,
    dto: ResolveReportDto,
  ): Promise<ReportDto> {
    this.assertAdmin(user);
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, targetType: true, targetId: true },
    });
    if (!report) throw new NotFoundException();
    const action = dto.action ?? 'NONE';
    if (dto.status === 'REJECTED' && action !== 'NONE') {
      throw validationError('action', 'Rejected report cannot have an action');
    }

    if (action === 'REMOVE_CONTENT') {
      await this.removeTarget(user, report.targetType, report.targetId);
    } else if (action === 'BAN_USER') {
      const target = await this.findTarget(report.targetType, report.targetId);
      const ownerId = report.targetType === 'USER' ? report.targetId : target?.ownerId;
      if (!ownerId) throw new NotFoundException();
      await this.ban(user, ownerId);
    }

    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status, resolvedById: user.id, resolvedAt: new Date() },
    });
    return this.getReport(user, reportId);
  }

  // ---------- Админ: пользователи ----------

  async setVerified(user: SessionUser, userId: string, value: boolean): Promise<void> {
    this.assertAdmin(user);
    await this.assertUserExists(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { isVerified: value } });
  }

  async ban(user: SessionUser, userId: string): Promise<void> {
    this.assertAdmin(user);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) throw new NotFoundException();
    if (userId === user.id || target.role === 'ADMIN') {
      throw validationError('userId', 'Administrators cannot be banned');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } });
    await this.sessions.revokeAllForUser(userId);
    this.realtime.disconnectUser(userId);
  }

  async unban(user: SessionUser, userId: string): Promise<void> {
    this.assertAdmin(user);
    await this.assertUserExists(userId);
    await this.prisma.user.updateMany({
      where: { id: userId, status: 'BANNED' },
      data: { status: 'ACTIVE' },
    });
  }

  // #50: немедленное удаление аккаунта. Данные удаляются каскадом (DATA_MODEL §4), файлы — через MediaService.
  async deleteUser(user: SessionUser, userId: string): Promise<void> {
    this.assertAdmin(user);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) throw new NotFoundException();
    if (userId === user.id || target.role === 'ADMIN') {
      throw validationError('userId', 'Administrators cannot be deleted');
    }
    const files = await this.prisma.mediaFile.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    this.realtime.disconnectUser(userId);
    await this.media.removeFiles(files.map((f) => f.id));
    await this.prisma.user.delete({ where: { id: userId } });
    // Жалобы на удалённого пользователя больше не имеют объекта.
    await this.prisma.report.updateMany({
      where: { targetType: 'USER', targetId: userId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedById: user.id, resolvedAt: new Date() },
    });
  }

  // ---------- Внутреннее ----------

  private assertAdmin(user: SessionUser): void {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
  }

  private async assertUserExists(userId: string): Promise<void> {
    const found = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!found) throw new NotFoundException();
  }

  private async assertMessageParticipant(userId: string, messageId: string): Promise<void> {
    const found = await this.prisma.message.findFirst({
      where: { id: messageId, chat: { participants: { some: { userId } } } },
      select: { id: true },
    });
    if (!found) throw new NotFoundException();
  }

  private delegate(name: 'comment' | 'story'): DynamicDelegate | null {
    const found = (this.prisma as unknown as Record<string, DynamicDelegate | undefined>)[name];
    return found && typeof found.findUnique === 'function' ? found : null;
  }

  private async findTarget(type: TargetType, id: string): Promise<TargetInfo | null> {
    switch (type) {
      case 'POST': {
        const post = await this.prisma.post.findUnique({
          where: { id },
          select: { authorId: true, caption: true },
        });
        return post ? { ownerId: post.authorId, preview: post.caption?.slice(0, 200) ?? null } : null;
      }
      case 'USER': {
        const found = await this.prisma.user.findUnique({
          where: { id },
          select: { userName: true },
        });
        return found ? { ownerId: id, preview: found.userName } : null;
      }
      case 'MESSAGE': {
        const message = await this.prisma.message.findUnique({
          where: { id },
          select: { senderId: true, text: true, unsentAt: true },
        });
        if (!message) return null;
        return {
          ownerId: message.senderId,
          preview: message.unsentAt ? null : (message.text?.slice(0, 200) ?? null),
        };
      }
      case 'COMMENT':
      case 'STORY': {
        const delegate = this.delegate(type === 'COMMENT' ? 'comment' : 'story');
        const row = await delegate?.findUnique({ where: { id }, select: { authorId: true } });
        return row ? { ownerId: row.authorId ?? null, preview: null } : null;
      }
    }
  }

  // Удаление объекта жалобы. Пост — через PostsService (там же чистятся файлы и уведомления).
  private async removeTarget(user: SessionUser, type: TargetType, id: string): Promise<void> {
    const target = await this.findTarget(type, id);
    if (!target) throw new NotFoundException();
    switch (type) {
      case 'POST':
        await this.posts.remove(user, id);
        return;
      case 'MESSAGE':
        await this.prisma.message.update({
          where: { id },
          data: { unsentAt: new Date(), text: null },
        });
        return;
      case 'COMMENT':
      case 'STORY':
        // TODO(comments/stories): заменить на CommentsService / StoriesService, когда модули будут готовы.
        await this.delegate(type === 'COMMENT' ? 'comment' : 'story')?.deleteMany({
          where: { id },
        });
        return;
      case 'USER':
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'User cannot be removed as content; use BAN_USER or DELETE /admin/users/{id}',
        });
    }
  }

  private async toDto(row: ReportRow): Promise<ReportDto> {
    const target = await this.findTarget(row.targetType, row.targetId);
    return {
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      details: row.details,
      status: row.status,
      reporter: row.reporter,
      target: {
        exists: target !== null,
        ownerId: target?.ownerId ?? null,
        preview: target?.preview ?? null,
      },
      resolvedById: row.resolvedById,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
