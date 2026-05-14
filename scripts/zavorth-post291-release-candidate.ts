import { ZavorthPost291ReleaseCandidateService } from '../src/services/ZavorthPost291ReleaseCandidateService.js';
import type {
  ZavorthPost291LiveCanarySwarmStatus,
} from '../src/contracts/ZavorthPost291LiveCanarySwarmContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  liveCanarySwarmStatus: ZavorthPost291LiveCanarySwarmStatus | null;
};

const LIVE_CANARY_SWARM_STATUSES = new Set<ZavorthPost291LiveCanarySwarmStatus>([
  'live-canary-swarm-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    liveCanarySwarmStatus: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
      continue;
    }
    if (arg === '--live-canary-swarm-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!LIVE_CANARY_SWARM_STATUSES.has(value as ZavorthPost291LiveCanarySwarmStatus)) {
        throw new Error(`Invalid --live-canary-swarm-status value: ${value}`);
      }
      options.liveCanarySwarmStatus = value as ZavorthPost291LiveCanarySwarmStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthPost291ReleaseCandidateService();
  const snapshot = service.buildSnapshot({
    liveCanarySwarmStatus: options.liveCanarySwarmStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'release-candidate-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-post291-release-candidate] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
