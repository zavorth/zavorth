import { ZavorthCodeDailyLoopService } from '../src/services/ZavorthCodeDailyLoopService.js';

function main(): void {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const service = new ZavorthCodeDailyLoopService({ projectRoot: process.cwd() });
  const snapshot = service.buildSnapshot();

  if (asCheck) {
    const ok = snapshot.alignsWithDailyPe
      && snapshot.happyPath.steps.length === 4
      && snapshot.happyPath.steps.every((step) => step.id && step.label);
    const payload = {
      ok,
      chatReady: snapshot.chatReady,
      providerReady: snapshot.providerReady,
      steps: snapshot.happyPath.steps.map((step) => step.id),
    };
    process.stdout.write(
      asJson ? `${JSON.stringify(payload, null, 2)}\n`
        : `code daily loop check: ${ok ? 'pass' : 'fail'}\n`,
    );
    process.exitCode = ok ? 0 : 1;
    return;
  }

  process.stdout.write(
    asJson ? `${JSON.stringify(snapshot, null, 2)}\n`
      : `${service.renderText(snapshot)}\n`,
  );
}

main();
