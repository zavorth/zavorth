#!/usr/bin/env tsx
import { ZavorthOperationalRolloutEvalService } from '../src/services/ZavorthOperationalRolloutEvalService.js';
import type {
  ZavorthOperationalRolloutEvalInput,
  ZavorthOperationalRolloutScenarioInput,
} from '../src/contracts/ZavorthOperationalRolloutEvalContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../src/contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type { ZavorthToolOrchestrationVerificationStatus } from '../src/contracts/ZavorthToolOrchestrationVerificationContract.js';

type Args = {
  json: boolean;
  strict: boolean;
  includeDefaultScenarios: boolean;
  projectionSurfaces: ZavorthCrossSurfaceProjectionSurface[] | null;
  scenarios: ZavorthOperationalRolloutScenarioInput[];
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthOperationalRolloutEvalService();
const input: ZavorthOperationalRolloutEvalInput = {
  projectionSurfaces: args.projectionSurfaces,
  scenarios: args.scenarios,
  includeDefaultScenarios: args.includeDefaultScenarios,
  strict: args.strict,
};
const snapshot = service.buildSnapshot(input);

if (args.json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatSnapshotText(snapshot));
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    strict: false,
    includeDefaultScenarios: true,
    projectionSurfaces: null,
    scenarios: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--no-defaults') out.includeDefaultScenarios = false;
    else if (arg === '--project') out.projectionSurfaces = parseProjectionSurfaces(argv[++index]);
    else if (arg.startsWith('--project=')) out.projectionSurfaces = parseProjectionSurfaces(arg.slice('--project='.length));
    else if (arg === '--scenario') out.scenarios.push(parseScenario(argv[++index]));
    else if (arg.startsWith('--scenario=')) out.scenarios.push(parseScenario(arg.slice('--scenario='.length)));
  }
  return out;
}

function parseScenario(value: unknown): ZavorthOperationalRolloutScenarioInput {
  const raw = String(value || '');
  const parts = raw.split('|');
  const id = parts[0]?.trim() || `scenario-${Date.now()}`;
  const text = parts[1]?.trim() || raw;
  const expectedStatus = parseStatus(parts[2]?.trim() || 'verification-required');
  const surfaceCsv = parts[3]?.trim() || '';
  const availableSurfaces = surfaceCsv
    ? surfaceCsv.split(',').map((item) => item.trim()).filter(Boolean) as ZavorthOperationalRolloutScenarioInput['availableSurfaces']
    : null;
  return {
    id,
    kind: 'custom',
    expectedStatus,
    text,
    availableSurfaces,
    description: parts[4]?.trim() || text.slice(0, 80),
  };
}

function parseStatus(value: string): ZavorthToolOrchestrationVerificationStatus {
  const allowed = new Set(['ready', 'verification-required', 'approval-required', 'needs-setup', 'blocked']);
  return allowed.has(value) ? value as ZavorthToolOrchestrationVerificationStatus : 'verification-required';
}

function parseProjectionSurfaces(value: unknown): ZavorthCrossSurfaceProjectionSurface[] {
  const allowed = new Set(['cli', 'telegram', 'discord', 'whatsapp', 'signal', 'imessage', 'web', 'api', 'command_center']);
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowed.has(item)) as ZavorthCrossSurfaceProjectionSurface[];
}
