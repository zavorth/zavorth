import { ZavorthHostLiveCertificationService } from '../src/services/ZavorthHostLiveCertificationService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requireLive = args.includes('--require-live');
const selectedArg = args.find((arg) => arg.startsWith('--channel='));
const selectedId = selectedArg ? selectedArg.split('=').slice(1).join('=') : null;

const service = new ZavorthHostLiveCertificationService();
const snapshot = service.buildSnapshot({ selectedId });

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderReport(snapshot)}\n`);
}

if (requireLive && !snapshot.summary.productionLiveCertified) {
  process.stderr.write('Zavorth host live certification has no production-live channel receipt on this host.\n');
  process.exitCode = 1;
}
