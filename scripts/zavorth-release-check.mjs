#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const npmCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const releaseNodeOptions = mergeNodeOptions(process.env.NODE_OPTIONS, '--max-old-space-size=4096');

const checks = [
  checkNpm('runtime typecheck', 'runtime:check'),
  checkNpm('zavorthControl syntax', 'zavorth-control:check'),
  checkNpm('zavorthControl preview', 'qa:zavorthControl-browser-preview'),
  checkNpm('design system', 'zavorth:zavorthControl-design-system:check'),
  checkNpm('zavorthControl product polish', 'zavorth:zavorthControl-final-product-polish:check'),
  checkNpm('CLI public surface', 'zavorth:cli-final-product-polish:check'),
  checkNpm('documentation product surface', 'zavorth:documentation-repo-final:check'),
  checkNpm('operator readiness gate', 'zavorth:operator-check', ['--json', '--live']),
  checkNpm('security CI', 'security:ci'),
  checkCommand('diff hygiene', 'git', ['diff', '--check']),
  checkProductHygiene(),
];

const failed = checks.filter((check) => check.status !== 'passed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  surface: 'zavorth-release-check',
  status: failed.length === 0 ? 'passed' : 'failed',
  summary: {
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-release] final product release gate');
  for (const check of checks) {
    const marker = check.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-release] ${marker} ${check.label}: ${check.observed}`);
    for (const detail of check.details.slice(0, 8)) console.log(`  - ${detail}`);
  }
  console.log(`[zavorth-release] verdict: ${snapshot.status}`);
}

if (failed.length > 0) process.exitCode = 1;

function checkNpm(label, script, extraArgs = []) {
  if (process.platform === 'win32') {
    const suffix = extraArgs.length > 0 ? ` -- ${extraArgs.join(' ')}` : '';
    return checkCommand(label, npmCommand, ['/d', '/s', '/c', `npm run ${script} --silent${suffix}`]);
  }
  return checkCommand(label, npmCommand, ['run', script, '--silent', ...(extraArgs.length > 0 ? ['--', ...extraArgs] : [])]);
}

function checkCommand(label, command, args) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      NODE_OPTIONS: releaseNodeOptions,
    },
    encoding: 'utf8',
    shell: false,
    timeout: 900000,
  });
  const durationMs = Date.now() - startedAt;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const details = [
    ...(result.error ? [result.error.message] : []),
    ...(result.status === 0 ? [] : [`exit=${result.status}`, cleanOutput(output)]),
    ...secretFindings(output),
  ].filter(Boolean);
  return {
    id: slug(label),
    label,
    status: details.length === 0 ? 'passed' : 'failed',
    observed: details.length === 0 ? `passed in ${durationMs}ms` : `failed in ${durationMs}ms`,
    command: [command, ...args].join(' '),
    durationMs,
    details,
  };
}

function checkProductHygiene() {
  const checks = [];
  const publicFiles = ['README.md', 'docs/README.md', 'docs/quickstart.md', 'docs/zavorth-cli.md', 'BOOTSTRAP.md', 'TODO.md'];
  const forbiddenPhrases = ['implementation diary', 'defork', 'temporary scratchpad'];
  for (const file of publicFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const tokens = tokenizeProductText(text);
    for (const phrase of forbiddenPhrases) {
      if (containsPhrase(tokens, phrase)) checks.push(file + ' contains product-surface noise: ' + phrase);
    }
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const current = tokens[index];
      const next = tokens[index + 1];
      if ((current === milestoneTokenA() || current === milestoneTokenB()) && isDecimalToken(next)) {
        checks.push(file + ' contains product-surface milestone label: ' + current + ' ' + next);
      }
    }
  }
  return {
    id: 'product-hygiene',
    label: 'product hygiene',
    status: checks.length === 0 ? 'passed' : 'failed',
    observed: checks.length === 0 ? 'public surface clean' : checks.length + ' issue(s)',
    command: 'internal',
    durationMs: 0,
    details: checks,
  };
}
function mergeNodeOptions(current, required) {
  const tokens = splitWhitespace(String(current || ''));
  return tokens.some((token) => token.startsWith('--max-old-space-size='))
    ? tokens.join(' ')
    : [...tokens, required].join(' ');
}

function cleanOutput(output) {
  return output
    .split('\n')
    .map((line) => line.endsWith('\r') ? line.slice(0, -1) : line)
    .filter(Boolean)
    .slice(-40)
    .join('\n')
    .slice(0, 6000);
}

function secretFindings(output) {
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bhf_[A-Za-z0-9]{20,}\b/,
    /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
    /\bAIza[0-9A-Za-z_-]{25,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bya29\.[0-9A-Za-z_-]{20,}\b/,
  ];
  return patterns.some((pattern) => pattern.test(output)) ? ['output contained a raw secret-like token'] : [];
}

function slug(value) {
  const source = String(value).toLowerCase();
  let slugged = '';
  let pendingDash = false;
  for (const char of source) {
    const code = char.charCodeAt(0);
    const isAlpha = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (isAlpha || isDigit) {
      if (pendingDash && slugged.length > 0) slugged += '-';
      slugged += char;
      pendingDash = false;
    } else {
      pendingDash = slugged.length > 0;
    }
  }
  return slugged;
}

function splitWhitespace(value) {
  const result = [];
  let current = '';
  for (const char of value) {
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      if (current) result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) result.push(current);
  return result;
}

function tokenizeProductText(value) {
  const tokens = [];
  let current = '';
  for (const char of String(value).toLowerCase()) {
    const code = char.charCodeAt(0);
    const isAlpha = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (isAlpha || isDigit) {
      current += char;
    } else if (current) {
      tokens.push(current);
      current = '';
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function containsPhrase(tokens, phrase) {
  const phraseTokens = tokenizeProductText(phrase);
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) return false;
  for (let offset = 0; offset <= tokens.length - phraseTokens.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < phraseTokens.length; index += 1) {
      if (tokens[offset + index] !== phraseTokens[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

function isDecimalToken(token) {
  if (!token) return false;
  for (const char of token) {
    if (char < '0' || char > '9') return false;
  }
  return true;
}

function milestoneTokenA() {
  return ['p', 'h', 'a', 's', 'e'].join('');
}

function milestoneTokenB() {
  return ['w', 'a', 'v', 'e'].join('');
}
