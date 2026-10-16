// Design guard (UI-0.4): the design is light-only, gradient-free and token-based.
// Fails if src/ contains gradients, dark-mode hooks, or raw palette utilities instead of semantic tokens.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const SKIP = /\.test\.tsx?$|[\\/]test[\\/]/;
const RULES = [
  [/gradient/i, 'gradients are not allowed'],
  [/prefers-color-scheme/, 'dark mode is not supported (light only)'],
  [/(?<![\w-])dark:/, '`dark:` variants are not allowed (light only)'],
  [
    /(?<![\w-])(?:[a-z]+:)*(?:bg|text|border|ring|outline|divide|fill|stroke|from|via|to|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|green|blue|red|amber|yellow|orange|emerald|teal|cyan|sky|indigo|violet|purple|pink|rose|lime)-\d/,
    'raw palette utility; use a semantic token (bg-surface, text-text-muted, ...)',
  ],
  [/(?<![\w-])shadow-(?:sm|md|lg|xl|2xl)(?![\w-])/, 'shadows are for floating layers only: use shadow-float'],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(name) && !SKIP.test(p)) yield p;
  }
}

let failures = 0;
for (const file of walk(root)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const [re, why] of RULES) {
        if (re.test(line)) {
          console.error(`${relative(process.cwd(), file)}:${i + 1}: ${why}\n    ${line.trim()}`);
          failures++;
        }
      }
    });
}

if (failures) {
  console.error(`\nlint:design found ${failures} problem(s).`);
  process.exit(1);
}
console.log('lint:design: OK');
