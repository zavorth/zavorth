import { ZavorthExternalCapabilityInventoryService } from '../src/services/ZavorthExternalCapabilityInventoryService.js';
import type { ZavorthExternalRuntimeBridgeStatus } from '../src/contracts/ZavorthExternalRuntimeBridgeContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  projectRoot: string | null;
  referenceRuntimeRoot: string | null;
  compatibilitySidecarRoot: string | null;
  compatibilityFixtureRoot: string | null;
  bridgeStatus: ZavorthExternalRuntimeBridgeStatus | null;
};

const BRIDGE_STATUSES = new Set<ZavorthExternalRuntimeBridgeStatus>([
  'bridge-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    projectRoot: null,
    referenceRuntimeRoot: null,
    compatibilitySidecarRoot: null,
    compatibilityFixtureRoot: null,
    bridgeStatus: null,
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
    if (arg === '--project-root') {
      options.projectRoot = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--reference-runtime-root') {
      options.referenceRuntimeRoot = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--compatibility-sidecar-root') {
      options.compatibilitySidecarRoot = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--compatibility-fixture-root') {
      options.compatibilityFixtureRoot = readNext(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--bridge-status') {
      const value = readNext(argv, index, arg);
      if (!BRIDGE_STATUSES.has(value as ZavorthExternalRuntimeBridgeStatus)) {
        throw new Error(`Invalid --bridge-status value: ${value}`);
      }
      options.bridgeStatus = value as ZavorthExternalRuntimeBridgeStatus;
      index += 1;
    }
  }

  return options;
}

function readNext(argv: string[], index: number, flag: string): string {
  const value = String(argv[index + 1] || '').trim();
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthExternalCapabilityInventoryService();
  const snapshot = service.buildSnapshot({
    projectRoot: options.projectRoot,
    referenceRuntimeRoot: options.referenceRuntimeRoot,
    compatibilitySidecarRoot: options.compatibilitySidecarRoot,
    compatibilityFixtureRoot: options.compatibilityFixtureRoot,
    bridgeStatus: options.bridgeStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'inventory-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-external-capability-inventory] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
