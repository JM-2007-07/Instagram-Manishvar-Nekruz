import { describe, expect, it } from 'vitest';
import { isActivePath } from './nav-items';

describe('isActivePath', () => {
  it('совпадает с «/» в конце и без него (Next.js убирает «/»)', () => {
    expect(isActivePath('/explore', '/explore/')).toBe(true);
    expect(isActivePath('/explore/', '/explore/')).toBe(true);
  });

  it('главная активна только на «/»', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/reels', '/')).toBe(false);
  });

  it('вложенные адреса — только при nested', () => {
    expect(isActivePath('/alice/saved', '/alice/')).toBe(false);
    expect(isActivePath('/alice/saved', '/alice/', true)).toBe(true);
    expect(isActivePath('/alice', '/alice/', true)).toBe(true);
    expect(isActivePath('/alicebob', '/alice/', true)).toBe(false);
  });
});
