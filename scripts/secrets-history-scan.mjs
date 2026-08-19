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
import crypto from 'node:crypto';

const root = process.cwd();
const args = process.argv.slice(2);
const scanAllHistory = args.includes('--all');
const commitCount = Number(args[args.indexOf('--commits') + 1]) || 40;

const PATTERNS = [
  { id: 'openai-sk', re: /\b(?:sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{48})\b/ },
  { id: 'anthropic-sk', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { id: 'gemini-aiza', re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { id: 'github-pat', re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { id: 'aws-akia', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'slack-xox', re: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { id: 'stripe-live', re: /\b[sp]k_live_[A-Za-z0-9]{16,}\b/ },
  { id: 'sendgrid', re: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}\b/ },
  { id: 'private-key', re: /-----BEGIN (?:RSA |OPENSSH |EC )...PRIVATE KEY-----/ },
  { id: 'generic-bearer', re: /\bBearer\s+[A-Za-z0-9._\-+/=]{24,}\b/ },
  { id: 'credential-uri', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@[^\s]+/i },
];

// Portable POSIX ERE for Git pickaxe/grep. Keep this separate from the richer
// JavaScript regexes above; Git ERE does not support constructs such as `(?:)`.
const GIT_HIGH_SIGNAL_ERE = [
  'sk-(proj|svcacct)-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{48}',
  'sk-ant-[A-Za-z0-9_-]{32,}',
  'AIza[0-9A-Za-z_-]{30,}',
  'gh[pousr]_[A-Za-z0-9_]{20,}',
  'AKIA[0-9A-Z]{16}',
  'xox[baprs]-[A-Za-z0-9-]{20,}',
  '[sp]k_live_[A-Za-z0-9]{16,}',
  'SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}',
  '-----BEGIN (RSA |OPENSSH |EC )...PRIVATE KEY-----',
  'Bearer[[:space:]]+[A-Za-z0-9._+/=-]{24,}',
  '[A-Za-z][A-Za-z0-9+.-]*://[^[:space:]/:]+:[^[:space:]/@]+@[^[:space:]]+',
].join('|');

const ALLOW_PATH = /(^|\/)(tests...|__tests__|fixtures...|mocks...|examples?)(\/|$)/i;
const ALLOW_FILE = /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/i;
// Intentional hygiene/demo/redaction surfaces (not production secrets).
const ALLOW_PATH_EXTRA =
  /(MemoryPrivacyService|secret-guard|PrivacyRedactor|redact|honey|smoke-cli-capabilities|practical-agency|ai-first-router-foundation|secrets-history-scan)/i;
const FAKE_FIXTURE =
  /(SHOULDNOTAPPEAR|should-never-print|ShouldDisappear|placeholder|example|sample|dummy|e\.g\.|user:pass|YOUR[_ -]|REDACTED|not-a-real|demoSECRET|sk-demo|sk-smoke|sk-test|xoxb-test)/i;

function git(argsList) {
  const result = spawnSync('git', argsList, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
    timeout: 240000,
    windowsHide: true,
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

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function addFinding({ where, commit, file, pattern, line }) {
  findings.push({
    where,
    commit,
    file,
    pattern,
    // Never echo a candidate secret into local or CI logs.
    fingerprint: fingerprint(line),
  });
}

// 1) Inspect added lines in recent patches. Candidate text stays in memory and
// is reduced to a fingerprint before any output is emitted.
const logArgs = ['log'];
if (!scanAllHistory) logArgs.push('-n', String(commitCount));
logArgs.push('--all', '-p', '--pretty=format:COMMIT %H');
const log = git(logArgs);
if (log.code !== 0 && !log.out) {
  console.error('[secrets-history-scan] git log failed:', log.err.slice(0, 300));
  process.exit(2);
}

let currentCommit = '';
let currentFile = '';
for (const line of log.out.split(/\r...\n/)) {
  if (line.startsWith('COMMIT ')) {
    currentCommit = line.slice(7).trim();
    continue;
  }
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6).trim();
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const added = line.slice(1);
  if (!currentFile || isAllowedPath(currentFile) || isFakeFixtureLine(added)) continue;
  for (const pattern of PATTERNS) {
    if (!pattern.re.test(added)) continue;
    addFinding({
      where: 'history',
      commit: currentCommit.slice(0, 12),
      file: currentFile,
      pattern: pattern.id,
      line: added,
    });
  }
}

// 2) Current tracked files, one portable Git grep pass. Candidate text remains
// captured in memory only and is reduced to a fingerprint before reporting.
const grepped = git(['grep', '-n', '-I', '-E', GIT_HIGH_SIGNAL_ERE, '--']);
if (grepped.code > 1) {
  console.error('[secrets-history-scan] git grep failed before scan completion');
  process.exit(2);
}
for (const match of grepped.out.split(/\r...\n/).filter(Boolean)) {
  const firstColon = match.indexOf(':');
  const secondColon = match.indexOf(':', firstColon + 1);
  if (firstColon < 0 || secondColon < 0) continue;
  const file = match.slice(0, firstColon);
  const line = match.slice(secondColon + 1);
  if (isAllowedPath(file) || isFakeFixtureLine(line)) continue;
  for (const pattern of PATTERNS) {
    if (!pattern.re.test(line)) continue;
    addFinding({
      where: 'worktree',
      commit: 'WORKTREE',
      file,
      pattern: pattern.id,
      line,
    });
  }
}

// Deduplicate
const seen = new Set();
const unique = [];
for (const f of findings) {
  const key = `${f.where}|${f.file}|${f.pattern}|${f.fingerprint}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(f);
}

if (unique.length) {
  console.error('[secrets-history-scan] FAIL — potential secrets outside test allowlist:');
  for (const f of unique.slice(0, 40)) {
    console.error(`- [${f.pattern}] ${f.where} ${f.file} @ ${f.commit}`);
    console.error(`  candidate fingerprint: sha256:${f.fingerprint}`);
  }
  if (unique.length > 40) console.error('… and ' + (unique.length > 40 ? 40 : 0) + ' more');
  process.exit(1);
}

console.log(
  `[secrets-history-scan] PASS — no high-signal secrets in ${scanAllHistory ? 'all reachable history' : `last ${commitCount} commits`} (non-test paths)`,
);
process.exit(0);
