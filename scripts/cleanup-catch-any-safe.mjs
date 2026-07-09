/**
 * Safe residual catch cleanup:
 * - catch (x: any) → catch (x: unknown)
 * - alias soup → asErrorLike bindings
 * - no structural body rewrites
 * - brace-balance guard per file
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (['node_modules', 'dist', '.next', 'public', 'coverage', 'release', 'assets'].includes(name)) continue;
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

function ensureImport(source, fromFile) {
  if (/from\s+['"][^'"]*errorLike['"]/.test(source) && /\basErrorLike\b/.test(source)) return source;
  if (!source.includes('asErrorLike(')) return source;
  const util = join(root, 'src', 'utils', 'errorLike');
  let rel = relative(dirname(fromFile), util).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  rel = rel.replace(/\.ts$/, '');
  const line = `import { asErrorLike } from '${rel}';\n`;
  // never insert before shebang
  if (source.startsWith('#!')) {
    const nl = source.indexOf('\n');
    if (nl < 0) return source;
    const rest = source.slice(nl + 1);
    const importBlock = rest.match(/^(?:import[\s\S]*?;\r?\n)+/);
    if (importBlock) {
      return source.slice(0, nl + 1) + importBlock[0] + line + rest.slice(importBlock[0].length);
    }
    return source.slice(0, nl + 1) + line + rest;
  }
  const importBlock = source.match(/^(?:import[\s\S]*?;\r?\n)+/);
  if (importBlock) {
    return importBlock[0] + line + source.slice(importBlock[0].length);
  }
  return line + source;
}

function transform(source) {
  let hits = 0;
  let out = source;

  const rep = (re, to) => {
    out = out.replace(re, (...args) => {
      hits++;
      return typeof to === 'function' ? to(...args) : to;
    });
  };

  // one-line alias soups first
  rep(
    /catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*const\s+err\s*=\s*error\s*;\s*const\s+e\s*=\s*error\s*;/g,
    'catch (error: unknown) { const err = asErrorLike(error); const e = err;',
  );
  rep(
    /catch\s*\(\s*err\s*:\s*any\s*\)\s*\{\s*const\s+error\s*=\s*err\s*;\s*const\s+e\s*=\s*err\s*;/g,
    'catch (error: unknown) { const err = asErrorLike(error); const e = err;',
  );
  rep(
    /catch\s*\(\s*e\s*:\s*any\s*\)\s*\{\s*const\s+error\s*=\s*e\s*;\s*const\s+err\s*=\s*e\s*;/g,
    'catch (error: unknown) { const err = asErrorLike(error); const e = err;',
  );
  rep(
    /catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*const\s+err\s*=\s*error\s*;/g,
    'catch (error: unknown) { const err = asErrorLike(error);',
  );
  rep(
    /catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*const\s+e\s*=\s*error\s*;/g,
    'catch (error: unknown) { const e = asErrorLike(error);',
  );

  // generic any → unknown in catch param (no body rewrite)
  rep(/catch\s*\(\s*([A-Za-z_][\w]*)\s*:\s*any\s*\)/g, 'catch ($1: unknown)');
  rep(/\.catch\s*\(\s*\(\s*([A-Za-z_][\w]*)\s*:\s*any\s*\)\s*=>/g, '.catch(($1: unknown) =>');

  // leftover pure alias lines after already-unknown catch (standalone)
  rep(/^[ \t]*const\s+err\s*=\s*error\s*;\s*const\s+e\s*=\s*error\s*;\s*$/gm, (line) => {
    const indent = line.match(/^[ \t]*/)[0];
    return `${indent}const err = asErrorLike(error);\n${indent}const e = err;`;
  });
  rep(/^[ \t]*const\s+error\s*=\s*err\s*;\s*const\s+e\s*=\s*err\s*;\s*$/gm, (line) => {
    const indent = line.match(/^[ \t]*/)[0];
    return `${indent}const error = asErrorLike(err);\n${indent}const e = error;`;
  });

  // collapse double e = err
  rep(/const e = err;\s*const e = err;/g, 'const e = err;');

  return { source: out, hits };
}

const roots = ['src', 'apps', 'agent', 'tests'].map((r) => join(root, r));
const files = roots.flatMap((r) => walk(r));
let changed = 0;
let totalHits = 0;
let skippedBalance = 0;

for (const file of files) {
  if (file.replace(/\\/g, '/').endsWith('/src/utils/errorLike.ts')) continue;
  const original = readFileSync(file, 'utf8');
  if (original.length > 1_500_000) continue;
  if (!/:\s*any\b/.test(original) && !/const err = error;\s*const e = error/.test(original) && !/const e = err/.test(original)) {
    // still process files with catch any only
    if (!/catch\s*\([^)]*any/.test(original)) continue;
  }

  let { source, hits } = transform(original);
  if (hits === 0 || source === original) continue;

  if (source.includes('asErrorLike(')) {
    source = ensureImport(source, file);
  }

  if (braceBalance(source) !== braceBalance(original)) {
    skippedBalance++;
    console.warn('SKIP brace imbalance', relative(root, file));
    continue;
  }

  // refuse if shebang not first
  if (original.startsWith('#!') && !source.startsWith('#!')) {
    skippedBalance++;
    console.warn('SKIP shebang', relative(root, file));
    continue;
  }

  if (!dryRun) writeFileSync(file, source, 'utf8');
  changed++;
  totalHits += hits;
}

console.log(
  `${dryRun ? 'DRY-RUN ' : ''}changedFiles=${changed} hits=${totalHits} skippedBalance=${skippedBalance}`,
);
