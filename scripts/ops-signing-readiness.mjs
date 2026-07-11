#!/usr/bin/env node
/**
 * Honest ops signing / store readiness — does NOT claim signed artifacts exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const requireSigned = process.argv.includes('--require-signed');

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
const report = {
  generatedAt: new Date().toISOString(),
  version: 'ops-signing/v1',
  structuralOk: missing.length === 0,
  signedArtifactsPresent: foundSigned.length > 0,
  claimsStoreLaunch: false,
  missingStructural: missing,
  signedPathsFound: foundSigned,
  notes: foundSigned.length
    ? 'Signed/store paths present — still verify cert identity and notarization before store language.'
    : 'Packaging scripts OK; signed store assets remain OPS-ONLY.',
};

const outPath = path.join(root, '.zavorth', 'ops-signing-report.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
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
  } else {
    console.log('[ops-signing] readiness: packaging scripts OK; signed store assets remain OPS-ONLY');
    console.log('[ops-signing] do not claim public store launch without signed artifacts + channel publish');
  }
  console.log(`[ops-signing] report: ${path.relative(root, outPath)}`);
}

if (missing.length) process.exit(1);
if (requireSigned && !foundSigned.length) process.exit(2);
process.exit(0);
