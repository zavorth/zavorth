#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packagePath = path.join(root, 'package.json');
const baselinePath = path.join(root, 'config', 'public-api-baseline.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const currentExports = Object.keys(pkg.exports || {});

if (process.argv.includes('--write')) {
  const next = { schemaVersion: 1, packageVersion: pkg.version, exports: currentExports };
  fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Recorded ${currentExports.length} public exports for ${pkg.version}.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const currentMajor = major(pkg.version);
const baselineMajor = major(baseline.packageVersion);
const removed = baseline.exports.filter((entry) => !currentExports.includes(entry));
const malformed = currentExports.filter((entry) => {
  const descriptor = pkg.exports[entry];
  return entry !== './package.json' && (!descriptor || typeof descriptor.types !== 'string' || typeof descriptor.default !== 'string');
});

if (malformed.length > 0) {
  console.error(`Public exports need types and default targets: ${malformed.join(', ')}`);
  process.exit(1);
}

if (removed.length > 0 && currentMajor <= baselineMajor) {
  console.error(`Breaking public export removal requires a new major version: ${removed.join(', ')}`);
  process.exit(1);
}

if (currentMajor < baselineMajor) {
  console.error(`Package major ${currentMajor} is older than compatibility baseline ${baselineMajor}.`);
  process.exit(1);
}

console.log(`Public API compatibility passed: ${baseline.exports.length} baseline exports preserved; ${currentExports.length} current exports.`);

function major(version) {
  const parsed = Number.parseInt(String(version).split('.')[0], 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid package version: ${version}`);
  return parsed;
}
