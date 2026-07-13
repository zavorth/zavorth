/**
 * Export gateways/channels/telegram/i18n.ts inline dicts → YAML catalogs.
 * Run from repo root: node scripts/export-telegram-i18n-yaml.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const src = fs.readFileSync(
  path.join(root, 'src/gateways/channels/telegram/i18n.ts'),
  'utf8',
);

function extractBlock(lang) {
  const startToken = `${lang}: {`;
  const start = src.indexOf(startToken);
  if (start < 0) throw new Error(`Could not find messages.${lang}`);
  let i = start + startToken.length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  const body = src.slice(start + startToken.length, i - 1);
  const entries = [];
  const lineRe = /'([^']+)':\s*'((?:\\'|[^'])*)'/g;
  let match;
  while ((match = lineRe.exec(body)) !== null) {
    entries.push([match[1], match[2].replace(/\\'/g, "'").replace(/\\n/g, '\n')]);
  }
  return entries;
}

function nest(entries) {
  const tree = {};
  for (const [key, value] of entries) {
    const parts = key.split('.');
    let cur = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return tree;
}

const mapping = [
  ['en', 'en-US'],
  ['pt', 'pt-BR'],
];

for (const [lang, locale] of mapping) {
  const entries = extractBlock(lang);
  const tree = nest(entries);
  const out = path.join(root, 'src/i18n/locales', locale, 'telegram.yaml');
  fs.writeFileSync(out, yaml.dump(tree, { lineWidth: 120, noRefs: true }), 'utf8');
  console.log(`${locale}/telegram.yaml ← ${entries.length} keys`);
}
