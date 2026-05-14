#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checks = [];

checks.push(fileExists('scripts/install-zavorth.ps1'));
checks.push(fileExists('scripts/install-zavorth.sh'));
checks.push(fileExists('install/install.ps1'));
checks.push(fileExists('scripts/zavorth-install-smoke-docker.sh'));
checks.push(fileExists('docs/README.md'));
checks.push(fileExists('docs/README.md'));
checks.push(contains('scripts/zavorth-install-smoke-docker.sh', [
  'ZAVORTH_INSTALL_SMOKE_IMAGE',
  'ZAVORTH_INSTALL_SMOKE_PLATFORM',
  'bash scripts/install-zavorth.sh --dry-run',
  'npm install -g /pkg/$TARBALL --omit=optional',
  'zavorth help doctor',
]));
checks.push(contains('docs/README.md', [
  'install scripts',
  'Zavorth installer parity closed',
  'docs/README.md',
]));
checks.push(contains('package.json', [
  'installer-parity:check',
  'qa:installer-parity',
  'install-smoke:docker',
]));

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[installer-parity-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[installer-parity-check] passed ${checks.length} checks`);

function fileExists(file) {
  return {
    name: `file:${file}`,
    passed: existsSync(join(root, file)),
    detail: `${file} must exist`,
  };
}

function contains(file, needles) {
  const target = join(root, file);
  const content = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const missing = needles.filter((needle) => !content.includes(needle));
  return {
    name: `contains:${file}`,
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'ok' : `missing ${missing.join(', ')}`,
  };
}
