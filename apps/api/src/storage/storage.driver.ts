import type { Readable } from 'node:stream';

// Что умеет любое хранилище файлов (ADR 0007). Сейчас есть только драйвер `local`; `s3` — T5.B2.
export interface StorageDriver {
  // Сохраняет поток под ключом (перезаписывает, если ключ уже есть).
  save(key: string, source: Readable): Promise<void>;
  // Поток чтения; range — включительные границы байтов (для Range-запросов видео).
  read(key: string, range?: { start: number; end: number }): Readable;
  // Размер файла в байтах; null, если файла нет.
  size(key: string): Promise<number | null>;
  // Удаляет файл; отсутствие файла не ошибка.
  delete(key: string): Promise<void>;
}
