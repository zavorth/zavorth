import { ZavorthRuntimeStabilityControlPlaneService } from '../src/services/ZavorthRuntimeStabilityControlPlaneService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const deepDoctor = argv.includes('--deep') || argv.includes('--refresh');
  const requirePass = argv.includes('--require-pass');
  const service = new ZavorthRuntimeStabilityControlPlaneService();
  const snapshot = service.buildSnapshot({ deepDoctor });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[runtime-stability] leitura consolidada da fleet e dos transports');
    console.log(service.renderReport({ deepDoctor }));
  }

  if (snapshot.gate.status === 'failed' || (requirePass && snapshot.gate.status !== 'passed')) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[runtime-stability] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
