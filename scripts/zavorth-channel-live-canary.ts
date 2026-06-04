import { ZavorthChannelLiveCanaryService } from '../src/services/ZavorthChannelLiveCanaryService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');

const service = new ZavorthChannelLiveCanaryService();
const snapshot = service.buildSnapshot();

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderText(snapshot)}\n`);
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
} else if (requirePass && snapshot.status !== 'ready') {
  process.exitCode = 2;
}
