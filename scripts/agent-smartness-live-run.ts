import path from 'node:path';
import { AgentSmartnessLiveService } from '../src/services/agent-smartness/AgentSmartnessLiveService.js';

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const live = process.argv.includes('--live')
    || process.env.ZAVORTH_LIVE_SMARTNESS === '1'
    || process.env.ZAVORTH_LIVE_SMARTNESS === 'true';
  const allowBlocked = process.argv.includes('--allow-blocked');

  const report = await new AgentSmartnessLiveService({
    projectRoot: process.cwd(),
    env: process.env,
  }).run({ live });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${new AgentSmartnessLiveService().renderText(report)}\n`);
  }

  if (!asCheck) return;
  if (!report.ok) {
    process.exitCode = 1;
    return;
  }
  if (live && report.blockedOnly && !allowBlocked) {
    process.stderr.write('Live smartness requested but all live cells are blocked (missing credentials).\n');
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
