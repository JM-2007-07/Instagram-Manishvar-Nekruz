import { parseTags } from './tags.parse';

describe('parseTags', () => {
  it('находит хэштеги и упоминания в порядке появления', () => {
    expect(parseTags('Hi @Bob and #Sunset #beach, @alice.')).toEqual({
      hashtags: ['sunset', 'beach'],
      mentions: ['bob', 'alice'],
    });
  });

  it('понимает кириллицу и приводит к нижнему регистру', () => {
    expect(parseTags('#Закат и #ЗАКАТ #Ёлка_2').hashtags).toEqual(['закат', 'ёлка_2']);
  });

  it('убирает дубликаты', () => {
    const r = parseTags('#a #A #a @x @X');
    expect(r.hashtags).toEqual(['a']);
    expect(r.mentions).toEqual(['x']);
  });

  it('игнорирует # внутри слова, ## и html-сущности', () => {
    expect(parseTags('abc#def ##x &#39; # пусто').hashtags).toEqual([]);
  });

  it('хэштег заканчивается на знаке препинания', () => {
    expect(parseTags('#tag, #tag2! (#tag3)').hashtags).toEqual(['tag', 'tag2', 'tag3']);
  });

  it('отбрасывает хэштег длиннее 100 символов', () => {
    const r = parseTags(`#${'a'.repeat(100)} #${'b'.repeat(101)}`);
    expect(r.hashtags).toEqual(['a'.repeat(100)]);
  });

  it('ограничивает число хэштегов и упоминаний', () => {
    const text = Array.from({ length: 40 }, (_, i) => `#t${i} @u${i}`).join(' ');
    const r = parseTags(text);
    expect(r.hashtags).toHaveLength(30);
    expect(r.mentions).toHaveLength(20);
    expect(parseTags(text, { maxMentions: 5 }).mentions).toHaveLength(5);
  });

  it('упоминание: точка в конце — пунктуация, в середине — часть имени', () => {
    expect(parseTags('@a.b. @c_d').mentions).toEqual(['a.b', 'c_d']);
  });

  it('почта не считается упоминанием', () => {
    expect(parseTags('write me user@example.com').mentions).toEqual([]);
  });

  it('невалидные имена пропускаются', () => {
    expect(parseTags('@.bad @a..b @ok').mentions).toEqual(['ok']);
    expect(parseTags(`@${'a'.repeat(31)}`).mentions).toEqual([]);
  });

  it('упоминание в начале и после перевода строки', () => {
    expect(parseTags('@one\n@two').mentions).toEqual(['one', 'two']);
  });
});
