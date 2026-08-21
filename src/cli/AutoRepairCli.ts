import { logger } from '../logger.js';
import { AutoRepairService, type AutoRepairGoal } from '../services/AutoRepairService.js';

export type AutoRepairCliFlags = {
  dryRun: boolean;
  force: boolean;
  goal: AutoRepairGoal;
  reason: string;
  requestedBy: string;
  json: boolean;
};

export function parseAutoRepairCliFlags(argv: string[]): AutoRepairCliFlags {
  const flags: AutoRepairCliFlags = {
    dryRun: false,
    force: false,
    goal: 'auto',
    reason: 'Auto-repair triggered via CLI.',
    requestedBy: process.env.USERNAME || process.env.USER || 'cli',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (!token) {
      continue;
    }

    if (token === '--dry-run' || token === '--dryrun') {
      flags.dryRun = true;
      continue;
    }

    if (token === '--force') {
      flags.force = true;
      continue;
    }

    if (token === '--improve') {
      flags.goal = 'improve';
      continue;
    }

    if (token === '--repair') {
      flags.goal = 'repair';
      continue;
    }

    if (token === '--json') {
      flags.json = true;
      continue;
    }

    if (token === '--reason' && argv[index + 1]) {
      flags.reason = String(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === '--requested-by' && argv[index + 1]) {
      flags.requestedBy = String(argv[index + 1]);
      index += 1;
    }
  }

  return flags;
}

export async function runAutoRepairCli(argv: string[]): Promise<number> {
  const flags = parseAutoRepairCliFlags(argv);
  const autoRepair = new AutoRepairService();
  const result = await autoRepair.run({
    reason: flags.reason,
    requestedBy: flags.requestedBy,
    dryRun: flags.dryRun,
    force: flags.force,
    goal: flags.goal,
  });

  logger.info(result.summary);
  if (flags.json) {
    logger.info(JSON.stringify(result.report, null, 2));
  }

  return result.success ? 0 : 1;
}
