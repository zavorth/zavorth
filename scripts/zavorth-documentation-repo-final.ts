import { ZavorthDocumentationRepoFinalService } from '../src/services/ZavorthDocumentationRepoFinalService.js';

function main() {
  const asJson = process.argv.includes('--json');
  const requirePass = process.argv.includes('--require-pass');
  const service = new ZavorthDocumentationRepoFinalService();
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

main();
