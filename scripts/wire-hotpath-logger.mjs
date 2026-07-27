/**
 * Replace raw console.* in hot runtime paths with the Zavorth logger.
 * Conservative: only files under known hot directories; preserves brace balance.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const HOT_DIRS = [
  'src/gateway',
  'src/gateways',
  'src/bootstrap',
  'src/runtime',
  'src/host',
  'src/api',
  'src/mcp',
  'src/core',
  'src/security',
  'src/approval-leases',
  'src/orchestrator',
  'src/execution',
].map((p) => join(root, p));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', 'public', 'coverage'].includes(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function braceBalance(s) {
  let n = 0;
  let inS = null;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inS) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inS = c;
      continue;
    }
    if (c === '{') n++;
    else if (c === '}') n--;
  }
  return n;
}

function toLoggerImport(fromFile) {
  const target = join(root, 'src', 'logger');
  let rel = relative(dirname(fromFile), target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.ts$/, '') + '.js';
}

function ensureLoggerImport(source, fromFile) {
  if (/from\s+['"][^'"]*logger(?:\.js)...['"]/.test(source) && /\blogger\b/.test(source)) {
    // already imports something named logger — check it is our module-ish
    if (/import\s*\{[^}]*\blogger\b[^}]*\}\s*from/.test(source)) return source;
  }
  const imp = `import { logger } from '${toLoggerImport(fromFile)}';\n`;
  if (source.startsWith('#!')) {
    const nl = source.indexOf('\n');
    const head = source.slice(0, nl + 1);
    const rest = source.slice(nl + 1);
    const block = rest.match(/^(?:import[\s\S]*...;\r...\n)+/);
    if (block) return head + block[0] + imp + rest.slice(block[0].length);
    return head + imp + rest;
  }
  const block = source.match(/^(?:import[\s\S]*...;\r...\n)+/);
  if (block) return block[0] + imp + source.slice(block[0].length);
  return imp + source;
}

function transform(source) {
  let hits = 0;
  let out = source;

  const pairs = [
    [/console\.error\s*\(/g, 'logger.error('],
    [/console\.warn\s*\(/g, 'logger.warn('],
    [/console\.info\s*\(/g, 'logger.info('],
    [/console\.debug\s*\(/g, 'logger.debug('],
    // console.log → info (hot path operational noise)
    [/console\.log\s*\(/g, 'logger.info('],
  ];

  for (const [re, rep] of pairs) {
    out = out.replace(re, () => {
      hits++;
      return rep;
    });
  }

  return { source: out, hits };
}

let changed = 0;
let totalHits = 0;
let skipped = 0;

for (const dir of HOT_DIRS) {
  for (const file of walk(dir)) {
    if (file.replace(/\\/g, '/').endsWith('/src/logger.ts')) continue;
    const original = readFileSync(file, 'utf8');
    if (!/console\.(log|error|warn|debug|info)\s*\(/.test(original)) continue;

    // Skip test-only helpers accidentally under these trees
    if (/\.test\.|\.spec\./.test(file)) continue;

    let { source, hits } = transform(original);
    if (hits === 0 || source === original) continue;

    source = ensureLoggerImport(source, file);

    if (braceBalance(source) !== braceBalance(original)) {
      skipped++;
      console.warn('SKIP brace', relative(root, file));
      continue;
    }

    if (!dryRun) writeFileSync(file, source, 'utf8');
    changed++;
    totalHits += hits;
  }
}

console.log(`${dryRun ? 'DRY-RUN ' : ''}changedFiles=${changed} hits=${totalHits} skipped=${skipped}`);
