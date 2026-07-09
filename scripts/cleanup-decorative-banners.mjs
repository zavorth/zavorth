/**
 * Remove decorative section banners from TS/TSX (// ----, // ==== wrappers).
 * Keeps real comments that contain substance beyond separator characters.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [join(root, 'src'), join(root, 'apps'), join(root, 'agent', 'src'), join(root, 'tests')];
const dryRun = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (['node_modules', 'dist', '.next', 'public', 'release', 'coverage', 'assets'].includes(name)) continue;
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

function isBannerLine(line) {
  const t = line.trim();
  if (!t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*')) return false;

  // // ========== Title ==========
  if (/^\/\/\s*[=]{4,}/.test(t)) return true;
  if (/^\/\/\s*[-]{4,}/.test(t)) return true;
  if (/^\/\/\s*[*]{4,}/.test(t)) return true;

  // // ============ Skill Registry ============
  if (/^\/\/\s*[=-]{3,}.*[=-]{3,}\s*$/.test(t)) return true;

  // /* ===== ... ===== */
  if (/^\/\*\s*[=-]{4,}.*[=-]{4,}\s*\*\/$/.test(t)) return true;

  // Phase markers the user banned
  if (/^\/\/\s*(P[0-9]|D[0-9]|C[0-9]|Sprint\s*\d|Phase\s*[A-Z0-9])/i.test(t)) return true;
  if (/^\/\/\s*---\s*(P[0-9]|D[0-9]|C[0-9])/i.test(t)) return true;

  return false;
}

function cleanFile(source) {
  const lines = source.split(/\r?\n/);
  const out = [];
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isBannerLine(lines[i])) {
      removed++;
      // also drop a following pure blank if we created double blanks later
      continue;
    }
    out.push(lines[i]);
  }
  // collapse 3+ blanks to 2
  let text = out.join('\n').replace(/\n{3,}/g, '\n\n');
  if (!text.endsWith('\n') && source.endsWith('\n')) text += '\n';
  return { text, removed };
}

let changedFiles = 0;
let totalRemoved = 0;
const files = roots.flatMap((r) => walk(r));
for (const file of files) {
  const original = readFileSync(file, 'utf8');
  if (original.length > 1_500_000) continue;
  const { text, removed } = cleanFile(original);
  if (removed === 0 || text === original) continue;
  if (!dryRun) writeFileSync(file, text, 'utf8');
  changedFiles++;
  totalRemoved += removed;
}
console.log(`${dryRun ? 'DRY-RUN ' : ''}changedFiles=${changedFiles} removedLines=${totalRemoved}`);
