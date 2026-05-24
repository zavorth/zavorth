#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  fileExists('scripts/build-standalone.ts'),
  fileExists('scripts/release-artifacts.ts'),
  fileExists('dist-standalone/zavorth.cjs'),
  fileExists('dist-standalone/zavorth-linux-x64'),
  fileExists('dist-standalone/zavorth-linux-arm64'),
  fileExists('dist-standalone/zavorth-macos-x64'),
  fileExists('dist-standalone/zavorth-macos-arm64'),
  fileExists('dist-standalone/zavorth-win-x64.cmd'),
  fileExists('dist-standalone/zavorth-win-arm64.cmd'),
  fileExists('dist-standalone/standalone-manifest.json'),
  contains('dist-standalone/zavorth.cjs', ['requires Node.js 18 or newer', 'dist', 'zavorth-cli.js']),
  manifestValid(),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[standalone-launcher-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[standalone-launcher-check] passed ${checks.length} checks`);

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

function manifestValid() {
  const target = path.join(root, 'dist-standalone', 'standalone-manifest.json');
  if (!fs.existsSync(target)) {
    return { name: 'manifest:standalone', passed: false, detail: 'manifest missing' };
  }
  const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const nativeOk = manifest.nativeBinaryStatus === 'not-built';
  const nodeOk = String(manifest.minimumNode || '').startsWith('18.');
  return {
    name: 'manifest:standalone',
    passed: artifacts.length >= 7 && nativeOk && nodeOk,
    detail: artifacts.length >= 7 && nativeOk && nodeOk ? 'ok' : 'manifest is incomplete',
  };
}
