// Черновик публикации в памяти браузера (на сервер уходит только после «Поделиться»).
export type Aspect = 'original' | '1:1' | '4:5' | '16:9';

export const ASPECTS: { value: Aspect; label: string; ratio: string | null }[] = [
  { value: 'original', label: 'Оригинал', ratio: null },
  { value: '1:1', label: '1:1', ratio: '1 / 1' },
  { value: '4:5', label: '4:5', ratio: '4 / 5' },
  { value: '16:9', label: '16:9', ratio: '16 / 9' },
];

export type DraftTag = { userId: string; userName: string; x: number; y: number };

export type DraftItem = {
  key: string;
  file: File;
  url: string; // objectURL; освобождается при удалении и закрытии
  isVideo: boolean;
  zoom: number; // 1…3, только вид
  offset: { x: number; y: number }; // сдвиг при перетаскивании, только вид
  altText: string;
  tags: DraftTag[];
  mediaId?: string; // заполняется после загрузки, чтобы «Повторить» не грузило файл заново
};

export const MAX_FILES = 10;
export const CAPTION_LIMIT = 2200;
