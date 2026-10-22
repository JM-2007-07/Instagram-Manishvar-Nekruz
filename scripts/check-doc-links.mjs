// Проверяет относительные ссылки в *.md (docs/, корень, .github): файл должен существовать.
// Без зависимостей. Запуск: npm run docs:links
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const skip = new Set(['node_modules', '.git', '.next', 'dist', 'coverage']);
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.md')) files.push(full);
  }
}
walk(join(root, 'docs'));
for (const name of readdirSync(root)) if (name.endsWith('.md')) files.push(join(root, name));

const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
let broken = 0;

for (const file of files) {
  // убираем блоки кода, чтобы примеры не считались ссылками
  const text = readFileSync(file, 'utf8')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  for (const match of text.matchAll(linkRe)) {
    let target = match[1];
    if (/^([a-z]+:|#|\/\/)/i.test(target)) continue; // http:, mailto:, #якорь
    target = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (!target) continue;
    const path = target.startsWith('/') ? join(root, target) : resolve(dirname(file), target);
    if (!existsSync(path)) {
      broken++;
      console.error(`${file.slice(root.length + 1)}: broken link -> ${match[1]}`);
    }
  }
}

console.log(`Checked ${files.length} files, broken links: ${broken}`);
process.exit(broken ? 1 : 0);
