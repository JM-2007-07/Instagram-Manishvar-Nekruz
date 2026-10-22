import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Throttle, hours } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CurrentUser } from '@/common/session/current-user.decorator';
import type { SessionUser } from '@/common/session/session-user';
import { validationError } from '@/common/validation';
import { StorageService } from '@/storage/storage.service';
import { MediaFileQueryDto, MediaItemDto, UploadMediaBodyDto } from './dto/media.dto';
import { MAX_UPLOAD_BYTES } from './media.rules';
import { MediaService } from './media.service';

// Файл, который multer уже записал во временную папку (типов @types/multer в проекте нет).
interface TmpUpload {
  path: string;
  size: number;
}

// Лимит размера действует во время приёма (SECURITY.md); точный лимит по назначению проверяет сервис.
const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: join(tmpdir(), 'photogram-uploads'),
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 100, ttl: hours(1) } })
  @UseInterceptors(uploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadMediaBodyDto })
  @ApiCreatedResponse({
    type: MediaItemDto,
    description: 'READY для фото, PROCESSING для видео и голосовых',
  })
  @ApiPayloadTooLargeResponse({ description: 'Файл больше лимита для этого purpose' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Тип по содержимому не разрешён' })
  @ApiTooManyRequestsResponse({ description: 'Больше 100 загрузок в час' })
  async upload(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: TmpUpload | undefined,
    @Req() req: Request,
  ): Promise<MediaItemDto> {
    if (!file) throw validationError('file', 'file is required');
    try {
      const body = req.body as Record<string, unknown> | undefined;
      return await this.media.upload(user.id, file.path, file.size, body?.purpose);
    } finally {
      await rm(file.path, { force: true });
    }
  }

  @Get(':mediaId/status')
  @ApiOkResponse({ type: MediaItemDto })
  @ApiNotFoundResponse({ description: 'Нет такого файла или он чужой' })
  status(
    @CurrentUser() user: SessionUser,
    @Param('mediaId', ParseUuidPipe) mediaId: string,
  ): Promise<MediaItemDto> {
    return this.media.getStatus(user.id, mediaId);
  }

  @Get(':mediaId')
  @ApiProduces('image/webp', 'image/jpeg', 'video/mp4', 'audio/mp4')
  @ApiOkResponse({ description: 'Файл. Поддерживается Range (206)' })
  @ApiNotFoundResponse({
    description: 'Нет файла или нет доступа к объекту, к которому он привязан',
  })
  async file(
    @CurrentUser() user: SessionUser,
    @Param('mediaId', ParseUuidPipe) mediaId: string,
    @Query() query: MediaFileQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { key, mimeType } = await this.media.resolveForViewer(user.id, mediaId, query.variant);
    const size = await this.storage.size(key);
    if (size === null) {
      throw new HttpException({ code: 'NOT_FOUND', message: 'File is missing' }, 404);
    }

    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.setHeader('Content-Range', `bytes */${size}`);
      throw new HttpException(
        { code: 'RANGE_NOT_SATISFIABLE', message: 'Range not satisfiable' },
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      await this.send(this.storage.read(key, range), res);
      return;
    }
    res.setHeader('Content-Length', String(size));
    await this.send(this.storage.read(key), res);
  }

  // Исчезнувший посреди отдачи файл не должен ронять процесс: ошибку потока гасим, соединение закрываем.
  private async send(stream: Readable, res: Response): Promise<void> {
    await pipeline(stream, res).catch(() => {
      if (!res.destroyed) res.destroy();
    });
  }

  @Delete(':mediaId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Файл уже привязан к объекту' })
  remove(
    @CurrentUser() user: SessionUser,
    @Param('mediaId', ParseUuidPipe) mediaId: string,
  ): Promise<void> {
    return this.media.remove(user.id, mediaId);
  }
}

// Разбор заголовка Range: bytes=0-99, bytes=100-, bytes=-500.
// null — заголовка нет; 'invalid' — диапазон некорректен или за пределами файла.
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (match[1] === '') {
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}
