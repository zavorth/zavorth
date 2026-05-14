import { ZavorthExternalRuntimeBridgeService } from '../src/services/ZavorthExternalRuntimeBridgeService.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  naturalFirstPackStatus: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    naturalFirstPackStatus: null,
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
    if (arg === '--natural-first-status') {
      options.naturalFirstPackStatus = String(argv[index + 1] || '').trim();
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthExternalRuntimeBridgeService();
  const snapshot = service.buildSnapshot({
    naturalFirstPackStatus: options.naturalFirstPackStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'bridge-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-external-runtime-bridge] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
