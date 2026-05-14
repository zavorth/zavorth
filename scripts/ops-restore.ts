import path from 'path';
import { DatabaseRestoreJob } from '../ops/backups/DatabaseRestoreJob.js';
import { config } from '../src/config/index.js';

function normalizeCliValue(input: string): string {
  return String(input || '')
    .trim()
    .replace(/^\^+|\^+$/g, '')
    .replace(/^"+|"+$/g, '')
    .replace(/\^/g, '');
}

function parseSnapshot(argv: string[]): string {
  const inline = argv.find((entry) => String(entry || '').trim().startsWith('--manifest='));
  if (inline) {
    const value = normalizeCliValue(String(inline).split('=').slice(1).join('='));
    if (value) {
      return path.resolve(value);
    }
  }
  const index = argv.findIndex((entry) => entry === '--manifest');
  if (index >= 0) {
    const value = normalizeCliValue(String(argv[index + 1] || ''));
    if (value) {
      return path.resolve(value);
    }
  }
  throw new Error('Informe --manifest <path/to/manifest.json>.');
}

async function main() {
  const argv = process.argv.slice(2);
  const manifestPath = parseSnapshot(argv);
  const asJson = argv.includes('--json');
  const dryRun = argv.includes('--dry-run');

  const job = new DatabaseRestoreJob({
    sourceRoot: config.projectRoot,
  });
  const manifest = job.restoreSnapshot(manifestPath, { dryRun });
  const payload = {
    ok: true,
    dryRun,
    snapshotId: manifest.snapshotId,
    snapshotDir: manifest.snapshotDir,
    restoredTargets: manifest.targets.filter((entry) => entry.exists).map((entry) => entry.relativePath),
  };

  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  console.log(`[ops-restore] ${dryRun ? 'dry-run' : 'restore'} concluido`);
  console.log(`[ops-restore] snapshotId: ${manifest.snapshotId}`);
  console.log(`[ops-restore] snapshotDir: ${manifest.snapshotDir}`);
  console.log(`[ops-restore] restored: ${payload.restoredTargets.length}`);
}

main().catch((error) => {
  console.error('[ops-restore] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
