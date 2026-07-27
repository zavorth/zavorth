#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'config', 'third-party-sources.json');
const lockPath = path.join(projectRoot, 'data', 'vendor-lock.json');
const historyPath = path.join(projectRoot, 'data', 'vendor-history', 'history.json');
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const statusPath = path.join(runtimeDir, 'vendor-toolkit-status.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePath(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

function gitHead(repoPath) {
  if (!repoPath || !fs.existsSync(repoPath)) {
    return null;
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) {
    return null;
  }
  return String(result.stdout || '').trim() || null;
}

function collectSources() {
  const manifest = readJson(manifestPath, { sources: [] });
  const lock = readJson(lockPath, { sources: [] });
  const byId = new Map();

  for (const entry of lock.sources || []) {
    const id = normalizeId(entry.id);
    if (!id) {
      continue;
    }
    byId.set(id, { ...entry, id });
  }

  for (const entry of manifest.sources || []) {
    const id = normalizeId(entry.id);
    if (!id) {
      continue;
    }
    byId.set(id, { ...(byId.get(id) || {}), ...entry, id });
  }

  return Array.from(byId.values());
}

function buildStatus() {
  const sources = collectSources();
  const entries = sources.map((entry) => {
    const resolvedSource = normalizePath(entry.localSource || entry.resolvedSource);
    const worktreeDir = normalizePath(entry.worktreeDir);
    const mirrorDir = normalizePath(entry.mirrorDir);
    const sourceHead = gitHead(resolvedSource) || gitHead(mirrorDir);
    const worktreeHead = gitHead(worktreeDir);
    const lockedCommit = String(entry.lockedCommit || '').trim() || null;
    const updateAvailable = Boolean(sourceHead && lockedCommit && sourceHead !== lockedCommit);
    const worktreeDrift = Boolean(worktreeHead && lockedCommit && worktreeHead !== lockedCommit);

    return {
      id: normalizeId(entry.id),
      displayName: String(entry.displayName || entry.id || '').trim(),
      license: String(entry.license || 'unknown').trim(),
      integrationMode: String(entry.integrationMode || 'unknown').trim(),
      upstream: String(entry.upstream || '').trim() || null,
      resolvedSource,
      mirrorDir,
      worktreeDir,
      lockedCommit,
      sourceHead,
      worktreeHead,
      updateAvailable,
      worktreeDrift,
      status: updateAvailable ? 'update_available' : worktreeDrift ? 'worktree_drift' : 'locked',
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    summary: {
      total: entries.length,
      updatesAvailable: entries.filter((entry) => entry.updateAvailable).length,
      worktreeDrift: entries.filter((entry) => entry.worktreeDrift).length,
      missingSources: entries.filter((entry) => !entry.sourceHead && !entry.worktreeHead).length,
    },
    entries,
  };
}

function printStatus(snapshot) {
  console.log('Zavorth Vendor Toolkit');
  console.log(`status: ${snapshot.summary.updatesAvailable > 0 ? 'attention' : 'ready'}`);
  console.log(`vendors: ${snapshot.summary.total}`);
  console.log(`updates: ${snapshot.summary.updatesAvailable}`);
  console.log(`worktree drift: ${snapshot.summary.worktreeDrift}`);
  for (const entry of snapshot.entries) {
    console.log(`- ${entry.displayName || entry.id}: ${entry.status}`);
    console.log(`  locked: ${entry.lockedCommit || 'n/d'}`);
    console.log(`  source: ${entry.sourceHead || 'n/d'}`);
    console.log(`  worktree: ${entry.worktreeHead || 'n/d'}`);
  }
}

function writeStatus(snapshot) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify(snapshot, null, 2), 'utf8');
}

function runStatus(asJson) {
  const snapshot = buildStatus();
  writeStatus(snapshot);
  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  printStatus(snapshot);
  console.log(`report: ${statusPath}`);
}

function runUpdate(asJson, dryRun) {
  const snapshot = buildStatus();
  const updates = snapshot.entries.filter((entry) => entry.updateAvailable);
  const result = {
    generatedAt: new Date().toISOString(),
    dryRun,
    ok: true,
    updates: updates.map((entry) => ({
      id: entry.id,
      from: entry.lockedCommit,
      to: entry.sourceHead,
      action: dryRun ? 'preview' : 'manual-review-required',
    })),
    message: updates.length === 0
      ? 'No vendor update is pending.'
      : 'Automatic updates remain blocked in this lightweight toolkit; review the vendor diff before applying changes.',
  };
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(result.message);
  for (const update of result.updates) {
    console.log(`- ${update.id}: ${update.from || 'n/d'} -> ${update.to || 'n/d'} (${update.action})`);
  }
}

function runRollback(asJson, dryRun) {
  const history = readJson(historyPath, { entries: [] });
  const lastRollbackSource = [...(history.entries || [])]
    .reverse()
    .find((entry) => entry.type === 'update' || entry.restoredLock);
  const result = {
    generatedAt: new Date().toISOString(),
    dryRun,
    ok: true,
    available: Boolean(lastRollbackSource),
    message: lastRollbackSource ? 'Rollback preview available in history; apply the lock manually after review.'
      : 'No update/rollback history found to restore.',
  };
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(result.message);
}

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) || 'status';
const asJson = args.includes('--json');
const dryRun = args.includes('--dry-run');

if (command === 'status') {
  runStatus(asJson);
} else if (command === 'update') {
  runUpdate(asJson, dryRun);
} else if (command === 'rollback') {
  runRollback(asJson, dryRun);
} else {
  console.error(`Uso: node scripts/vendor-toolkit.mjs status|update|rollback [--json] [--dry-run]`);
  process.exitCode = 1;
}
