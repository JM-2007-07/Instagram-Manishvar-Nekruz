import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseTheme, setTheme, THEME_SCRIPT } from './theme';

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
  document.cookie = 'theme=; path=/; max-age=0';
});

describe('parseTheme', () => {
  it.each(['light', 'dark', 'system'] as const)('возвращает %s', (value) => {
    expect(parseTheme(value)).toBe(value);
  });

  it.each([undefined, null, '', 'neon'])('для %s возвращает system', (value) => {
    expect(parseTheme(value)).toBe('system');
  });
});

describe('setTheme', () => {
  it('dark: ставит класс и cookie', () => {
    setTheme('dark');
    expect(isDark()).toBe(true);
    expect(document.cookie).toContain('theme=dark');
  });

  it('light: снимает класс', () => {
    document.documentElement.classList.add('dark');
    setTheme('light');
    expect(isDark()).toBe(false);
    expect(document.cookie).toContain('theme=light');
  });

  it('system: следует системной тёмной теме', () => {
    mockMatchMedia(true);
    setTheme('system');
    expect(isDark()).toBe(true);
  });

  it('system: снимает класс при светлой системной теме', () => {
    document.documentElement.classList.add('dark');
    mockMatchMedia(false);
    setTheme('system');
    expect(isDark()).toBe(false);
  });
});

describe('THEME_SCRIPT', () => {
  it('при theme=system ставит dark по системной теме', () => {
    document.cookie = 'theme=system; path=/';
    mockMatchMedia(true);
    expect(() => new Function(THEME_SCRIPT)()).not.toThrow();
    expect(isDark()).toBe(true);
  });

  it('при theme=light ничего не меняет', () => {
    document.cookie = 'theme=light; path=/';
    mockMatchMedia(true);
    new Function(THEME_SCRIPT)();
    expect(isDark()).toBe(false);
  });
});
