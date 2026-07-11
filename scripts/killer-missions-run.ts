import { KillerMissionCatalogService, type KillerAudience } from '../src/services/KillerMissionCatalogService.js';
import { KillerMissionExecuteService } from '../src/services/KillerMissionExecuteService.js';

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const execute = process.argv.includes('--execute');
  const live = process.argv.includes('--live')
    || process.env.ZAVORTH_KILLER_LIVE === '1'
    || process.env.ZAVORTH_KILLER_LIVE === 'true';
  const audienceArg = process.argv.find((arg) => arg.startsWith('--audience='));
  const missionArg = process.argv.find((arg) => arg.startsWith('--mission='));
  const audience = audienceArg
    ? audienceArg.split('=')[1] as KillerAudience
    : null;
  const missionId = missionArg ? missionArg.split('=')[1] : null;
  const catalog = new KillerMissionCatalogService();
  const missions = catalog.list(audience);

  if (asCheck) {
    const ok = missions.length >= 3
      && missions.every((mission) => mission.mutatesFiles === false && mission.prompt.length > 20);
    const payload = { ok, count: missions.length, ids: missions.map((mission) => mission.id) };
    process.stdout.write(asJson ? `${JSON.stringify(payload, null, 2)}\n` : `killer missions check: ${ok ? 'pass' : 'fail'} (${missions.length})\n`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (execute) {
    if (missionId) {
      const match = catalog.list(audience).find((mission) => mission.id === missionId);
      if (!match) {
        process.stderr.write(`killer mission not found: ${missionId}\n`);
        process.exitCode = 1;
        return;
      }
    }
    const report = await new KillerMissionExecuteService({
      projectRoot: process.cwd(),
      env: process.env,
    }).run({ live, audience, missionId });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${new KillerMissionExecuteService().renderText(report)}\n`);
    }
    // Live certification must fail closed when nothing executed or any mission failed/blocked.
    if (live && (!report.ok || report.executed === 0)) {
      process.exitCode = 1;
    }
    return;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ missions }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${catalog.renderText(audience)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
