#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import type { ZavorthTrajectoryExportFormat } from '../src/contracts/ZavorthTrajectoryExportContract.js';
import { ZavorthTrajectoryCaptureService } from '../src/services/ZavorthTrajectoryCaptureService.js';
import { ZavorthBatchRunnerService } from '../src/services/ZavorthBatchRunnerService.js';

function readFlag(argv: string[], names: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    for (const name of names) {
      if (token === name) {
        return String(argv[index + 1] || '').trim() || null;
      }
      if (token.startsWith(`${name}=`)) {
        return String(token.slice(name.length + 1) || '').trim() || null;
      }
    }
  }
  return null;
}

function normalizeFormat(value: string | null): ZavorthTrajectoryExportFormat {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sharegpt') return 'sharegpt';
  if (normalized === 'alpaca') return 'alpaca';
  return 'jsonl';
}

async function main() {
  const argv = process.argv.slice(2);
  const showStats = argv.includes('--stats');
  const asJson = argv.includes('--json');
  const format = normalizeFormat(readFlag(argv, ['--format']));
  const exportPath = readFlag(argv, ['--export-path']);
  const approvalId = readFlag(argv, ['--approval-id']);
  const batchFile = readFlag(argv, ['--batch']);

  const originalLog = console.log;
  if (asJson) {
    console.log = () => undefined;
    console.info = () => undefined;
  }

  const captureService = new ZavorthTrajectoryCaptureService();

  if (batchFile) {
    const resolvedBatchPath = path.resolve(batchFile);
    if (!fs.existsSync(resolvedBatchPath)) {
      console.error(`[zavorth-trajectory] batch file not found: ${resolvedBatchPath}`);
      process.exitCode = 1;
      return;
    }
    const raw = fs.readFileSync(resolvedBatchPath, 'utf8');
    const prompts = raw.split(/\r...\n/u).map((line) => line.trim()).filter(Boolean);
    if (prompts.length === 0) {
      console.error('[zavorth-trajectory] batch file is empty.');
      process.exitCode = 1;
      return;
    }

    const batchRunner = new ZavorthBatchRunnerService();
    const concurrency = Number(readFlag(argv, ['--concurrency'])) || 4;
    const batchResult = await batchRunner.runBatch(prompts, {
      concurrency,
      format,
      approvalId: approvalId || undefined,
      outputPath: exportPath || undefined,
    });

    if (asJson) {
      console.log = originalLog;
      process.stdout.write(`${JSON.stringify(batchResult, null, 2)}\n`);
      return;
    }

    console.log(`[zavorth-trajectory] batch run completed: ${batchResult.runId}`);
    console.log(`[zavorth-trajectory] items: ${batchResult.summary.total} | completed: ${batchResult.summary.completed} | failed: ${batchResult.summary.failed}`);
    console.log(`[zavorth-trajectory] avg duration: ${batchResult.summary.avgDurationMs}ms | total: ${batchResult.totalDurationMs}ms`);
    printStats(batchResult.trajectory.stats, originalLog);
    return;
  }

  if (showStats) {
    const stats = captureService.getStats();
    if (asJson) {
      console.log = originalLog;
      process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
      return;
    }
    printStats(stats, originalLog);
    return;
  }

  if (exportPath) {
    if (!approvalId) {
      console.error('[zavorth-trajectory] --approval-id is required when using --export-path.');
      process.exitCode = 1;
      return;
    }
    const snapshot = captureService.exportToFile(exportPath, format, approvalId);
    if (asJson) {
      console.log = originalLog;
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      return;
    }
    console.log(`[zavorth-trajectory] exported ${snapshot.turns.length} turn(s) to ${snapshot.outputPath}`);
    printStats(snapshot.stats, originalLog);
    return;
  }

  const snapshot = captureService.buildSnapshot(format);
  if (asJson) {
    console.log = originalLog;
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }
  console.log(`[zavorth-trajectory] capture snapshot: ${snapshot.turns.length} turn(s)`);
  printStats(snapshot.stats, originalLog);
}

function printStats(stats: ReturnType<ZavorthTrajectoryCaptureService['getStats']>, log: typeof console.log) {
  log(`[zavorth-trajectory] total turns: ${stats.totalTurns}`);
  log(`[zavorth-trajectory] reasoning coverage: ${Math.round(stats.reasoningCoverage * 100)}%`);
  log(`[zavorth-trajectory] avg tools/turn: ${stats.avgToolsPerTurn}`);
  log(`[zavorth-trajectory] approval rate: ${Math.round(stats.approvalRate * 100)}%`);
  if (stats.toolStats.length > 0) {
    log('[zavorth-trajectory] tool stats:');
    for (const tool of stats.toolStats.slice(0, 10)) {
      log(`  - ${tool.toolName}: ${tool.count} calls | success=${tool.success} failure=${tool.failure} avg=${tool.avgDurationMs}ms`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-trajectory] fatal error.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
