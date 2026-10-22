import { parseRange } from './media.controller';
import { PURPOSE_RULES, sniffContainer } from './media.rules';

describe('sniffContainer: тип по содержимому', () => {
  it('узнаёт JPEG, PNG, WebP', () => {
    expect(sniffContainer(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      'jpeg',
    );
    expect(
      sniffContainer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toBe('png');
    expect(sniffContainer(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
  });

  it('узнаёт MP4/MOV, WebM, OGG', () => {
    expect(sniffContainer(Buffer.from('\0\0\0\x18ftypmp42'))).toBe('mp4');
    expect(sniffContainer(Buffer.from('\0\0\0\x14ftypqt  '))).toBe('mp4');
    expect(sniffContainer(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe('webm');
    expect(sniffContainer(Buffer.from('OggS\0\x02'))).toBe('ogg');
  });

  it('отвергает SVG, HTML, текст, HEIC и пустой файл', () => {
    expect(sniffContainer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffContainer(Buffer.from('<!doctype html><html>'))).toBeNull();
    expect(sniffContainer(Buffer.from('hello world, not a file'))).toBeNull();
    expect(sniffContainer(Buffer.from('\0\0\0\x18ftypheic'))).toBeNull();
    expect(sniffContainer(Buffer.alloc(0))).toBeNull();
  });
});

describe('PURPOSE_RULES', () => {
  it('рилс — только видео, аватар — только фото, голосовое — только аудио', () => {
    expect(PURPOSE_RULES.REEL.kinds).toEqual(['VIDEO']);
    expect(PURPOSE_RULES.AVATAR.kinds).toEqual(['IMAGE']);
    expect(PURPOSE_RULES.VOICE.kinds).toEqual(['AUDIO']);
  });
});

describe('parseRange', () => {
  it('разбирает диапазоны', () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 });
  });

  it('некорректный или внешний диапазон -> invalid', () => {
    expect(parseRange('bytes=100-', 100)).toBe('invalid');
    expect(parseRange('bytes=9-1', 100)).toBe('invalid');
    expect(parseRange('items=0-1', 100)).toBe('invalid');
    expect(parseRange('bytes=-', 100)).toBe('invalid');
  });
});
