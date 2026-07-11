#!/usr/bin/env node
/**
 * Honest ops signing / store readiness — does NOT claim signed artifacts exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const structural = [
  'scripts/installer-release-manifest.mjs',
  'scripts/installer-readiness-check.mjs',
  'scripts/release-installer-rollback-check.mjs',
  'docs/product/launch-readiness.md',
  'docs/product/release-hardening.md',
  '.github/workflows/release.yml',
];

const signedHints = [
  'dist-release',
  'release-assets',
  'out/make',
  'apps/zavorth-desktop/out',
];

const missing = structural.filter((rel) => !fs.existsSync(path.join(root, rel)));
const foundSigned = signedHints.filter((rel) => fs.existsSync(path.join(root, rel)));

console.log('[ops-signing] structural packaging paths');
for (const rel of structural) {
  console.log(`  ${fs.existsSync(path.join(root, rel)) ? 'ok' : 'MISS'} ${rel}`);
}

console.log('[ops-signing] signed/store artifact dirs (optional)');
if (foundSigned.length === 0) {
  console.log('  none present — expected until ops produces signed installers');
} else {
  for (const rel of foundSigned) console.log(`  present ${rel}`);
}

if (missing.length) {
  console.error('[ops-signing] structural gaps:', missing.join(', '));
  process.exit(1);
}

console.log('[ops-signing] readiness: packaging scripts OK; signed store assets remain OPS-ONLY');
console.log('[ops-signing] do not claim public store launch without signed artifacts + channel publish');
process.exit(0);
