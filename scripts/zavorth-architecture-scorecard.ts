import { ArchitectureRefactorScorecardService } from '../src/observability/ArchitectureRefactorScorecardService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const requirePass = argv.includes('--require-pass');
  const service = new ArchitectureRefactorScorecardService();
  const snapshot = service.buildSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    console.log('[architecture] baseline e scorecard da refatoracao incremental');
    console.log(service.renderReport());
  }

  if (snapshot.gate.status === 'failed' || (requirePass && !snapshot.gate.canProceed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[architecture] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
