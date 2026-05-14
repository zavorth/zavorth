import { ZavorthQaSecurityReleaseCertificationPackService } from '../src/services/ZavorthQaSecurityReleaseCertificationPackService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthQaSecurityReleaseCertificationPackService();
  const snapshot = service.buildSnapshot();

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}
