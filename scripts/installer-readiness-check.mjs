#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checks = [];

checks.push(fileExists('scripts/install-zavorth.ps1'));
checks.push(fileExists('scripts/install-zavorth.sh'));
checks.push(fileExists('scripts/install.ps1'));
checks.push(fileExists('scripts/install.sh'));
checks.push(fileExists('scripts/installer-release-manifest.mjs'));
checks.push(fileExists('scripts/release-manifest.json'));
checks.push(fileExists('scripts/release-channels-check.mjs'));
checks.push(fileExists('install/install.ps1'));
checks.push(fileExists('scripts/zavorth-install-smoke-docker.sh'));
checks.push(fileExists('docs/README.md'));
checks.push(fileExists('docs/install.md'));
checks.push(contains('scripts/zavorth-install-smoke-docker.sh', [
  'ZAVORTH_INSTALL_SMOKE_IMAGE',
  'ZAVORTH_INSTALL_SMOKE_PLATFORM',
  'bash scripts/install-zavorth.sh --dry-run',
  'npm install -g /pkg/$TARBALL --omit=optional',
  'zavorth help doctor',
]));
checks.push(contains('docs/install.md', [
  'scripts/install.sh',
  'scripts/install.ps1',
  '--dry-run',
  'Node.js 18+',
]));
checks.push(contains('package.json', [
  'installer-readiness:check',
  'qa:installer-readiness',
  'installer-release:check',
  'qa:installer-release',
  'release-channels:check',
  'qa:release-channels',
  'install-smoke:docker',
]));
checks.push(contains('scripts/install.sh', [
  'ZAVORTH_CHANNEL',
  '--channel',
  'nightly',
]));
checks.push(contains('scripts/install.ps1', [
  'ZAVORTH_CHANNEL',
  'ValidateSet',
  'nightly',
]));
checks.push(contains('scripts/installer-release-manifest.mjs', [
  'zavorth-installer-release-manifest/1',
  'standaloneBinaries',
  'not-published',
  'generatedArtifactsOnly',
  'aggregateSha256',
]));
checks.push(noMojibake('scripts/install.sh'));
checks.push(noMojibake('scripts/install.ps1'));
checks.push(noMojibake('scripts/installer-release-manifest.mjs'));
checks.push(noMojibake('src/cli/presentation/TerminalTheme.ts'));

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[installer-readiness-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[installer-readiness-check] passed ${checks.length} checks`);

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

function noMojibake(file) {
  const target = join(root, file);
  const content = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const suspicious = [String.fromCharCode(195), String.fromCharCode(194), String.fromCharCode(226,156), String.fromCharCode(226,154), String.fromCharCode(226,132), String.fromCharCode(226,157)];
  const found = suspicious.filter((needle) => content.includes(needle));
  return {
    name: `encoding:${file}`,
    passed: found.length === 0,
    detail: found.length === 0 ? 'ok' : `suspicious sequences ${found.join(', ')}`,
  };
}
