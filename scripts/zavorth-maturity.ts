import { ZavorthMaturityService } from '../src/services/ZavorthMaturityService.js';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const requirePass = args.has('--require-pass');
const requireMature = args.has('--require-mature');

const service = new ZavorthMaturityService();
const snapshot = service.buildSnapshot();

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderReport(snapshot)}\n`);
}

if (requireMature && snapshot.status !== 'mature') {
  process.stderr.write(`Zavorth maturity requires attention: ${snapshot.status}.\n`);
  process.exitCode = 1;
} else if (requirePass && !snapshot.summary.dailyUseReady) {
  process.stderr.write(`Zavorth maturity blocked: ${snapshot.summary.blocked} gate(s).\n`);
  process.exitCode = 1;
}
