import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StorageDriver } from './storage.driver';

// Ключ — только имя файла: буквы, цифры, «-», «_», «.». Так в путь не попадут «..» и «/» (path traversal).
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Хранит файлы в каталоге на диске (STORAGE_LOCAL_DIR).
export class LocalStorageDriver implements StorageDriver {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = resolve(dir);
  }

  private pathOf(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('Invalid storage key');
    return join(this.dir, key);
  }

  async save(key: string, source: Readable): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await pipeline(source, createWriteStream(this.pathOf(key)));
  }

  read(key: string, range?: { start: number; end: number }): Readable {
    return createReadStream(this.pathOf(key), range);
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathOf(key))).size;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }
}
