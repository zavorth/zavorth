import { ZavorthExternalSidecarAdapterService } from '../src/services/ZavorthExternalSidecarAdapterService.js';
import type {
  ZavorthExternalSidecarProbeMode,
} from '../src/contracts/ZavorthExternalSidecarAdapterContract.js';
import type {
  ZavorthNativeEngineAbsorptionStatus,
} from '../src/contracts/ZavorthNativeEngineAbsorptionContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  nativeEngineStatus: ZavorthNativeEngineAbsorptionStatus | null;
  probeMode: ZavorthExternalSidecarProbeMode | null;
};

const NATIVE_ENGINE_STATUSES = new Set<ZavorthNativeEngineAbsorptionStatus>([
  'native-engine-ready',
  'attention',
  'blocked',
]);

const PROBE_MODES = new Set<ZavorthExternalSidecarProbeMode>([
  'fixture-readonly',
  'live-readonly',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    nativeEngineStatus: null,
    probeMode: null,
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
    if (arg === '--native-engine-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!NATIVE_ENGINE_STATUSES.has(value as ZavorthNativeEngineAbsorptionStatus)) {
        throw new Error(`Invalid --native-engine-status value: ${value}`);
      }
      options.nativeEngineStatus = value as ZavorthNativeEngineAbsorptionStatus;
      index += 1;
      continue;
    }
    if (arg === '--probe-mode') {
      const value = String(argv[index + 1] || '').trim();
      if (!PROBE_MODES.has(value as ZavorthExternalSidecarProbeMode)) {
        throw new Error(`Invalid --probe-mode value: ${value}`);
      }
      options.probeMode = value as ZavorthExternalSidecarProbeMode;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthExternalSidecarAdapterService();
  const snapshot = service.buildSnapshot({
    nativeEngineStatus: options.nativeEngineStatus,
    probeMode: options.probeMode,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'sidecar-adapter-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-external-sidecar-adapter] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
