import path from 'path';
import { DatabaseBackupJob } from '../ops/backups/DatabaseBackupJob.js';
import { config } from '../src/config/index.js';

function parseRetentionDays(argv: string[]): number | null {
  const index = argv.findIndex((entry) => entry === '--prune-days');
  if (index < 0) {
    return null;
  }
  const parsed = Number.parseInt(String(argv[index + 1] || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRetentionCount(argv: string[]): number | null {
  const index = argv.findIndex((entry) => entry === '--prune-count');
  if (index < 0) {
    return null;
  }
  const parsed = Number.parseInt(String(argv[index + 1] || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const pruneDays = parseRetentionDays(argv) ?? config.backupRetentionDays;
  const pruneCount = parseRetentionCount(argv) ?? config.backupRetentionCount;
  const backupRoot = path.resolve(config.projectRoot, 'data', 'backups');
  const job = new DatabaseBackupJob({ backupRoot });
  const snapshot = job.createSnapshot();
  const pruned = job.cleanOldBackups(pruneDays, pruneCount);

  const payload = {
    ok: true,
    snapshotId: snapshot.snapshotId,
    createdAt: snapshot.createdAt,
    snapshotDir: snapshot.snapshotDir,
    manifestPath: path.join(snapshot.snapshotDir, 'manifest.json'),
    pruned,
    targets: snapshot.targets,
  };

  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  console.log('[ops-backup] snapshot created');
  console.log(`[ops-backup] snapshotId: ${snapshot.snapshotId}`);
  console.log(`[ops-backup] snapshotDir: ${snapshot.snapshotDir}`);
  console.log(`[ops-backup] targets: ${snapshot.targets.filter((entry) => entry.exists).length}/${snapshot.targets.length}`);
  console.log(`[ops-backup] pruned: ${pruned} (window ${pruneDays} dia(s), max ${pruneCount} snapshot(s))`);
}

main().catch((error) => {
  console.error('[ops-backup] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
