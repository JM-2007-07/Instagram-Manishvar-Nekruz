import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Все функции добавляют эндпоинты в один baseApi (injectEndpoints). Одинаковое имя в двух функциях
// RTK Query молча заменяет одно другим, и экран получает чужой запрос (так было с getSuggestions у A и B).
describe('имена эндпоинтов RTK Query', () => {
  it('не повторяются в разных features/*/api.ts', () => {
    const featuresDir = path.join(__dirname, '..', '..', 'features');
    const owners = new Map<string, string[]>();
    for (const feature of fs.readdirSync(featuresDir)) {
      const file = path.join(featuresDir, feature, 'api.ts');
      if (!fs.existsSync(file)) continue;
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(
        /^\s+(\w+):\s*build\.(?:query|mutation|infiniteQuery)/gm,
      )) {
        const name = match[1]!;
        owners.set(name, [...(owners.get(name) ?? []), feature]);
      }
    }
    const duplicates = [...owners].filter(([, list]) => list.length > 1);
    expect(duplicates).toEqual([]);
  });
});
