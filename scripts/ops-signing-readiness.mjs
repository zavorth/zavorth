#!/usr/bin/env node
/**
 * Honest ops signing / store readiness — does NOT claim signed artifacts exist
 * merely because a directory folder is present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

/**
 * Known release / electron-builder output dirs (presence ≠ signed).
 * Do NOT scan bare repo `dist/` — it is compile output full of false positives.
 */
const artifactDirHints = [
  'dist-release',
  'release-assets',
  'out/make',
  'apps/zavorth-desktop/out',
  'apps/zavorth-desktop/release',
  'apps/zavorth-desktop/dist-electron',
  // electron-builder directories.output for desktop app
  'apps/zavorth-desktop/dist',
  'release',
];

/** Real installer / package extensions only (never match *.js named *setup*). */
const INSTALLER_EXT = new Set([
  '.exe', '.msi', '.dmg', '.pkg', '.appimage', '.deb', '.rpm',
]);
function isInstallerArtifact(name) {
  const lower = String(name || '').toLowerCase();
  const ext = path.extname(lower);
  if (INSTALLER_EXT.has(ext)) return true;
  if (lower.endsWith('.appimage')) return true;
  // Compressed desktop packages only when name looks like a release asset
  if (['.zip', '.tar', '.gz', '.tgz'].includes(ext)) {
    return /setup|installer|zavorth|release|portable|win|mac|linux|nsis/i.test(lower);
  }
  return false;
}

/** Verify signatures only with a platform-native verifier; file presence is not proof. */
function verifyNativeSignature(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (process.platform === 'win32' && (ext === '.exe' || ext === '.msi')) {
    const escaped = absPath.replace(/'/g, "''");
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
        `$s=Get-AuthenticodeSignature -LiteralPath '${escaped}'; `
        + `if($s.Status -eq 'Valid'){Write-Output $s.SignerCertificate.Subject; exit 0}; `
        + `Write-Error $s.StatusMessage; exit 1`],
      { encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    return {
      verified: result.status === 0,
      verifier: 'Get-AuthenticodeSignature',
      signer: result.status === 0 ? String(result.stdout || '').trim().slice(0, 300) : null,
    };
  }
  if (process.platform === 'darwin' && (ext === '.dmg' || ext === '.pkg')) {
    const command = ext === '.pkg' ? 'pkgutil' : 'codesign';
    const args = ext === '.pkg'
      ? ['--check-signature', absPath]
      : ['--verify', '--deep', '--strict', absPath];
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000 });
    return { verified: result.status === 0, verifier: command, signer: null };
  }
  if (process.platform === 'linux' && ext === '.rpm') {
    const result = spawnSync('rpm', ['--checksig', absPath], { encoding: 'utf8', timeout: 30000 });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    return {
      verified: result.status === 0 && /pgp|rsa|signature.*ok/i.test(output),
      verifier: 'rpm --checksig',
      signer: null,
    };
  }
  return { verified: false, verifier: 'unavailable-on-current-platform', signer: null };
}

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
        // Skip heavy non-release trees
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isInstallerArtifact(entry.name)) continue;
      const st = fs.statSync(full);
      if (st.size > 0) {
        found.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  };
  const st = fs.statSync(abs);
  if (st.isFile() && st.size > 0 && isInstallerArtifact(path.basename(abs))) {
    found.push(rel);
    return found;
  }
  if (st.isDirectory()) walk(abs, 0);
  return found;
}

const missing = structural.filter((rel) => !fs.existsSync(path.join(root, rel)));
const dirsPresent = artifactDirHints.filter((rel) => fs.existsSync(path.join(root, rel)));
const installerArtifacts = artifactDirHints.flatMap((rel) => listReleaseArtifacts(rel));
// Dedupe while preserving order
const installerUnique = [...new Set(installerArtifacts)];
const signatureChecks = installerUnique.map((rel) => ({
  path: rel,
  ...verifyNativeSignature(path.join(root, rel)),
}));
const verifiedUnique = signatureChecks.filter((entry) => entry.verified);
const signedArtifactsVerified = verifiedUnique.length > 0;
/** True until at least one installer signature is cryptographically verified. */
const needsCert = !signedArtifactsVerified;

const report = {
  generatedAt: new Date().toISOString(),
  version: 'ops-signing/v4',
  structuralOk: missing.length === 0,
  /** Directory presence only — NOT proof of signed release. */
  artifactDirsPresent: dirsPresent,
  /** @deprecated alias of artifactDirsPresent for older consumers */
  signedArtifactDirsPresent: dirsPresent.length > 0,
  /** Non-empty installer/package files under known release dirs (presence only). */
  installerArtifactsFound: installerUnique.slice(0, 20),
  /** True only after a native signature verifier succeeds. */
  signedArtifactsVerified,
  signedArtifactsFound: verifiedUnique.map((entry) => entry.path).slice(0, 20),
  signatureChecks: signatureChecks.slice(0, 20),
  /**
   * needsCert: no verified non-empty installer/package files yet.
   * Even when files exist, operator must still verify cert identity / notarization
   * before store language — claimsStoreLaunch stays false.
   */
  needsCert,
  claimsStoreLaunch: false,
  missingStructural: missing,
  summary: {
    artifactDirsPresent: dirsPresent.length > 0,
    signedArtifactsVerified,
    needsCert,
  },
  notes: signedArtifactsVerified ? 'At least one installer signature passed a native cryptographic verifier; store publication still requires operator review.'
    : dirsPresent.length ? 'Release outputs may exist, but no installer signature was cryptographically verified on this platform. needsCert=true.'
      : 'Packaging scripts OK; signed store assets remain OPS-ONLY. needsCert=true.',
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

  console.log('[ops-signing] artifactDirsPresent (dirs only — not signed evidence)');
  if (dirsPresent.length === 0) {
    console.log('  none present — expected until ops produces installers');
  } else {
    for (const rel of dirsPresent) console.log(`  dir present ${rel}`);
  }

  console.log('[ops-signing] installer artifacts (presence only)');
  for (const rel of installerUnique.slice(0, 10)) console.log(`  file ${rel}`);
  console.log('[ops-signing] signedArtifactsVerified (native cryptographic verification)');
  if (!signedArtifactsVerified) {
    console.log('  none — directory presence alone is not signed evidence');
  } else {
    for (const entry of verifiedUnique.slice(0, 10)) {
      console.log(`  verified ${entry.path} via ${entry.verifier}`);
    }
  }

  console.log(`[ops-signing] needsCert=${needsCert ? 'yes' : 'no (signature verified; still review store publication)'}`);
  console.log('[ops-signing] claimsStoreLaunch=false');

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
