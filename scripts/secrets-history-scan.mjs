#!/usr/bin/env node
/**
 * S10 — scan recent git history and working tree for high-signal secret patterns.
 *
 * Usage:
 *   node scripts/secrets-history-scan.mjs
 *   node scripts/secrets-history-scan.mjs --commits 40
 *
 * Exits 1 if findings appear outside allowlisted test/fixture paths.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const commitCount = Number(args[args.indexOf('--commits') + 1]) || 40;

const PATTERNS = [
  { id: 'openai-sk', re: /\bsk-(?:live|proj|test)?[A-Za-z0-9_-]{16,}\b/ },
  { id: 'github-pat', re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { id: 'aws-akia', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'slack-xox', re: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { id: 'private-key', re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { id: 'generic-bearer', re: /\bBearer\s+[A-Za-z0-9._\-+/=]{24,}\b/ },
];

const ALLOW_PATH = /(^|\/)(tests?|__tests__|fixtures?|mocks?|examples?)(\/|$)/i;
const ALLOW_FILE = /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/i;
// Intentional hygiene/demo/redaction surfaces (not production secrets).
const ALLOW_PATH_EXTRA =
  /(MemoryPrivacyService|secret-guard|PrivacyRedactor|redact|honey|smoke-cli-capabilities|practical-agency|ai-first-router-foundation|secrets-history-scan)/i;
const FAKE_FIXTURE =
  /(SHOULDNOTAPPEAR|should-never-print|ShouldDisappear|placeholder|demoSECRET|sk-demo|sk-smoke|sk-test|xoxb-test)/i;

function git(argsList) {
  const result = spawnSync('git', argsList, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
    shell: false,
  });
  return {
    code: result.status ?? 1,
    out: String(result.stdout || ''),
    err: String(result.stderr || ''),
  };
}

function isAllowedPath(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (ALLOW_PATH.test(norm) || ALLOW_FILE.test(norm)) return true;
  if (ALLOW_PATH_EXTRA.test(norm)) return true;
  return false;
}

function isFakeFixtureLine(line) {
  return FAKE_FIXTURE.test(line);
}

const findings = [];

// 1) Recent commit patches
const log = git(['log', `-n`, String(commitCount), '-p', '--pretty=format:COMMIT %H %s']);
if (log.code !== 0 && !log.out) {
  console.error('[secrets-history-scan] git log failed:', log.err.slice(0, 300));
  process.exit(2);
}

let currentCommit = '';
let currentFile = '';
for (const line of log.out.split(/\r?\n/)) {
  if (line.startsWith('COMMIT ')) {
    currentCommit = line.slice(7);
    continue;
  }
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6).trim();
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const added = line.slice(1);
  if (isFakeFixtureLine(added)) continue;
  for (const pattern of PATTERNS) {
    if (pattern.re.test(added) && currentFile && !isAllowedPath(currentFile)) {
      findings.push({
        where: 'history',
        commit: currentCommit.slice(0, 12),
        file: currentFile,
        pattern: pattern.id,
        sample: added.trim().slice(0, 120),
      });
    }
  }
}

// 2) Working tree tracked text files (fast path: git grep)
for (const pattern of PATTERNS) {
  // Use fixed-string approx via git grep with extended regex when possible
  const grepped = git(['grep', '-n', '-I', '-E', pattern.re.source, '--', ':!node_modules', ':!dist', ':!coverage']);
  if (!grepped.out) continue;
  for (const line of grepped.out.split(/\r?\n/)) {
    if (!line) continue;
    if (isFakeFixtureLine(line)) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const file = line.slice(0, idx);
    if (isAllowedPath(file)) continue;
    findings.push({
      where: 'worktree',
      commit: 'WORKTREE',
      file,
      pattern: pattern.id,
      sample: line.slice(0, 160),
    });
  }
}

// Deduplicate
const seen = new Set();
const unique = [];
for (const f of findings) {
  const key = `${f.where}|${f.file}|${f.pattern}|${f.sample}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(f);
}

if (unique.length) {
  console.error('[secrets-history-scan] FAIL — potential secrets outside test allowlist:');
  for (const f of unique.slice(0, 40)) {
    console.error(`- [${f.pattern}] ${f.where} ${f.file} @ ${f.commit}`);
    console.error(`  ${f.sample}`);
  }
  if (unique.length > 40) console.error(`… and ${unique.length - 40} more`);
  process.exit(1);
}

console.log(
  `[secrets-history-scan] PASS — no high-signal secrets in last ${commitCount} commits (non-test paths)`,
);
process.exit(0);
