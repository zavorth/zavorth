#!/usr/bin/env node
/**
 * Copy existing non-empty installer files into dist-release/.
 * Never invents signed assets. Never treats empty dirs as "signed".
 *
 *   node scripts/collect-release-artifacts.mjs
 *   node scripts/collect-release-artifacts.mjs --json
 *   node scripts/collect-release-artifacts.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const dryRun = process.argv.includes('--dry-run');

const DEST_DIR = path.join(root, 'dist-release');

/** Search roots for electron-builder / desktop packaging outputs. */
const SEARCH_DIRS = [
  'apps/zavorth-desktop/release',
  'apps/zavorth-desktop/dist-electron',
  'apps/zavorth-desktop/out',
  'apps/zavorth-desktop/dist',
  'release-assets',
  'out/make',
  'release',
  // do not search bare dist/ broadly — too many false positives; keep desktop-scoped first
];

/** Only these installer-like extensions are collected. */
const INSTALLER_EXT = new Set([
  '.exe',
  '.msi',
  '.dmg',
  '.pkg',
  '.appimage',
  '.deb',
  '.rpm',
]);

function isInstallerFile(name) {
  const lower = name.toLowerCase();
  const ext = path.extname(lower);
  if (INSTALLER_EXT.has(ext)) return true;
  // electron-builder sometimes emits name.AppImage with mixed case
  if (lower.endsWith('.appimage')) return true;
  return false;
}

function walkFiles(absDir, maxDepth = 4, acc = []) {
  if (maxDepth < 0 || acc.length >= 50) return acc;
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, maxDepth - 1, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isInstallerFile(entry.name)) continue;
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.size <= 0) continue; // never collect empty placeholders
    acc.push({
      abs: full,
      rel: path.relative(root, full).replace(/\\/g, '/'),
      size: st.size,
      name: entry.name,
    });
  }
  return acc;
}

const found = [];
const scannedPresent = [];
for (const rel of SEARCH_DIRS) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  scannedPresent.push(rel);
  walkFiles(abs, 4, found);
}

// Dedupe by basename preferring first (desktop release first in SEARCH_DIRS)
const byName = new Map();
for (const f of found) {
  if (!byName.has(f.name)) byName.set(f.name, f);
}
const unique = [...byName.values()];

const copied = [];
const skipped = [];

if (unique.length === 0) {
  const report = {
    generatedAt: new Date().toISOString(),
    version: 'collect-release-artifacts/v1',
    ok: false,
    dryRun,
    scannedDirsPresent: scannedPresent,
    found: [],
    copied: [],
    destDir: path.relative(root, DEST_DIR).replace(/\\/g, '/'),
    notes:
      'No non-empty .exe/.dmg/.AppImage (etc.) installers found under desktop build outs. '
      + 'Did not create empty dist-release as signed evidence.',
  };
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log('[collect-release] no non-empty installers found');
    console.log(`[collect-release] scanned present dirs: ${scannedPresent.join(', ') || '(none)'}`);
    console.log('[collect-release] not creating empty dist-release as "signed"');
  }
  process.exit(2);
}

if (!dryRun) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

for (const f of unique) {
  const dest = path.join(DEST_DIR, f.name);
  if (dryRun) {
    copied.push({
      from: f.rel,
      to: path.relative(root, dest).replace(/\\/g, '/'),
      size: f.size,
      dryRun: true,
    });
    continue;
  }
  try {
    // Skip overwrite if identical size already present
    if (fs.existsSync(dest)) {
      const existing = fs.statSync(dest);
      if (existing.size === f.size && existing.size > 0) {
        skipped.push({ from: f.rel, to: path.relative(root, dest).replace(/\\/g, '/'), reason: 'already-present' });
        continue;
      }
    }
    fs.copyFileSync(f.abs, dest);
    copied.push({
      from: f.rel,
      to: path.relative(root, dest).replace(/\\/g, '/'),
      size: f.size,
    });
  } catch (err) {
    skipped.push({
      from: f.rel,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  version: 'collect-release-artifacts/v1',
  ok: copied.length > 0 || skipped.some((s) => s.reason === 'already-present'),
  dryRun,
  scannedDirsPresent: scannedPresent,
  found: unique.map((f) => ({ path: f.rel, size: f.size })),
  copied,
  skipped,
  destDir: path.relative(root, DEST_DIR).replace(/\\/g, '/'),
  notes: dryRun ? 'Dry-run only — no files copied. Installers present under desktop outs.'
    : copied.length ? `Copied ${copied.length} installer(s) into dist-release/. Still not store-signed until cert verified.`
      : 'Sources found but nothing new copied (may already be present).',
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('[collect-release] installer collection');
  console.log(`  scanned: ${scannedPresent.join(', ') || '(none)'}`);
  console.log(`  found: ${unique.length}`);
  for (const f of unique) {
    console.log(`    ${f.rel} (${f.size} bytes)`);
  }
  if (dryRun) {
    console.log('  dry-run: would copy to dist-release/');
  } else {
    for (const c of copied) console.log(`  copied ${c.from} -> ${c.to}`);
    for (const s of skipped) console.log(`  skip ${s.from}: ${s.reason}`);
  }
  console.log(`[collect-release] ${report.notes}`);
}

process.exit(report.ok ? 0 : 1);
