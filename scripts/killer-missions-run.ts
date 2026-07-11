import { KillerMissionCatalogService, type KillerAudience } from '../src/services/KillerMissionCatalogService.js';

function main(): void {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const audienceArg = process.argv.find((arg) => arg.startsWith('--audience='));
  const audience = audienceArg
    ? audienceArg.split('=')[1] as KillerAudience
    : null;
  const service = new KillerMissionCatalogService();
  const missions = service.list(audience);

  if (asCheck) {
    const ok = missions.length >= 3
      && missions.every((mission) => mission.mutatesFiles === false && mission.prompt.length > 20);
    const payload = { ok, count: missions.length, ids: missions.map((mission) => mission.id) };
    process.stdout.write(asJson ? `${JSON.stringify(payload, null, 2)}\n` : `killer missions check: ${ok ? 'pass' : 'fail'} (${missions.length})\n`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ missions }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${service.renderText(audience)}\n`);
}

main();
