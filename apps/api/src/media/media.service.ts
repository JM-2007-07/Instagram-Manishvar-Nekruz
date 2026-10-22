import {
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import sharp, { type OutputInfo } from 'sharp';
import { validationError } from '@/common/validation';
import type { MediaKind, MediaPurpose, MediaTarget, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VisibilityService } from '@/privacy/visibility.service';
import { StorageService } from '@/storage/storage.service';
import { MEDIA_PURPOSES, MediaItemDto } from './dto/media.dto';
import { ToolMissingError, probe } from './media-process';
import { MediaProcessingService } from './media-processing.service';
import { PURPOSE_RULES, isImageContainer, sniffContainer } from './media.rules';

// Поля MediaFile, которых хватает для MediaItem. Другие модули добавляют их в свой select:
// `media: { select: mediaItemSelect }`, затем `mediaService.toMediaItem(row.media)`.
export const mediaItemSelect = {
  id: true,
  kind: true,
  status: true,
  thumbnailKey: true,
  width: true,
  height: true,
  durationSec: true,
} satisfies Prisma.MediaFileSelect;

export type MediaItemRow = Prisma.MediaFileGetPayload<{ select: typeof mediaItemSelect }>;

export interface AttachOptions {
  // К какому объекту привязываем (нужно для проверки доступа при раздаче файла).
  target: MediaTarget;
  // Допустимые purpose загруженных файлов (например, для поста — POST, для истории — STORY).
  purposes: MediaPurpose[];
  // Транзакция вызывающего модуля: привязка откатится вместе с созданием объекта.
  tx?: Prisma.TransactionClient;
}

const MIME_BY_EXT: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
};

