#!/usr/bin/env node
/**
 * Pre-commit lint check (opt-in). Run this before committing to catch
 * corrupted regex patterns and other hygiene issues early.
 *
 * Install (opt-in, two options):
 *   1. Symlink to git hooks:
 *      ln -sf ../../scripts/hooks/pre-commit-check.mjs .git/hooks/pre-commit
 *
 *   2. Or set the hooksPath:
 *      git config core.hooksPath scripts/hooks
 *      (then rename this file to `pre-commit` without the .mjs extension)
 *
 * Bypass when needed:
 *   git commit --no-verify
 *
 * Scope:
 *   Only checks STAGED .ts and .mjs files. Pre-existing corruptions in
 *   unstaged files are not flagged here; run `node scripts/lib/lint-regex.mjs`
 *   directly to audit the whole codebase.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../..');

function getStagedFiles() {
  const result = spawnSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd: ROOT, encoding: 'utf-8' },
  );
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split('\n').filter(Boolean);
}

function scanFiles(files) {
  const targets = files.filter((f) => /\.(ts|mjs)$/.test(f) && !f.includes('test'));
  if (targets.length === 0) {
    console.log('[pre-commit] no staged source files to lint.');
    return true;
  }

  console.log(`[pre-commit] scanning ${targets.length} staged file(s):`);
  for (const f of targets) console.log(`  - ${f}`);

  const result = spawnSync(
    'node',
    [path.join(ROOT, 'scripts/lib/lint-regex.mjs')],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error('\n[pre-commit] FAILED: regex hygiene issue(s) in staged files.');
    console.error('[pre-commit] Fix the issues or use --no-verify to bypass.');
    process.exit(1);
  }
  return true;
}

const staged = getStagedFiles();
scanFiles(staged);

console.log('\n[pre-commit] PASS: all staged files clean.');
