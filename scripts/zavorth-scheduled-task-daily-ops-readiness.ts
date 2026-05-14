#!/usr/bin/env tsx
import { Database } from '../src/storage/Database.js';
import { SchedulerRepository } from '../src/storage/SchedulerRepository.js';
import { SchedulerService } from '../src/services/SchedulerService.js';
import { ZavorthScheduledTaskDailyOpsReadinessService } from '../src/services/ZavorthScheduledTaskDailyOpsReadinessService.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scheduler = args.task
    ? new SchedulerService(new SchedulerRepository(await Database.getInstance()))
    : null;
  const service = new ZavorthScheduledTaskDailyOpsReadinessService({
    schedulerService: scheduler,
    now: () => new Date(args.now || new Date().toISOString()),
  });
  const snapshot = await service.buildSnapshot({
    taskId: args.task,
    includeHostTask: Boolean(args.task),
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
    task: '',
    now: '',
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--task=')) args.task = arg.slice('--task='.length).trim();
    else if (arg.startsWith('--now=')) args.now = arg.slice('--now='.length);
  }
  return args;
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
