import { ZavorthPost291LiveCanarySwarmService } from '../src/services/ZavorthPost291LiveCanarySwarmService.js';
import type {
  ZavorthPost291CertificationSwarmStatus,
} from '../src/contracts/ZavorthPost291CertificationSwarmContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  certificationSwarmStatus: ZavorthPost291CertificationSwarmStatus | null;
};

const CERTIFICATION_SWARM_STATUSES = new Set<ZavorthPost291CertificationSwarmStatus>([
  'certification-swarm-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    certificationSwarmStatus: null,
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
    if (arg === '--certification-swarm-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!CERTIFICATION_SWARM_STATUSES.has(value as ZavorthPost291CertificationSwarmStatus)) {
        throw new Error(`Invalid --certification-swarm-status value: ${value}`);
      }
      options.certificationSwarmStatus = value as ZavorthPost291CertificationSwarmStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthPost291LiveCanarySwarmService();
  const snapshot = service.buildSnapshot({
    certificationSwarmStatus: options.certificationSwarmStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'live-canary-swarm-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-post291-live-canary-swarm] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
