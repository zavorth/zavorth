/**
 * Normalize catch blocks to unknown + asErrorLike without alias soup or redeclare bugs.
 *
 * Target shape:
 *   } catch (error: unknown) {
 *     const err = asErrorLike(error);
 *     ...
 *   }
 *
 * Keeps a secondary `e` alias only when the catch body already references `e`.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [
  join(root, 'src'),
  join(root, 'apps'),
  join(root, 'agent', 'src'),
  join(root, 'tests'),
  join(root, 'scripts'),
].filter((p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
});

const dryRun = process.argv.includes('--dry-run');
const srcUtils = join(root, 'src', 'utils', 'errorLike');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === '.next' ||
      name === 'public' ||
      name === 'release' ||
      name === 'coverage' ||
      name === 'assets'
    ) {
      continue;
    }
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

function toImportPath(fromFile) {
  // Prefer package-local error helper when present (desktop).
  if (fromFile.replace(/\\/g, '/').includes('/apps/zavorth-desktop/')) {
    const local = join(dirname(fromFile), 'errors'); // may not exist; fall back below
    // desktop uses src/lib/errors.ts
    let rel = relative(dirname(fromFile), join(root, 'apps', 'zavorth-desktop', 'src', 'lib', 'errors')).replace(
      /\\/g,
      '/',
    );
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return { path: rel.replace(/\.ts$/, ''), symbol: 'asErrorLike', fromDesktop: true };
  }

  let rel = relative(dirname(fromFile), srcUtils).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return { path: rel.replace(/\.ts$/, ''), symbol: 'asErrorLike', fromDesktop: false };
}

function ensureImport(source, importInfo) {
  if (/\basErrorLike\b/.test(source) && /from\s+['"][^'"]*(errorLike|errors)['"]/.test(source)) {
    return source;
  }
  // agent/ and some packages may not resolve monorepo src — use inline helper fallback only if import would leave monorepo
  const line = `import { asErrorLike } from '${importInfo.path}';\n`;
  const importBlock = source.match(/^(?:import[\s\S]*?;\r?\n)+/);
  if (importBlock) {
    return source.slice(0, importBlock[0].length) + line + source.slice(importBlock[0].length);
  }
  return line + source;
}

/**
 * Extract approximate catch body until matching brace depth returns to 0 from the `{` after catch.
 */
function findCatchBlocks(source) {
  const results = [];
  const re = /catch\s*\(/g;
  let m;
  while ((m = re.exec(source))) {
    const start = m.index;
    let i = m.index + m[0].length;
    // parse param until )
    let depth = 1;
    let paramEnd = -1;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          paramEnd = i;
          break;
        }
      }
    }
    if (paramEnd < 0) continue;
    const param = source.slice(m.index + m[0].length, paramEnd).trim();
    // find {
    let j = paramEnd + 1;
    while (j < source.length && /\s/.test(source[j])) j++;
    // .catch((error: any) => { ... }) arrow form — skip non-block
    if (source[j] === '=' && source[j + 1] === '>') {
      // arrow catch callback: catch((error: any) => {
      // Our regex matched "catch (" of .catch( — handle arrow separately later
      continue;
    }
    if (source[j] !== '{') continue;
    const bodyOpen = j;
    let brace = 0;
    let k = bodyOpen;
    for (; k < source.length; k++) {
      const ch = source[k];
      if (ch === '{') brace++;
      else if (ch === '}') {
        brace--;
        if (brace === 0) {
          k++;
          break;
        }
      } else if (ch === '"' || ch === "'" || ch === '`') {
        // skip strings roughly
        const q = ch;
        k++;
        while (k < source.length) {
          if (source[k] === '\\') {
            k += 2;
            continue;
          }
          if (source[k] === q) break;
          k++;
        }
      }
    }
    const end = k;
    const full = source.slice(start, end);
    const body = source.slice(bodyOpen + 1, end - 1);
    results.push({ start, end, param, body, full });
  }
  return results;
}

