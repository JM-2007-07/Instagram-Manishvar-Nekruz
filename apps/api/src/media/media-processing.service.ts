import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';
import { extractPoster, probe, transcodeAudio, transcodeVideo } from './media-process';

// Простая очередь внутри процесса (ADR 0016): видео и голосовые обрабатываются по одному, с одним повтором при ошибке.
// Когда появится Redis — заменяется на BullMQ без изменения API.
@Injectable()
export class MediaProcessingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('MediaProcessing');
  private readonly queue: string[] = [];
  private running = false;
  private stopped = false;
  private readonly ffmpeg: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.ffmpeg = config.get<string>('FFMPEG_PATH') || 'ffmpeg';
  }

  // После перезапуска продолжаем то, что не успели обработать.
  async onApplicationBootstrap(): Promise<void> {
    const pending = await this.prisma.mediaFile.findMany({
      where: { status: 'PROCESSING', kind: { in: ['VIDEO', 'AUDIO'] } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    pending.forEach((m) => this.enqueue(m.id));
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.queue.length = 0;
  }

  enqueue(mediaId: string): void {
    this.queue.push(mediaId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let id = this.queue.shift();
      while (id !== undefined && !this.stopped) {
        await this.processWithRetry(id);
        id = this.queue.shift();
      }
    } finally {
      this.running = false;
    }
  }

  private async processWithRetry(id: string): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.process(id);
        return;
      } catch (error) {
        this.logger.warn(`media ${id} attempt ${attempt} failed: ${(error as Error).message}`);
      }
    }
    // Оба раза не получилось: помечаем FAILED и убираем исходник.
    const row = await this.prisma.mediaFile.findUnique({
      where: { id },
      select: { storageKey: true },
    });
    await this.prisma.mediaFile.updateMany({
      where: { id, status: 'PROCESSING' },
      data: { status: 'FAILED' },
    });
    if (row) await this.storage.delete(row.storageKey).catch(() => undefined);
  }

  private async process(id: string): Promise<void> {
    const row = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!row || row.status !== 'PROCESSING') return;

    const dir = await mkdtemp(join(tmpdir(), 'photogram-media-'));
    try {
      const input = join(dir, 'input');
      await pipeline(this.storage.read(row.storageKey), createWriteStream(input));

      const isVideo = row.kind === 'VIDEO';
      const output = join(dir, isVideo ? 'out.mp4' : 'out.m4a');
      const poster = join(dir, 'poster.jpg');
      if (isVideo) {
        await transcodeVideo(this.ffmpeg, input, output);
        await extractPoster(this.ffmpeg, output, poster);
      } else {
        await transcodeAudio(this.ffmpeg, input, output);
      }
      const info = await probe(this.ffmpeg, output);

      const mainKey = `${id}${isVideo ? '.mp4' : '.m4a'}`;
      const thumbKey = isVideo ? `${id}_thumb.jpg` : null;
      await this.storage.save(mainKey, createReadStream(output));
      if (thumbKey) await this.storage.save(thumbKey, createReadStream(poster));

      const sizeBytes = await this.storage.size(mainKey);
      const done = await this.prisma.mediaFile.updateMany({
        where: { id, status: 'PROCESSING' },
        data: {
          status: 'READY',
          storageKey: mainKey,
          mimeType: isVideo ? 'video/mp4' : 'audio/mp4',
          sizeBytes: sizeBytes ?? row.sizeBytes,
          width: info.width,
          height: info.height,
          durationSec: info.durationSec,
          thumbnailKey: thumbKey,
        },
      });
      if (done.count === 0) {
        // Пока шла обработка, файл удалили: убираем результат.
        await this.storage.delete(mainKey);
        if (thumbKey) await this.storage.delete(thumbKey);
        return;
      }
      await this.storage.delete(row.storageKey);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