@Injectable()
export class MediaService {
  private readonly ffmpeg: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly visibility: VisibilityService,
    private readonly processing: MediaProcessingService,
    config: ConfigService,
  ) {
    this.ffmpeg = config.get<string>('FFMPEG_PATH') || 'ffmpeg';
  }

  // ---------- Публичное API для других модулей ----------

  /** MediaItem из API_CONTRACT §1.4. url ведёт на GET /media/{id} (доступ проверяется при раздаче). */
  toMediaItem(row: MediaItemRow): MediaItemDto {
    const url = `/api/v1/media/${row.id}`;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      url,
      thumbnailUrl: row.thumbnailKey ? `${url}?variant=thumb` : null,
      width: row.width,
      height: row.height,
      durationSec: row.durationSec,
    };
  }

  /**
   * Привязывает загруженные файлы к объекту. Проверяет: файлы существуют и принадлежат ownerId, purpose допустим,
   * статус READY, ещё не привязаны. Ошибки: 400 VALIDATION_ERROR (чужой/неизвестный/не тот purpose/дубли),
   * 409 MEDIA_NOT_READY, 409 MEDIA_ALREADY_USED. Вызывать внутри транзакции создания объекта (options.tx).
   */
  async attach(ownerId: string, mediaIds: string[], options: AttachOptions): Promise<void> {
    if (mediaIds.length === 0) return;
    if (new Set(mediaIds).size !== mediaIds.length) {
      throw validationError('mediaIds', 'mediaIds must not contain duplicates');
    }
    const db = options.tx ?? this.prisma;
    const rows = await db.mediaFile.findMany({
      where: { id: { in: mediaIds }, ownerId },
      select: { id: true, purpose: true, status: true, attachedTo: true },
    });
    if (rows.length !== mediaIds.length) {
      throw validationError('mediaIds', 'Media file not found');
    }
    if (rows.some((r) => !options.purposes.includes(r.purpose))) {
      throw validationError('mediaIds', 'Media file was uploaded for another purpose');
    }
    if (rows.some((r) => r.attachedTo !== null)) {
      throw new ConflictException({
        code: 'MEDIA_ALREADY_USED',
        message: 'Media file is already attached',
      });
    }
    if (rows.some((r) => r.status !== 'READY')) {
      throw new ConflictException({
        code: 'MEDIA_NOT_READY',
        message: 'Media file is not ready yet',
      });
    }
    // Условие attachedTo: null защищает от гонки: два запроса не привяжут один файл дважды.
    const { count } = await db.mediaFile.updateMany({
      where: { id: { in: mediaIds }, ownerId, attachedTo: null, status: 'READY' },
      data: { attachedTo: options.target, attachedAt: new Date() },
    });
    if (count !== mediaIds.length) {
      throw new ConflictException({
        code: 'MEDIA_ALREADY_USED',
        message: 'Media file is already attached',
      });
    }
  }

  /**
   * Удаляет файлы (запись и содержимое в хранилище), когда удалён объект: пост, история, аватар, сообщение.
   * Вызывать ПОСЛЕ успешной транзакции удаления объекта. Ошибки хранилища не пробрасываются.
   */
  async removeFiles(mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) return;
    const rows = await this.prisma.mediaFile.findMany({ where: { id: { in: mediaIds } } });
    await this.prisma.mediaFile.deleteMany({ where: { id: { in: mediaIds } } });
    await Promise.all(rows.map((r) => this.deleteStored(r)));
  }

  // ---------- Загрузка ----------

  /** POST /media: tmpPath — файл, уже принятый multer (удаляет вызывающий). */
  async upload(
    ownerId: string,
    tmpPath: string,
    size: number,
    purposeRaw: unknown,
  ): Promise<MediaItemDto> {
    if (
      typeof purposeRaw !== 'string' ||
      !(MEDIA_PURPOSES as readonly string[]).includes(purposeRaw)
    ) {
      throw validationError('purpose', `purpose must be one of: ${MEDIA_PURPOSES.join(', ')}`);
    }
    const purpose = purposeRaw as MediaPurpose;
    const rule = PURPOSE_RULES[purpose];

    // Тип — по первым байтам файла.
    const handle = await open(tmpPath, 'r');
    const head = Buffer.alloc(16);
    try {
      await handle.read(head, 0, 16, 0);
    } finally {
      await handle.close();
    }
    const container = sniffContainer(head);
    if (!container) throw new UnsupportedMediaTypeException('Unsupported file type');

    let kind: MediaKind = 'IMAGE';
    let info: Awaited<ReturnType<typeof probe>> | null = null;
    if (!isImageContainer(container)) {
      try {
        info = await probe(this.ffmpeg, tmpPath);
      } catch (error) {
        if (error instanceof ToolMissingError) {
          throw new ServiceUnavailableException('Media tools are not available');
        }
        throw new UnsupportedMediaTypeException('Unsupported file type');
      }
      if (info.hasVideo) kind = 'VIDEO';
      else if (info.hasAudio) kind = 'AUDIO';
      else throw new UnsupportedMediaTypeException('Unsupported file type');
    }

    if (!rule.kinds.includes(kind)) {
      throw new UnsupportedMediaTypeException('This file type is not allowed here');
    }
    const maxBytes = rule.maxBytes[kind];
    if (maxBytes !== undefined && size > maxBytes)
      throw new PayloadTooLargeException('File is too large');
    if (rule.maxDurationSec !== undefined && info) {
      // Длительность неизвестна — лимит проверить нельзя, файл не принимаем.
      if (!info.durationSec) throw new UnsupportedMediaTypeException('Unsupported file type');
      if (info.durationSec > rule.maxDurationSec) {
        throw new PayloadTooLargeException('Media is too long');
      }
    }

    const id = randomUUID();
    if (kind === 'IMAGE') return this.uploadImage(id, ownerId, purpose, tmpPath);

    // Видео и голосовые: сохраняем исходник и обрабатываем в фоне (ADR 0016).
    const storageKey = `${id}.orig`;
    await this.storage.save(storageKey, createReadStream(tmpPath));
    let row: MediaItemRow;
    try {
      row = await this.prisma.mediaFile.create({
        data: {
          id,
          ownerId,
          purpose,
          kind,
          status: 'PROCESSING',
          storageKey,
          mimeType: 'application/octet-stream',
          sizeBytes: size,
          width: info?.width ?? null,
          height: info?.height ?? null,
          durationSec: info?.durationSec ?? null,
        },
        select: mediaItemSelect,
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
    this.processing.enqueue(id);
    return this.toMediaItem(row);
  }

  // Фото: поворот по EXIF, удаление метаданных, копии 1080 и 320 px в WebP (sharp по умолчанию метаданные не копирует).
  private async uploadImage(
    id: string,
    ownerId: string,
    purpose: MediaPurpose,
    tmpPath: string,
  ): Promise<MediaItemDto> {
    let main: { data: Buffer; info: OutputInfo };
    let thumb: Buffer;
    try {
      main = await sharp(tmpPath)
        .rotate()
        .resize({ width: 1080, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      thumb = await sharp(tmpPath)
        .rotate()
        .resize({ width: 320, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new UnsupportedMediaTypeException('Image is corrupted or unsupported');
    }
    const storageKey = `${id}.webp`;
    const thumbnailKey = `${id}_thumb.webp`;
    await this.storage.save(storageKey, Readable.from(main.data));
    await this.storage.save(thumbnailKey, Readable.from(thumb));
    try {
      const row = await this.prisma.mediaFile.create({
        data: {
          id,
          ownerId,
          purpose,
          kind: 'IMAGE',
          status: 'READY',
          storageKey,
          mimeType: 'image/webp',
          sizeBytes: main.data.length,
          width: main.info.width,
          height: main.info.height,
          thumbnailKey,
          variants: { thumb: thumbnailKey },
        },
        select: mediaItemSelect,
      });
      return this.toMediaItem(row);
    } catch (error) {
      await this.storage.delete(storageKey);
      await this.storage.delete(thumbnailKey);
      throw error;
    }
  }

  // ---------- Статус, раздача, удаление ----------

  /** GET /media/{id}/status — только владелец, иначе 404. */
  async getStatus(ownerId: string, mediaId: string): Promise<MediaItemDto> {
    const row = await this.prisma.mediaFile.findFirst({
      where: { id: mediaId, ownerId },
      select: mediaItemSelect,
    });
    if (!row) throw new NotFoundException();
    return this.toMediaItem(row);
  }

  /** Какой файл отдать зрителю: ключ в хранилище и Content-Type. 404, если нет доступа или файл не готов. */
  async resolveForViewer(
    viewerId: string,
    mediaId: string,
    variant: 'thumb' | undefined,
  ): Promise<{ key: string; mimeType: string }> {
    const row = await this.prisma.mediaFile.findUnique({ where: { id: mediaId } });
    if (!row || row.status !== 'READY') throw new NotFoundException();
    if (!(await this.canView(viewerId, row))) throw new NotFoundException();

    const key = variant === 'thumb' ? row.thumbnailKey : row.storageKey;
    if (!key) throw new NotFoundException();
    const ext = key.split('.').pop() ?? '';
    return {
      key,
      mimeType: variant === 'thumb' ? (MIME_BY_EXT[ext] ?? 'image/jpeg') : row.mimeType,
    };
  }

  // Доступ к файлу = доступ к объекту, к которому он привязан (media.md). Владелец видит свои файлы всегда.
  // История: аудитория «близкие друзья», «скрыть от» и срок 24 часа (кроме историй из «Актуального»).
  private async canView(
    viewerId: string,
    row: { id: string; ownerId: string; attachedTo: MediaTarget | null },
  ): Promise<boolean> {
    if (row.ownerId === viewerId) return true;
    switch (row.attachedTo) {
      case null:
        return false; // не привязанный файл видит только владелец
      case 'STORY':
        return this.canViewStoryMedia(viewerId, row);
      case 'POST': {
        // Файл поста виден, если виден сам пост: опубликован, не в архиве, автор доступен.
        const link = await this.prisma.postMedia.findUnique({
          where: { mediaId: row.id },
          select: { post: { select: { status: true, isArchived: true } } },
        });
        if (!link || link.post.status !== 'PUBLISHED' || link.post.isArchived) return false;
        return this.visibility.canViewContent(viewerId, row.ownerId);
      }
      case 'HIGHLIGHT_COVER':
        return this.visibility.canViewContent(viewerId, row.ownerId);
      case 'AVATAR':
        return this.visibility.canViewProfile(viewerId, row.ownerId);
      case 'MESSAGE': {
        const link = await this.prisma.messageMedia.findFirst({
          where: {
            mediaId: row.id,
            message: { chat: { participants: { some: { userId: viewerId, status: 'ACTIVE' } } } },
          },
          select: { mediaId: true },
        });
        return link !== null;
      }
      case 'CHAT_AVATAR': {
        const chat = await this.prisma.chat.findFirst({
          where: {
            avatarMediaId: row.id,
            participants: { some: { userId: viewerId, status: 'ACTIVE' } },
          },
          select: { id: true },
        });
        return chat !== null;
      }
    }
  }

  private async canViewStoryMedia(
    viewerId: string,
    row: { id: string; ownerId: string },
  ): Promise<boolean> {
    const story = await this.prisma.story.findUnique({
      where: { mediaId: row.id },
      select: {
        audience: true,
        expiresAt: true,
        highlightItems: { select: { storyId: true }, take: 1 },
      },
    });
    if (!story) return false;
    if (!(await this.visibility.canViewContent(viewerId, row.ownerId))) return false;
    if (story.expiresAt.getTime() <= Date.now() && story.highlightItems.length === 0) return false;
    if (
      story.audience === 'CLOSE_FRIENDS' &&
      !(await this.visibility.isCloseFriend(row.ownerId, viewerId))
    ) {
      return false;
    }
    return !(await this.visibility.getStoryHiddenFromIds(row.ownerId)).includes(viewerId);
  }

  /** DELETE /media/{id} — владелец, только не привязанный файл (иначе 409). */
  async remove(ownerId: string, mediaId: string): Promise<void> {
    const row = await this.prisma.mediaFile.findFirst({ where: { id: mediaId, ownerId } });
    if (!row) throw new NotFoundException();
    // deleteMany с условием attachedTo: null — если файл успели привязать, ничего не удалится.
    const { count } = await this.prisma.mediaFile.deleteMany({
      where: { id: mediaId, ownerId, attachedTo: null },
    });
    if (count === 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Media file is attached to an object',
      });
    }
    await this.deleteStored(row);
  }

  /** Фоновая очистка: удаляет файлы, не привязанные за 24 часа. Возвращает число удалённых. */
  async cleanupUnattached(olderThanHours = 24): Promise<number> {
    const before = new Date(Date.now() - olderThanHours * 3600_000);
    const rows = await this.prisma.mediaFile.findMany({
      where: { attachedTo: null, createdAt: { lt: before } },
      take: 200,
    });
    let removed = 0;
    for (const row of rows) {
      const { count } = await this.prisma.mediaFile.deleteMany({
        where: { id: row.id, attachedTo: null },
      });
      if (count > 0) {
        removed++;
        await this.deleteStored(row);
      }
    }
    return removed;
  }

  private async deleteStored(row: {
    storageKey: string;
    thumbnailKey: string | null;
  }): Promise<void> {
    await this.storage.delete(row.storageKey).catch(() => undefined);
    if (row.thumbnailKey) await this.storage.delete(row.thumbnailKey).catch(() => undefined);
  }
}
