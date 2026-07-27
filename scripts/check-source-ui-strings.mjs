#!/usr/bin/env node
/**
 * Source string convention (product hygiene).
 *
 * Product source code uses English for operator/developer-facing emit strings.
 * Localized end-user UI belongs in i18n / locale catalogs so any language can
 * ship without hard-coding copy into feature modules.
 *
 * This check flags non-ASCII letters in src string literals outside allowlisted
 * locale/catalog paths. It is language-neutral (any localized script in product
 * source is redirected to i18n). Common symbols (© → — …) are ignored.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const ALLOW_DIR_PARTS = [
  `${path.sep}i18n${path.sep}`,
  `${path.sep}plugin-i18n${path.sep}`,
  `${path.sep}locales${path.sep}`,
  `${path.sep}locale${path.sep}`,
  `${path.sep}localePacks${path.sep}`,
  `${path.sep}public${path.sep}`,
  `${path.sep}zavorth-control-vite-shell${path.sep}assets${path.sep}`,
];

const ALLOW_BASENAMES = new Set([
  'i18n.ts',
  'I18nService.ts',
  'LocaleCommandAliases.ts',
  'PluginLoadTipsI18n.ts',
]);

function isI18nCatalogPath(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base.includes('i18n') && (base.endsWith('.ts') || base.endsWith('.js'))) return true;
  if (filePath.toLowerCase().includes(`${path.sep}locales${path.sep}`)) return true;
  if (filePath.toLowerCase().includes('locale-pack')) return true;
  return false;
}

/** Letters outside basic Latin (a–zA–Z) — language-neutral localization signal. */
const NON_ASCII_LETTER = /[^\u0000-\u007F]/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

function isAllowed(filePath) {
  if (ALLOW_BASENAMES.has(path.basename(filePath))) return true;
  if (isI18nCatalogPath(filePath)) return true;
  for (const part of ALLOW_DIR_PARTS) {
    if (filePath.includes(part)) return true;
  }
  return false;
}

/** Extract rough string-literal segments from a line (single + double + template). */
function extractStringLiterals(line) {
  const out = [];
  const patterns = [
    /'([^'\\]|\\.)*'/g,
    /"([^"\\]|\\.)*"/g,
    /`([^`\\]|\\.)*`/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(line)) !== null) {
      out.push(m[0]);
    }
  }
  return out;
}

function isIgnorableNonAscii(char) {
  // Symbols / punctuation / emoji / boxes — not “localized UI words”
  const code = char.codePointAt(0) || 0;
  if (code < 128) return true;
  // General punctuation, currency, math, arrows, box drawing, emoji blocks
  if (code >= 0x2000 && code <= 0x27bf) return true;
  if (code >= 0x1f300 && code <= 0x1faff) return true;
  if (code >= 0x2500 && code <= 0x257f) return true;
  // Middle dots, bullets
  if ([0x00a0, 0x00b7, 0x2022, 0x2026, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d].includes(code)) {
    return true;
  }
  return false;
}

function stringHasLocalizedLetters(literal) {
  // Strip escapes; look for non-ASCII letters only
  const body = literal.slice(1, -1);
  for (const ch of body) {
    if (!NON_ASCII_LETTER.test(ch)) continue;
    if (isIgnorableNonAscii(ch)) continue;
    // Unicode letter?
    if (/\p{L}/u.test(ch)) return true;
  }
  return false;
}

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Locale picker option labels in English source that name a language are OK.
    if (/\b(label|name|title)\s*:\s*['"`].{0,40}(English|Spanish|French|German|Japanese|Chinese|Korean|Portuguese)/i.test(line)) {
      continue;
    }
    for (const lit of extractStringLiterals(line)) {
      if (stringHasLocalizedLetters(lit)) {
        hits.push({ line: i + 1, snippet: line.trim().slice(0, 160) });
        break;
      }
    }
  }
  return hits;
}

const files = walk(SRC);
const violations = [];
for (const file of files) {
  if (isAllowed(file)) continue;
  const hits = scanFile(file);
  if (hits.length) {
    violations.push({ file: path.relative(ROOT, file), hits: hits.slice(0, 6) });
  }
}

if (violations.length === 0) {
  console.log('[check-source-ui-strings] OK — product source strings follow English default; localized UI stays in i18n.');
  process.exit(0);
}

console.error('[check-source-ui-strings] FAIL — non-English letters found in product string literals:\n');
for (const v of violations.slice(0, 40)) {
  console.error(`  ${v.file}`);
  for (const h of v.hits) {
    console.error(`    L${h.line}: ${h.snippet}`);
  }
}
if (violations.length > 40) {
  console.error(`  … and ${violations.length - 40} more files`);
}
console.error(`\nTotal files: ${violations.length}`);
console.error('Move localized UI into i18n/locale catalogs; keep product/feature source in English.');
process.exit(1);
