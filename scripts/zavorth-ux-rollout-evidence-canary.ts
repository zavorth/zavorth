#!/usr/bin/env tsx
import { ZavorthUxRolloutEvidenceCanaryService } from '../src/services/ZavorthUxRolloutEvidenceCanaryService.js';
import type {
  ZavorthUxEvidenceKind,
  ZavorthUxRolloutEvidenceCanaryInput,
  ZavorthUxRolloutEvidenceInput,
} from '../src/contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import type {
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
  evidence: ZavorthUxRolloutEvidenceInput[];
  requestMode: 'dry_run' | 'live';
  approvalId: string | null;
  ownerConfirmed: boolean;
  requireEvidenceForAllSurfaces: boolean;
  minEvidenceItems: number | null;
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthUxRolloutEvidenceCanaryService();
const input: ZavorthUxRolloutEvidenceCanaryInput = {
  rolloutEval: {
    projectionSurfaces: args.projectionSurfaces,
    scenarios: args.scenarios,
    includeDefaultScenarios: args.includeDefaultScenarios,
    strict: args.strict,
  },
  evidence: args.evidence,
  canaryRequest: {
    mode: args.requestMode,
    approvalId: args.approvalId,
    ownerConfirmed: args.ownerConfirmed,
  },
  requireEvidenceForAllSurfaces: args.requireEvidenceForAllSurfaces,
  minEvidenceItems: args.minEvidenceItems,
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
    evidence: [],
    requestMode: 'dry_run',
    approvalId: null,
    ownerConfirmed: false,
    requireEvidenceForAllSurfaces: false,
    minEvidenceItems: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--no-defaults') out.includeDefaultScenarios = false;
    else if (arg === '--live') out.requestMode = 'live';
    else if (arg === '--dry-run') out.requestMode = 'dry_run';
    else if (arg === '--owner-confirmed') out.ownerConfirmed = true;
    else if (arg === '--require-all-surfaces') out.requireEvidenceForAllSurfaces = true;
    else if (arg === '--approval') out.approvalId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--approval=')) out.approvalId = arg.slice('--approval='.length) || null;
    else if (arg === '--min-evidence') out.minEvidenceItems = Number(argv[++index]) || null;
    else if (arg.startsWith('--min-evidence=')) out.minEvidenceItems = Number(arg.slice('--min-evidence='.length)) || null;
    else if (arg === '--project') out.projectionSurfaces = parseProjectionSurfaces(argv[++index]);
    else if (arg.startsWith('--project=')) out.projectionSurfaces = parseProjectionSurfaces(arg.slice('--project='.length));
    else if (arg === '--scenario') out.scenarios.push(parseScenario(argv[++index]));
    else if (arg.startsWith('--scenario=')) out.scenarios.push(parseScenario(arg.slice('--scenario='.length)));
    else if (arg === '--evidence') out.evidence.push(parseEvidence(argv[++index]));
    else if (arg.startsWith('--evidence=')) out.evidence.push(parseEvidence(arg.slice('--evidence='.length)));
  }
  return out;
}

function parseScenario(value: unknown): ZavorthOperationalRolloutScenarioInput {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    id: parts[0]?.trim() || `scenario-${Date.now()}`,
    kind: 'custom',
    text: parts[1]?.trim() || raw,
    expectedStatus: parseStatus(parts[2]?.trim() || 'verification-required'),
    description: parts[3]?.trim() || parts[1]?.trim() || raw,
  };
}

function parseEvidence(value: unknown): ZavorthUxRolloutEvidenceInput {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    id: parts[0]?.trim() || `evidence-${Date.now()}`,
    scenarioId: parts[1]?.trim() || null,
    surface: parseSurface(parts[2]?.trim() || ''),
    kind: parseEvidenceKind(parts[3]?.trim() || 'operator_note'),
    trusted: parts[4] ? parts[4].trim() !== 'false' : true,
    summary: parts.slice(5).join('|').trim() || raw,
    source: 'cli',
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

function parseSurface(value: string): ZavorthUxRolloutEvidenceInput['surface'] {
  if (value === 'all') return 'all';
  const allowed = new Set(['cli', 'telegram', 'discord', 'whatsapp', 'signal', 'imessage', 'web', 'api', 'command_center']);
  return allowed.has(value) ? value as ZavorthCrossSurfaceProjectionSurface : null;
}

function parseEvidenceKind(value: string): ZavorthUxEvidenceKind {
  const allowed = new Set(['operator_note', 'screenshot', 'channel_transcript', 'cli_output', 'api_payload', 'dashboard_snapshot']);
  return allowed.has(value) ? value as ZavorthUxEvidenceKind : 'operator_note';
}
