import { describe, expect, it } from 'vitest';
import { formatCount } from './format';

describe('formatCount', () => {
  it('оставляет малые числа как есть', () => {
    expect(formatCount(42)).toBe('42');
  });
  it('сокращает тысячи и миллионы', () => {
    expect(formatCount(12_345)).toBe('12,3 тыс.');
    expect(formatCount(686_000_000)).toBe('686 млн');
  });
});
