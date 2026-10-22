import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import { LocalStorageDriver } from './local-storage.driver';
import type { StorageDriver } from './storage.driver';

// Единая точка доступа к файлам. Драйвер выбирается по STORAGE_DRIVER (по умолчанию local, каталог STORAGE_LOCAL_DIR).
@Injectable()
export class StorageService implements StorageDriver {
  private readonly driver: StorageDriver;

  constructor(config: ConfigService) {
    const name = config.get<string>('STORAGE_DRIVER') || 'local';
    if (name !== 'local') {
      throw new Error(`STORAGE_DRIVER "${name}" is not supported yet (only "local")`);
    }
    this.driver = new LocalStorageDriver(config.get<string>('STORAGE_LOCAL_DIR') || './storage');
  }

  save(key: string, source: Readable): Promise<void> {
    return this.driver.save(key, source);
  }

  read(key: string, range?: { start: number; end: number }): Readable {
    return this.driver.read(key, range);
  }

  size(key: string): Promise<number | null> {
    return this.driver.size(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }
}
