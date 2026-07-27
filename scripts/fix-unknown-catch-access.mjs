/**
 * Fix TS18046/TS2339 from catch (x: unknown) using .message/.stack/.code without narrowing.
 * Strategy:
 * - Ensure asErrorLike import
 * - After catch (name: unknown) {, ensure `const __err = asErrorLike(name);`
 * - Rewrite name.message/stack/code/name (property) to __err.* when name is the catch param
 * - Fix `const error = asErrorLike(x); ? error.message` when error typed as {} incorrectly — leave asErrorLike return type strong
 * - Fix import mid-block for logger
 * - Fix unbound catch params renamed badly (fallbackError, etc.)
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', 'public', 'coverage', 'release'].includes(name)) continue;
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
  let rel = relative(dirname(fromFile), join(root, 'src', 'utils', 'errorLike')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.ts$/, '') + (fromFile.includes(`${join('src')}`) ? '.js' : '');
}

// Prefer .js extension for monorepo src imports
function ensureImport(source, fromFile) {
  if (/\basErrorLike\b/.test(source) && /from\s+['"][^'"]*errorLike/.test(source)) return source;
  if (!/\basErrorLike\s*\(/.test(source)) return source;
  let rel = relative(dirname(fromFile), join(root, 'src', 'utils', 'errorLike')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  // Match project style: .js suffix in src
  if (fromFile.replace(/\\/g, '/').includes('/src/')) {
    rel = rel.replace(/\.ts$/, '') + '.js';
  } else {
    rel = rel.replace(/\.ts$/, '');
  }
  const line = `import { asErrorLike } from '${rel}';\n`;
  if (source.startsWith('#!')) {
    const nl = source.indexOf('\n');
    const head = source.slice(0, nl + 1);
    const rest = source.slice(nl + 1);
    const block = rest.match(/^(?:import[\s\S]*...;\r...\n)+/);
    if (block) return head + block[0] + line + rest.slice(block[0].length);
    return head + line + rest;
  }
  // imports stuck mid-file: move all imports to top after shebang
  const midImport = source.match(/\nimport\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];\n/g);
  // First fix mid-file logger imports later

  const block = source.match(/^(?:import[\s\S]*...;\r...\n)+/);
  if (block) return block[0] + line + source.slice(block[0].length);
  return line + source;
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

function processFile(file) {
  if (file.replace(/\\/g, '/').endsWith('/utils/errorLike.ts')) return false;
  let source = readFileSync(file, 'utf8');
  if (source.length > 1_500_000) return false;
  const original = source;
  let hits = 0;

  // Move mid-block imports to top (logger inject bug)
  const midImports = [];
  source = source.replace(
    /^[ \t]*import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];\s*$/gm,
    (line, offset) => {
      // keep top imports
      const before = source.slice(0, offset);
      if (!before.includes('\n') || before.trim().split('\n').every((l) => !l.trim() || l.startsWith('import') || l.startsWith('//') || l.startsWith('/*') || l.startsWith('*') || l.startsWith('#!'))) {
        return line;
      }
      // if previous non-empty line is not import, it's mid-file
      const linesBefore = before.split(/\n/);
      let i = linesBefore.length - 1;
      while (i >= 0 && !linesBefore[i].trim()) i--;
      const prev = i >= 0 ? linesBefore[i].trim() : '';
      if (prev.startsWith('import ') || prev.startsWith('//') || prev.startsWith('*') || prev.startsWith('/*') || prev.startsWith('#!') || prev === '') {
        return line;
      }
      midImports.push(line.trim());
      hits++;
      return '';
    },
  );
  if (midImports.length) {
    const unique = [...new Set(midImports)].join('\n') + '\n';
    if (source.startsWith('#!')) {
      const nl = source.indexOf('\n');
      source = source.slice(0, nl + 1) + unique + source.slice(nl + 1);
    } else {
      const block = source.match(/^(?:import[\s\S]*...;\r...\n)+/);
      if (block) source = block[0] + unique + source.slice(block[0].length);
      else source = unique + source;
    }
  }

  // Fix catch (error: unknown) { const err = asErrorLike(error); ? but uses error. before err
  // Pattern: catch (PARAM: unknown) {
  source = source.replace(
    /catch\s*\(\s*([A-Za-z_][\w]*)\s*:\s*unknown\s*\)\s*\{/g,
    (full, param) => {
      return full; // handled in second pass per-block
    },
  );

  // Per catch block rewrite
  const catchRe = /catch\s*\(\s*([A-Za-z_][\w]*)\s*:\s*unknown\s*\)\s*\{/g;
  const blocks = [];
  let m;
  while ((m = catchRe.exec(source))) {
    const start = m.index;
    const param = m[1];
    const openBrace = m.index + m[0].length ? 1;
    let depth = 0;
    let k = openBrace;
    for (; k < source.length; k++) {
      const ch = source[k];
      if (ch === '"' || ch === "'" || ch === '`') {
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
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          k++;
          break;
        }
      }
    }
    const end = k;
    const header = source.slice(start, openBrace + 1);
    let body = source.slice(openBrace + 1, end - 1);
    const usesProps = new RegExp(
      `\\b${param}\\.(message|stack|code|name)\\b|\\bString\\(\\s*${param}\\s*\\)|\\b${param}\\s*instanceof\\s+Error`,
    ).test(body);
    const hasAsErrorLike =
      new RegExp(`asErrorLike\\s*\\(\\s*${param}\\s*\\)`).test(body) ||
      /asErrorLike\s*\(/.test(body.slice(0, 200));

    // Cases where body uses param.message without binding
    if (usesProps && !new RegExp(`const\\s+\\w+\\s*=\\s*asErrorLike\\s*\\(\\s*${param}\\s*\\)`).test(body.slice(0, 400))) {
      // inject binding
      const indentMatch = body.match(/^\r...\n?([ \t]*)/);
      const indent = indentMatch ? indentMatch[1] || '  ' : '  ';
      // prefer err if free
      const bindName = param === 'error' ? 'err' : param === 'err' ? 'errorLike' : `${param}Like`;
      body = `\n${indent}const ${bindName} = asErrorLike(${param});` + body;
      // rewrite param.prop to bindName.prop except instanceof Error checks
      body = body.replace(new RegExp(`\\b${param}\\.(message|stack|code|name)\\b`, 'g'), `${bindName}.$1`);
      hits++;
      blocks.push({ start, end, text: `catch (${param}: unknown) {${body}}` });
      continue;
    }

    // Has asErrorLike(error) assigned to err but still uses error.message
    if (usesProps) {
      let newBody = body;
      // Find primary binding: const err = asErrorLike(param)
      const bind = body.match(
        new RegExp(`const\\s+([A-Za-z_][\\w]*)\\s*=\\s*asErrorLike\\s*\\(\\s*${param}\\s*\\)\\s*;`),
      );
      if (bind) {
        const bindName = bind[1];
        // don't rewrite if bindName === param (shadow)
        if (bindName !== param) {
          newBody = newBody.replace(
            new RegExp(`\\b${param}\\.(message|stack|code|name)\\b`, 'g'),
            `${bindName}.$1`,
          );
        }
      } else {
        // const err = asErrorLike(error) may use different pattern on same line as catch
      }
      // Fix const error = asErrorLike(x); with {} typing — errorLike return is ErrorLike so OK
      // Fix fallbackError missing: catch (error: unknown) { ? fallbackError
      if (/\bfallbackError\b/.test(newBody) && param !== 'fallbackError' && !/\bcatch\s*\(\s*fallbackError/.test(header)) {
        // rename leftover fallbackError references to param or asErrorLike
        newBody = newBody.replace(/\bfallbackError\b/g, param);
        hits++;
      }
      if (newBody !== body) {
        hits++;
        blocks.push({ start, end, text: `catch (${param}: unknown) {${newBody}}` });
      }
    } else if (/\bfallbackError\b/.test(body) && param !== 'fallbackError') {
      const newBody = body.replace(/\bfallbackError\b/g, param);
      hits++;
      blocks.push({ start, end, text: `catch (${param}: unknown) {${newBody}}` });
    }
  }

  // Apply from end
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    source = source.slice(0, b.start) + b.text + source.slice(b.end);
  }

  // Global: catch (error: unknown) { const err = asErrorLike(error); const e = err;
  // already cleaned

  // Pattern: } catch (error: unknown) { logger.x(error.message without bind
  source = source.replace(
    /catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{\s*(...!\s*const\s+\w+\s*=\s*asErrorLike)/g,
    (match) => match, // already handled in blocks
  );

  // Fix `error is of type unknown` on one-liners:
  // catch (error: unknown) { return x(error.message)
  source = source.replace(
    /catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{\s*([^}]*\berror\.(?:message|stack|code|name)\b[^}]*)\}/g,
    (full, body) => {
      if (/asErrorLike\s*\(\s*error\s*\)/.test(body)) {
        // rewrite error.prop to err.prop if err bound
        if (/const\s+err\s*=\s*asErrorLike\s*\(\s*error\s*\)/.test(body)) {
          hits++;
          return `catch (error: unknown) { ${body.replace(/\berror\.(message|stack|code|name)\b/g, 'err.$1')} }`;
        }
        return full;
      }
      hits++;
      return `catch (error: unknown) { const err = asErrorLike(error); ${body.replace(/\berror\.(message|stack|code|name)\b/g, 'err.$1')} }`;
    },
  );

  // Same for err param
  source = source.replace(
    /catch\s*\(\s*err\s*:\s*unknown\s*\)\s*\{\s*([^}]*\berr\.(?:message|stack|code|name)\b[^}]*)\}/g,
    (full, body) => {
      if (/asErrorLike\s*\(\s*err\s*\)/.test(body)) return full;
      hits++;
      return `catch (err: unknown) { const error = asErrorLike(err); ${body.replace(/\berr\.(message|stack|code|name)\b/g, 'error.$1')} }`;
    },
  );

  // catch (e: unknown) with e.message
  source = source.replace(
    /catch\s*\(\s*e\s*:\s*unknown\s*\)\s*\{\s*([^}]*\be\.(?:message|stack|code|name)\b[^}]*)\}/g,
    (full, body) => {
      if (/asErrorLike\s*\(\s*e\s*\)/.test(body)) {
        if (/const\s+err\s*=\s*asErrorLike\s*\(\s*e\s*\)/.test(body)) {
          hits++;
          return `catch (e: unknown) { ${body.replace(/\be\.(message|stack|code|name)\b/g, 'err.$1')} }`;
        }
        return full;
      }
      hits++;
      return `catch (e: unknown) { const err = asErrorLike(e); ${body.replace(/\be\.(message|stack|code|name)\b/g, 'err.$1')} }`;
    },
  );

  // Fix: const error = asErrorLike(...); where later error is redeclared shadowing — rare

  // Fix used before declaration: catch (error: unknown) { ? error - const error = asErrorLike
  source = source.replace(
    /catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{([\s\S]*...)const\s+error\s*=\s*asErrorLike/g,
    (full, mid) => {
      if (/\berror\./.test(mid) || /\berror\b/.test(mid)) {
        hits++;
        return `catch (error: unknown) {${mid}const err = asErrorLike`;
      }
      return full;
    },
  );
  // After rename const error = to const err =, fix following error. in that block is hard; second tsc pass

  if (source.includes('asErrorLike(')) {
    source = ensureImport(source, file);
  }

  if (source === original) return false;
  if (braceBalance(source) !== braceBalance(original)) {
    console.warn('SKIP brace', relative(root, file));
    return false;
  }
  if (!dryRun) writeFileSync(file, source, 'utf8');
  return hits > 0 || source !== original;
}

const dirs = ['src', 'apps', 'agent', 'tests'].map((d) => join(root, d));
let changed = 0;
for (const d of dirs) {
  for (const f of walk(d)) {
    if (processFile(f)) changed++;
  }
}
console.log(`${dryRun ? 'DRY-RUN ' : ''}changedFiles=${changed}`);
