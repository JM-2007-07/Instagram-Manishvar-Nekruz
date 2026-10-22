import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';

// Раз в час удаляет файлы, которые загрузили, но не привязали к объекту за 24 часа (media.md). В тестах не запускается.
@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MediaCleanup');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => {
      this.media
        .cleanupUnattached()
        .catch((e: Error) => this.logger.warn(`cleanup failed: ${e.message}`));
    }, 3600_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
