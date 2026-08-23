/**
 * i18n hygiene gate: user-facing literals must not regress in key desktop
 * directories. The baseline records pre-existing violations; new entries fail
 * the suite so regressions are caught at test time.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');
const KEY_DIRS = ['thread', 'trust'];
const BASELINE_PATH = join(__dirname, 'fixtures', 'i18nHygieneBaseline.json');

const UI_WORD = /\b(approve|reject|cancel|close|save|send|search|settings|loading|retry|delete|open|copy|details|session|always|deny|once|terminal|shell|agent|pending|running|failed|refresh|scroll|answer)\b/i;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.tsx$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

type Violation = { file: string; text: string };

function scanFile(file: string): Violation[] {
  const rel = relative(SRC, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split('\n');
  const found: Violation[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('*') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('import ') ||
      /console\.(log|warn|error)/.test(trimmed)
    ) {
      continue;
    }
    for (const m of line.matchAll(/(aria-label|placeholder|\btitle)="([A-Za-z][^"]{2,})"/g)) {
      if (UI_WORD.test(m[2])) found.push({ file: rel, text: m[2] });
    }
    for (const m of line.matchAll(/>\s*([A-Z][a-z]+(?: [A-Za-z][^<>{}]{1,40})?)\s*</g)) {
      if (UI_WORD.test(m[1]) && !/[{}]/.test(line)) {
        found.push({ file: rel, text: m[1] });
      }
    }
  }
  return found;
}

function currentViolations(): Violation[] {
  const all: Violation[] = [];
  for (const dir of KEY_DIRS) {
    for (const file of listFiles(join(SRC, dir))) {
      all.push(...scanFile(file));
    }
  }
  return all;
}

describe('i18n hygiene in key directories', () => {
  it('has no hardcoded user-facing strings beyond the recorded baseline', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
      violations: Array<{ file: string; text: string }>;
    };
    const baselineKeys = new Set(baseline.violations.map((v) => `${v.file}::${v.text}`));

    const violations = currentViolations();
    const newViolations = violations.filter((v) => !baselineKeys.has(`${v.file}::${v.text}`));

    expect(
      newViolations,
      `New hardcoded user-facing strings detected:\n${newViolations
        .map((v) => `${v.file}: "${v.text}"`)
        .join('\n')}\nMigrate them to localization keys via t() and refresh the baseline only intentionally.`,
    ).toEqual([]);
  });

  it('baseline stays accurate: migrated entries are removed from the snapshot', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
      violations: Array<{ file: string; text: string }>;
    };
    const liveKeys = new Set(currentViolations().map((v) => `${v.file}::${v.text}`));
    const stale = baseline.violations.filter((v) => !liveKeys.has(`${v.file}::${v.text}`));
    expect(
      stale.map((v) => `${v.file}: "${v.text}"`),
      'Baseline lists literals that no longer exist; prune them from the snapshot.',
    ).toEqual([]);
  });
});
