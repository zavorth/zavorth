#!/usr/bin/env node
/**
 * Honest ops signing / store readiness — does NOT claim signed artifacts exist
 * merely because a directory folder is present.
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

const artifactDirHints = [
  'dist-release',
  'release-assets',
  'out/make',
  'apps/zavorth-desktop/out',
];

/** Real installer / package extensions (not empty dirs). */
const ARTIFACT_EXT = new Set([
  '.exe', '.msi', '.dmg', '.pkg', '.appimage', '.deb', '.rpm',
  '.zip', '.tar', '.gz', '.tgz', '.AppImage',
]);

function listReleaseArtifacts(rel, maxDepth = 3) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || found.length >= 20) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      const lower = entry.name.toLowerCase();
      const looksSigned =
        ARTIFACT_EXT.has(ext)
        || ARTIFACT_EXT.has(ext.toLowerCase())
        || lower.endsWith('.appimage')
        || lower.includes('setup')
        || lower.includes('installer')
        || lower.endsWith('.sig')
        || lower.endsWith('.asc')
        || lower === 'sha256sums'
        || lower.endsWith('.blockmap');
      if (looksSigned) {
        const st = fs.statSync(full);
        if (st.size > 0) {
          found.push(path.relative(root, full).replace(/\\/g, '/'));
        }
      }
    }
  };
  const st = fs.statSync(abs);
  if (st.isFile() && st.size > 0) {
    found.push(rel);
    return found;
  }
  if (st.isDirectory()) walk(abs, 0);
  return found;
}

const missing = structural.filter((rel) => !fs.existsSync(path.join(root, rel)));
const dirsPresent = artifactDirHints.filter((rel) => fs.existsSync(path.join(root, rel)));
const verifiedArtifacts = artifactDirHints.flatMap((rel) => listReleaseArtifacts(rel));
const signedArtifactsVerified = verifiedArtifacts.length > 0;

const report = {
  generatedAt: new Date().toISOString(),
  version: 'ops-signing/v2',
  structuralOk: missing.length === 0,
  artifactDirsPresent: dirsPresent,
  /** Directory presence only — NOT proof of signed release. */
  signedArtifactDirsPresent: dirsPresent.length > 0,
  /** Non-empty installer/package files under known release dirs. */
  signedArtifactsVerified,
  signedArtifactsFound: verifiedArtifacts.slice(0, 20),
  claimsStoreLaunch: false,
  missingStructural: missing,
  notes: signedArtifactsVerified
    ? 'Installer/package files found under release dirs — still verify cert identity and notarization before store language.'
    : dirsPresent.length
      ? 'Release dirs exist but contain no non-empty installer/package files — not signed-store evidence.'
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

  console.log('[ops-signing] release artifact dirs');
  if (dirsPresent.length === 0) {
    console.log('  none present — expected until ops produces installers');
  } else {
    for (const rel of dirsPresent) console.log(`  dir present ${rel}`);
  }

  console.log('[ops-signing] verified installer/package files');
  if (!signedArtifactsVerified) {
    console.log('  none — directory presence alone is not signed evidence');
  } else {
    for (const rel of verifiedArtifacts.slice(0, 10)) console.log(`  file ${rel}`);
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
if (requireSigned && !signedArtifactsVerified) process.exit(2);
process.exit(0);
