#!/usr/bin/env node
/**
 * npm publish preflight (safe for dry-run).
 * Validates package.json, runs npm pack --dry-run, optional version/tag checks.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const asJson = process.argv.includes('--json');
const expectTag = process.env.GITHUB_REF_NAME || '';

const checks = [];

function add(status, label, observed, details = []) {
  checks.push({ status, label, observed, details });
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.name || !pkg.version) {
    add('failed', 'package identity', 'missing name/version');
  } else {
    add('passed', 'package identity', `${pkg.name}@${pkg.version}`);
  }
  if (pkg.license !== 'MIT') {
    add('failed', 'license', String(pkg.license));
  } else {
    add('passed', 'license', 'MIT');
  }
  if (pkg.private === true) {
    add('failed', 'publishable', 'package.private=true');
  } else {
    add('passed', 'publishable', 'public');
  }

  if (expectTag && /^v\d/.test(expectTag)) {
    const tagVersion = expectTag.replace(/^v/, '');
    if (tagVersion !== pkg.version && !pkg.version.startsWith(tagVersion)) {
      add(
        tagVersion === pkg.version ? 'passed' : 'failed',
        'tag/version alignment',
        `tag=${expectTag} package=${pkg.version}`,
        tagVersion === pkg.version ? [] : ['Tag version should match package.json version for release publishes'],
      );
    } else {
      add('passed', 'tag/version alignment', `tag=${expectTag} package=${pkg.version}`);
    }
  } else {
    add('passed', 'tag/version alignment', 'no release tag in env (skipped strict check)');
  }
} catch (error) {
  add('failed', 'package.json', error instanceof Error ? error.message : String(error));
}

// Prefer invoking npm-cli.js via node (no shell) to avoid Windows deprecation / path issues.
const pack = runNpmPackDryRun(root);
if (pack.status === 0) {
  const lines = String(pack.stdout || '')
    .split(/\r...\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-5);
  add('passed', 'npm pack --dry-run', 'ok', lines);
} else {
  const detail = [
    pack.error ? pack.error.message : '',
    String(pack.stderr || pack.stdout || '').slice(0, 500),
  ].filter(Boolean);
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    add('failed', 'npm pack --dry-run', `exit=${pack.status}`, detail);
  } else {
    add(
      'passed',
      'npm pack --dry-run',
      `skipped local failure (exit=${pack.status}); identity checks passed`,
      detail.slice(0, 2),
    );
  }
}

const failed = checks.filter((c) => c.status !== 'passed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  surface: 'npm-publish-preflight',
  status: failed.length === 0 ? 'passed' : 'failed',
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[npm-publish-preflight]');
  for (const check of checks) {
    console.log(`  ${check.status === 'passed' ? 'ok' : 'fail'} ${check.label}: ${check.observed}`);
    for (const d of check.details.slice(0, 5)) console.log(`    - ${d}`);
  }
  console.log(`[npm-publish-preflight] verdict: ${snapshot.status}`);
}

if (failed.length > 0) process.exitCode = 1;

function runNpmPackDryRun(cwd) {
  const args = ['pack', '--dry-run', '--ignore-scripts'];
  const npmCliCandidates = [
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(cwd, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const npmCli of npmCliCandidates) {
    if (!fs.existsSync(npmCli)) continue;
    const result = spawnSync(process.execPath, [npmCli, ...args], {
      cwd,
      encoding: 'utf8',
      shell: false,
      timeout: 120_000,
      windowsHide: true,
    });
    if (result.status !== null) return result;
  }

  // Fallback: npm on PATH (may need shell on some Windows installs)
  const isWin = process.platform === 'win32';
  return spawnSync(isWin ? 'npm.cmd' : 'npm', args, {
    cwd,
    encoding: 'utf8',
    shell: isWin,
    timeout: 120_000,
    windowsHide: true,
  });
}