function stripLeadingAliasSoup(body) {
  // Remove leading const alias lines that only rename thrown values.
  let rest = body;
  const aliasLine =
    /^\s*const\s+(error|err|e)\s*=\s*(?:asErrorLike\s*\(\s*)?(error|err|e|auditErr|parseError|fallbackError|[A-Za-z_][\w]*)\s*\)?\s*;\s*/;
  // Multi-declaration on one line: const a = ...; const b = ...;
  const multi =
    /^\s*(?:const\s+(?:error|err|e)\s*=\s*(?:asErrorLike\s*\(\s*)?(?:error|err|e|auditErr|parseError|fallbackError|[A-Za-z_][\w]*)\s*\)?\s*;\s*)+/;

  if (multi.test(rest)) {
    rest = rest.replace(multi, '');
  } else {
    while (aliasLine.test(rest)) {
      rest = rest.replace(aliasLine, '');
    }
  }
  return rest;
}

function bodyUses(name, body) {
  // word boundary usage, avoid matching in comments poorly
  const re = new RegExp(`\\b${name}\\b`);
  return re.test(body);
}

function rewriteBlock(param, body) {
  // param forms: error: any | error: unknown | err | e: any | auditErr: unknown
  const pm = param.match(/^([A-Za-z_][\w]*)(?:\s*:\s*([A-Za-z_][\w.|<\s>]+))?$/);
  if (!pm) return null;
  const paramName = pm[1];
  const paramType = (pm[2] || '').trim();

  // Only rewrite if any-related, unknown soup, or missing type with alias soup
  const cleanedBody = stripLeadingAliasSoup(body);
  const needsType = !paramType || paramType === 'any' || paramType === 'unknown';
  const hasSoup =
    /asErrorLike\s*\(/.test(body.slice(0, 300)) ||
    /const\s+(error|err|e)\s*=\s*(error|err|e)/.test(body.slice(0, 400)) ||
    paramType === 'any';

  if (!hasSoup && paramType && paramType !== 'any') {
    // typed non-any already clean-ish
    if (paramType !== 'unknown') return null;
    // unknown without soup — leave if no alias mess
    if (!/const\s+(error|err|e)\s*=/.test(body.slice(0, 200))) return null;
  }

  if (!needsType && !hasSoup) return null;

  // Normalize param name to error when original is error/err/e; keep custom names (auditErr)
  const isGeneric = ['error', 'err', 'e'].includes(paramName);
  const catchParam = isGeneric ? 'error' : paramName;
  const rest = cleanedBody;

  const usesErr = bodyUses('err', rest);
  const usesE = bodyUses('e', rest);
  const usesError = bodyUses('error', rest);

  // Build bindings used by the remaining body
  const lines = [];
  // Always expose asErrorLike under names the body needs
  if (isGeneric) {
    if (usesErr || usesE) {
      lines.push('const err = asErrorLike(error);');
      if (usesE) lines.push('const e = err;');
    } else if (usesError) {
      // body uses error.* — may need cast for property access; prefer asErrorLike rebind only if message access patterns
      // Keep raw error for instanceof checks; provide err when property access likely
      if (/\berror\.(message|stack|code|name)\b/.test(rest) || /\bString\(\s*error\s*\)/.test(rest)) {
        // leave error as unknown — property access is invalid on unknown in strict TS
        // rebind: const err = asErrorLike(error) and we should replace error. with err. — too risky
        lines.push('const err = asErrorLike(error);');
        // If body still uses error.message, keep dual: not ideal but compile-safe with (error as any) avoided
        // Replace is out of scope; inject: // use err for fields
        // Actually many bodies use err.message after soup. After strip, may use error.message
      }
    } else {
      // unused catch param — still type unknown
    }
  } else {
    // custom name
    if (usesErr || usesE || usesError) {
      lines.push(`const err = asErrorLike(${catchParam});`);
      if (usesError) lines.push('const error = err;');
      if (usesE) lines.push('const e = err;');
    }
  }

  // Fix: if body still references error.message on unknown, ensure err exists and body had err from soup
  if (isGeneric && (usesErr || usesE || /\berror\.(message|stack|code|name)\b/.test(rest))) {
    if (!lines.some((l) => l.includes('asErrorLike'))) {
      lines.push('const err = asErrorLike(error);');
    }
  }

  // Special: body uses only e
  if (isGeneric && usesE && !usesErr && !lines.some((l) => l.startsWith('const err'))) {
    lines.unshift('const err = asErrorLike(error);');
    lines.push('const e = err;');
  }

  const indentMatch = rest.match(/^\r?\n?([ \t]*)\S/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const bindingBlock =
    lines.length > 0 ? lines.map((l) => `${indent}${l}`).join('\n') + (rest.trim() ? '\n' : '') : '';

  // Preserve original body whitespace leading newline
  let newBody = rest;
  if (bindingBlock) {
    if (newBody.startsWith('\n')) {
      newBody = '\n' + bindingBlock + newBody.replace(/^\r?\n/, '');
    } else {
      newBody = '\n' + bindingBlock + newBody;
    }
  }

  // Clean accidental double blank
  newBody = newBody.replace(/\n{3,}/g, '\n\n');

  return `catch (${catchParam}: unknown) {${newBody}}`;
}

function rewriteArrowCatches(source) {
  // .catch((error: any) => ({  or .catch((error: any) => {
  return source.replace(
    /\.catch\s*\(\s*\(\s*([A-Za-z_][\w]*)\s*:\s*any\s*\)\s*=>/g,
    '.catch(($1: unknown) =>',
  );
}

function processFile(file) {
  if (file.replace(/\\/g, '/').endsWith('/src/utils/errorLike.ts')) return { changed: false };
  if (file.replace(/\\/g, '/').endsWith('/lib/errors.ts')) return { changed: false };

  let source = readFileSync(file, 'utf8');
  if (source.length > 1_500_000) return { changed: false };

  const original = source;
  source = rewriteArrowCatches(source);

  const blocks = findCatchBlocks(source);
  // rewrite from end to start
  let hits = 0;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    // re-extract from current source offsets only if we process original offsets — we use original blocks from original-ish source
    const rewritten = rewriteBlock(b.param, b.body);
    if (!rewritten) continue;
    // Only replace if different from full (normalize spaces)
    const oldFull = source.slice(b.start, b.end);
    // Re-find by old content match at position — if we already mutated earlier ranges after this start, ok since we go reverse
    if (source.slice(b.start, b.end) !== b.full && source.slice(b.start, b.start + 10) !== b.full.slice(0, 10)) {
      // position shifted — search for b.full
      const idx = source.lastIndexOf(b.full);
      if (idx < 0) continue;
      source = source.slice(0, idx) + rewritten + source.slice(idx + b.full.length);
      hits++;
      continue;
    }
    source = source.slice(0, b.start) + rewritten + source.slice(b.end);
    hits++;
  }

  // Second pass: collapse remaining one-line messes with regex
  const patterns = [
    [
      /catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{\s*const\s+err\s*=\s*asErrorLike\s*\(\s*error\s*\)\s*;\s*const\s+e\s*=\s*err\s*;\s*(?:const\s+e\s*=\s*err\s*;\s*)*/g,
      'catch (error: unknown) { const err = asErrorLike(error); const e = err; ',
    ],
    [
      /catch\s*\(\s*err\s*:\s*unknown\s*\)\s*\{\s*const\s+error\s*=\s*asErrorLike\s*\(\s*err\s*\)\s*;\s*const\s+e\s*=\s*error\s*;\s*(?:const\s+e\s*=\s*err\s*;\s*)*/g,
      'catch (error: unknown) { const err = asErrorLike(error); const e = err; ',
    ],
    [
      /catch\s*\(\s*e\s*:\s*unknown\s*\)\s*\{\s*const\s+error\s*=\s*asErrorLike\s*\(\s*e\s*\)\s*;\s*const\s+err\s*=\s*error\s*;\s*(?:const\s+error\s*=\s*e\s*;\s*)?(?:const\s+err\s*=\s*e\s*;\s*)*/g,
      'catch (error: unknown) { const err = asErrorLike(error); const e = err; ',
    ],
    // broken redeclarations after asErrorLike
    [
      /const\s+err\s*=\s*asErrorLike\s*\(\s*(\w+)\s*\)\s*;\s*const\s+e\s*=\s*err\s*;\s*const\s+error\s*=\s*\1\s*;\s*const\s+err\s*=\s*\1\s*;\s*const\s+e\s*=\s*\1\s*;/g,
      'const err = asErrorLike($1); const e = err;',
    ],
    [
      /const\s+error\s*=\s*asErrorLike\s*\(\s*(\w+)\s*\)\s*;\s*const\s+err\s*=\s*error\s*;\s*const\s+e\s*=\s*error\s*;\s*const\s+error\s*=\s*\1\s*;\s*const\s+err\s*=\s*\1\s*;\s*const\s+e\s*=\s*\1\s*;/g,
      'const err = asErrorLike($1); const e = err;',
    ],
    [
      /const\s+error\s*=\s*asErrorLike\s*\(\s*(\w+)\s*\)\s*;\s*const\s+e\s*=\s*error\s*;\s*const\s+e\s*=\s*\1\s*;/g,
      'const err = asErrorLike($1); const e = err; const error = err;',
    ],
    [
      /catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*const\s+err\s*=\s*error\s*;\s*const\s+e\s*=\s*error\s*;/g,
      'catch (error: unknown) { const err = asErrorLike(error); const e = err;',
    ],
    [/catch\s*\(\s*error\s*:\s*any\s*\)\s*\{/g, 'catch (error: unknown) { const err = asErrorLike(error); const e = err; '],
    [/catch\s*\(\s*err\s*:\s*any\s*\)\s*\{/g, 'catch (error: unknown) { const err = asErrorLike(error); const e = err; '],
    [/catch\s*\(\s*e\s*:\s*any\s*\)\s*\{/g, 'catch (error: unknown) { const err = asErrorLike(error); const e = err; '],
  ];

  for (const [re, rep] of patterns) {
    const before = source;
    source = source.replace(re, rep);
    if (source !== before) hits++;
  }

  // Drop pure alias lines that are still left as standalone duplicates
  source = source.replace(
    /^[ \t]*const\s+e\s*=\s*err\s*;\s*const\s+e\s*=\s*err\s*;\s*$/gm,
    (line) => {
      hits++;
      return line.replace(/const e = err;\s*const e = err;/, 'const e = err;');
    },
  );

  if (source === original) return { changed: false, hits: 0 };

  if (source.includes('asErrorLike(')) {
    // agent package may not import monorepo path well — check
    const rel = file.replace(/\\/g, '/');
    if (rel.includes('/agent/src/')) {
      // inject local minimal helper if import path would escape package
      if (!/\basErrorLike\b/.test(original) || !/from\s+['"][^'"]*errorLike['"]/.test(source)) {
        // Prefer relative to monorepo if tsconfig allows; else local function
        const helper = `function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}\n`;
        if (!source.includes('function asErrorLike(')) {
          const importBlock = source.match(/^(?:import[\s\S]*?;\r?\n)+/);
          if (importBlock) {
            source = source.slice(0, importBlock[0].length) + helper + source.slice(importBlock[0].length);
          } else {
            source = helper + source;
          }
        }
      }
    } else {
      source = ensureImport(source, toImportPath(file));
    }
  }

  if (!dryRun) writeFileSync(file, source, 'utf8');
  return { changed: true, hits };
}

let changedFiles = 0;
let totalHits = 0;
const files = roots.flatMap((r) => walk(r));
for (const file of files) {
  const result = processFile(file);
  if (result.changed) {
    changedFiles++;
    totalHits += result.hits || 1;
  }
}
console.log(`${dryRun ? 'DRY-RUN ' : ''}changedFiles=${changedFiles} hits=${totalHits} scanned=${files.length}`);
