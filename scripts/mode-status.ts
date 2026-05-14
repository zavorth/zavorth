import { CapabilityLifecycleService } from '../src/services/CapabilityLifecycleService.js';

async function main(): Promise<void> {
  const jsonOutput = process.argv.slice(2).includes('--json');
  const lifecycle = new CapabilityLifecycleService();
  const snapshot = lifecycle.buildProductModeSnapshot();
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: true, productMode: snapshot }, null, 2));
    return;
  }

  console.log(
    [
      `[mode-status] ${snapshot.label}`,
      `[mode-status] id=${snapshot.id}`,
      `[mode-status] profile=${snapshot.runtimeProfile} (baseline ${snapshot.defaultRuntimeProfile})`,
      `[mode-status] summary=${snapshot.summary}`,
      `[mode-status] visible=${snapshot.visibleSurfaces.join(', ') || 'chat'}`,
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(`[mode-status] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
