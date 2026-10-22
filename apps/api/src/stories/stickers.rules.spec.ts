import { normalizeStickerData, parseStickerResponse, summarizeResponses } from './stickers.rules';
import type { StickerInputDto } from './dto/stories.dto';

const sticker = (
  type: StickerInputDto['type'],
  data: Record<string, unknown>,
): StickerInputDto => ({
  type,
  x: 0.5,
  y: 0.5,
  width: 0.2,
  height: 0.2,
  rotation: 0,
  data,
});

describe('stickers.rules', () => {
  it('POLL: оставляет только известные поля, требует 2-4 варианта', () => {
    expect(
      normalizeStickerData(sticker('POLL', { question: ' Q ', options: ['a', 'b'], junk: 1 }), 0),
    ).toEqual({ question: 'Q', options: ['a', 'b'] });
    expect(() =>
      normalizeStickerData(sticker('POLL', { question: 'Q', options: ['a'] }), 0),
    ).toThrow();
  });

  it('HASHTAG приводится к нижнему регистру без #, LINK требует http(s)', () => {
    expect(normalizeStickerData(sticker('HASHTAG', { tag: '#Закат' }), 0)).toEqual({
      tag: 'закат',
    });
    expect(() =>
      normalizeStickerData(sticker('LINK', { url: 'javascript:alert(1)' }), 0),
    ).toThrow();
  });

  it('QUIZ: correctIndex внутри вариантов; COUNTDOWN: дата в будущем', () => {
    expect(() =>
      normalizeStickerData(
        sticker('QUIZ', { question: 'Q', options: ['a', 'b'], correctIndex: 2 }),
        0,
      ),
    ).toThrow();
    expect(() =>
      normalizeStickerData(sticker('COUNTDOWN', { title: 'T', endsAt: '2000-01-01' }), 0),
    ).toThrow();
  });

  it('ответ: индекс варианта, текст, число 0..1; MENTION ответов не принимает', () => {
    const data = { options: ['a', 'b'] };
    expect(parseStickerResponse('POLL', data, 1)).toBe(1);
    expect(() => parseStickerResponse('POLL', data, 2)).toThrow();
    expect(() => parseStickerResponse('SLIDER', {}, 1.5)).toThrow();
    expect(() => parseStickerResponse('MENTION', {}, 1)).toThrow();
  });

  it('итоги: подсчёт по вариантам и среднее по шкале', () => {
    expect(summarizeResponses('POLL', { options: ['a', 'b'] }, [0, 1, 1])).toEqual({
      counts: [1, 2],
    });
    expect(summarizeResponses('SLIDER', {}, [0.5, 1])).toEqual({ average: 0.75 });
  });
});
