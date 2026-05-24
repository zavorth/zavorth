#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredChannels = ['stable', 'beta', 'nightly', 'dev'];
const checks = [
  fileExists('scripts/release-manifest.json'),
  fileExists('src/cli/update/ZavorthReleaseChannelService.ts'),
  fileExists('src/cli/update/ZavorthUpdateCommand.ts'),
  contains('scripts/install.sh', ['ZAVORTH_CHANNEL', '--channel', 'stable', 'beta', 'nightly', 'dev']),
  contains('scripts/install.ps1', ['ZAVORTH_CHANNEL', 'ValidateSet', 'stable', 'beta', 'nightly', 'dev']),
  contains('src/cli/ZavorthCliRegistry.ts', ['handleZavorthUpdateCommand']),
  contains('src/cli/update/ZavorthUpdateCommand.ts', ['zavorth update --channel', '--yes', 'Zavorth Version']),
  contains('docs/install.md', ['ZAVORTH_CHANNEL=beta', 'zavorth update --channel beta', 'Release Channels']),
  manifestChannels(),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[release-channels-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[release-channels-check] passed ${checks.length} checks`);

function fileExists(file) {
  return {
    name: `file:${file}`,
    passed: fs.existsSync(path.join(root, file)),
    detail: `${file} must exist`,
  };
}

function contains(file, needles) {
  const target = path.join(root, file);
  const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const missing = needles.filter((needle) => !content.includes(needle));
  return {
    name: `contains:${file}`,
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'ok' : `missing ${missing.join(', ')}`,
  };
}

function manifestChannels() {
  const target = path.join(root, 'scripts/release-manifest.json');
  if (!fs.existsSync(target)) {
    return { name: 'manifest:channels', passed: false, detail: 'manifest missing' };
  }
  const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
  const ids = new Set((manifest.channels || []).map((channel) => channel.id));
  const missing = requiredChannels.filter((channel) => !ids.has(channel));
  const badChecksum = (manifest.channels || []).filter((channel) => !/^[a-f0-9]{64}$/.test(String(channel.checksum || '')));
  return {
    name: 'manifest:channels',
    passed: missing.length === 0 && badChecksum.length === 0,
    detail: missing.length > 0
      ? `missing ${missing.join(', ')}`
      : badChecksum.length > 0
        ? `bad checksum ${badChecksum.map((channel) => channel.id).join(', ')}`
        : 'ok',
  };
}
