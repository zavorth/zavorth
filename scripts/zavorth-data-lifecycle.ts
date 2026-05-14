import { ZavorthDataLifecyclePolicyService } from '../src/services/ZavorthDataLifecyclePolicyService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const datasetArg = args.find((arg) => arg.startsWith('--class=') || arg.startsWith('--dataset='));
const datasetId = datasetArg ? datasetArg.split('=').slice(1).join('=') : null;

const service = new ZavorthDataLifecyclePolicyService();
const snapshot = service.buildSnapshot({ datasetId });

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderReport(snapshot)}\n`);
}

if (requirePass && !snapshot.summary.releaseReady) {
  process.stderr.write(`Zavorth data lifecycle blocked: ${snapshot.issues.length} issue(s).\n`);
  process.exitCode = 1;
}
