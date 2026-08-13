#!/usr/bin/env node
/**
 * Regex sentinel fixer (Phase 2.17). Surgical in-place version.
 *
 * For each line flagged by lint-regex, finds the regex literals on that line
 * and applies the `...` → `?` fix IN-PLACE. Skips escapes and char classes.
 *
 * The lint output truncates the corrupted regex at the corruption point,
 * so we cannot rely on matching the exact lint-reported body. Instead we
 * apply the fix to any regex literal on the flagged line.
 *
 * Rules:
 *   - `...` inside `[...]` (char class) → SKIP (literal three dots)
 *   - `\...` (escape sequence) → SKIP (literal `...`)
 *   - All other `...` → `?` (optional quantifier)
 *     - `+...` → `+?` (lazy)
 *     - `*...` → `*?` (lazy)
 *     - `(?:X)...` → `(?:X)?` (optional group)
 *
 * Usage:
 *   node scripts/lib/fix-regex-sentinels.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const LINT_OUTPUT = path.join(process.env.TEMP || '/tmp', 'opencode', 'lint-regex-full.txt');

function parseFlaggedLines(text) {
  const linesByFile = new Map();
  let currentFile = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('FAIL:')) {
      currentFile = line.slice('FAIL:'.length).trim().replace(/\\/g, '/');
      continue;
    }
    const m = line.match(/line\s+(\d+):/);
    if (m && currentFile) {
      const lineNumber = parseInt(m[1], 10);
      if (!linesByFile.has(currentFile)) linesByFile.set(currentFile, new Set());
      linesByFile.get(currentFile).add(lineNumber);
    }
  }
  return linesByFile;
}

function findRegexRanges(line) {
  const ranges = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '/' && line[i - 1] !== '\\') {
      const start = i;
      i++;
      let depth = 0;
      let end = -1;
      while (i < line.length) {
        const c = line[i];
        if (c === '\\' && i + 1 < line.length) {
          i += 2;
          continue;
        }
        if (c === '[' && depth === 0) {
          depth = 1;
          i++;
          continue;
        }
        if (c === ']' && depth === 1) {
          depth = 0;
          i++;
          continue;
        }
        if (c === '/' && depth === 0) {
          end = i;
          break;
        }
        i++;
      }
      if (end === -1) break;
      let flagEnd = end + 1;
      while (flagEnd < line.length && /[gimsuy]/.test(line[flagEnd])) flagEnd++;
      ranges.push([start, flagEnd]);
      i = flagEnd;
    } else {
      i++;
    }
  }
  return ranges;
}

function fixRegexContent(body) {
  let fixed = '';
  let j = 0;
  let changed = false;
  while (j < body.length) {
    const c = body[j];
    if (c === '\\' && j + 1 < body.length) {
      fixed += body.slice(j, j + 2);
      j += 2;
      continue;
    }
    if (c === '[') {
      const closeIdx = body.indexOf(']', j);
      if (closeIdx === -1) {
        fixed += c;
        j++;
      } else {
        fixed += body.slice(j, closeIdx + 1);
        j = closeIdx + 1;
      }
      continue;
    }
    if (c === '.' && body[j + 1] === '.' && body[j + 2] === '.') {
      fixed += '?';
      changed = true;
      j += 3;
      continue;
    }
    fixed += c;
    j++;
  }
  return { changed, text: fixed };
}

if (!fs.existsSync(LINT_OUTPUT)) {
  console.error(`ERROR: lint output not found at ${LINT_OUTPUT}`);
  console.error('Run: node scripts/lib/lint-regex.mjs > %TEMP%\\opencode\\lint-regex-full.txt 2>&1');
  process.exit(1);
}

const rawLint = fs.readFileSync(LINT_OUTPUT);
const lintText = (rawLint[0] === 0xff && rawLint[1] === 0xfe)
  ? rawLint.slice(2).toString('utf16le')
  : rawLint.toString('utf-8');

const linesByFile = parseFlaggedLines(lintText);
const totalFlaggedLines = [...linesByFile.values()].reduce((acc, s) => acc + s.size, 0);
console.log(`Parsed ${totalFlaggedLines} flagged line(s) across ${linesByFile.size} file(s).\n`);

let totalChangedFiles = 0;
let totalChangedLines = 0;
const failures = [];

for (const [relPath, lineNumbers] of linesByFile) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`NOT FOUND: ${relPath}`);
    continue;
  }
  const original = fs.readFileSync(fullPath, 'utf-8');
  const lines = original.split(/\r?\n/);
  let fileChanged = false;

  for (const lineNumber of lineNumbers) {
    const lineIdx = lineNumber - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) {
      failures.push(`LINE OUT OF RANGE: ${relPath}:${lineNumber}`);
      continue;
    }
    const originalLine = lines[lineIdx];
    const regexRanges = findRegexRanges(originalLine);
    if (regexRanges.length === 0) {
      failures.push(`NO REGEX ON LINE: ${relPath}:${lineNumber}`);
      continue;
    }

    let newLine = originalLine;
    let lineChanged = false;
    for (const [start, end] of [...regexRanges].reverse()) {
      const literal = originalLine.slice(start, end);
      const lastSlash = literal.lastIndexOf('/');
      const body = literal.slice(1, lastSlash);
      const flags = literal.slice(lastSlash + 1);
      const prefix = literal[0];
      const result = fixRegexContent(body);
      if (result.changed) {
        const newLiteral = prefix + result.text + prefix + flags;
        newLine = newLine.slice(0, start) + newLiteral + newLine.slice(end);
        lineChanged = true;
      }
    }

    if (lineChanged) {
      lines[lineIdx] = newLine;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    totalChangedFiles++;
    totalChangedLines += [...lineNumbers].filter((ln) => {
      const idx = ln - 1;
      return idx >= 0 && idx < lines.length;
    }).length;
    if (!DRY_RUN) {
      fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
    }
    console.log(`${DRY_RUN ? '[DRY]' : '[FIX]'} ${relPath} (${lineNumbers.size} line(s))`);
  }
}

console.log(`\nTotal: ${totalChangedFiles} file(s) ${DRY_RUN ? 'would be' : ''} modified.`);
if (failures.length > 0) {
  console.log(`\nIssues (${failures.length}):`);
  for (const f of failures.slice(0, 20)) console.log(`  - ${f}`);
}
