#!/usr/bin/env tsx
import { Database } from '../src/storage/Database.js';
import { SchedulerRepository } from '../src/storage/SchedulerRepository.js';
import { SchedulerService } from '../src/services/SchedulerService.js';
import { ZavorthScheduledTaskLiveTickCertificationService } from '../src/services/ZavorthScheduledTaskLiveTickCertificationService.js';
import type { ZavorthScheduledTaskLiveTickScenarioId } from '../src/contracts/ZavorthScheduledTaskLiveTickCertificationContract.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scheduler = args.task
    ? new SchedulerService(new SchedulerRepository(await Database.getInstance()))
    : null;
  const service = new ZavorthScheduledTaskLiveTickCertificationService({
    schedulerService: scheduler,
    now: () => new Date(args.now || new Date().toISOString()),
  });
  const snapshot = await service.buildSnapshot({
    scenario: args.scenario,
    taskId: args.task,
    dryRun: args.dryRun,
    applyAutoPause: args.applyAutoPause,
    now: args.now,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(service.renderReport(snapshot));
}

function parseArgs(argv: string[]) {
  const args = {
    json: false,
    dryRun: false,
    applyAutoPause: true,
    task: '',
    scenario: 'all' as ZavorthScheduledTaskLiveTickScenarioId | 'all',
    now: '',
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-auto-pause') args.applyAutoPause = false;
    else if (arg.startsWith('--task=')) {
      args.task = arg.slice('--task='.length).trim();
      args.scenario = 'host_task';
    } else if (arg.startsWith('--scenario=')) {
      args.scenario = normalizeScenario(arg.slice('--scenario='.length));
    } else if (arg.startsWith('--now=')) {
      args.now = arg.slice('--now='.length);
    }
  }
  return args;
}

function normalizeScenario(value: string): ZavorthScheduledTaskLiveTickScenarioId | 'all' {
  const normalized = String(value || '').trim();
  const allowed = new Set<ZavorthScheduledTaskLiveTickScenarioId | 'all'>([
    'all',
    'valid_gateway_submit',
    'expired_approval_block',
    'scope_drift_block',
    'legacy_task_block',
    'failure_auto_pause_block',
    'host_task',
  ]);
  return allowed.has(normalized as ZavorthScheduledTaskLiveTickScenarioId | 'all')
    ? normalized as ZavorthScheduledTaskLiveTickScenarioId | 'all'
    : 'all';
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
