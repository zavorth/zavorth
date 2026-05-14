#!/usr/bin/env tsx
import {
  ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
  type ZavorthLiveCanaryFinalTriggerInput,
  type ZavorthLiveCanaryRollbackDrillInput,
} from '../src/contracts/ZavorthLiveCanaryApplyGateRollbackDrillContract.js';
import type {
  ZavorthLiveCanaryControlledExecutorInput,
  ZavorthLiveCanaryExecutionRequest,
  ZavorthLiveCanaryExecutorId,
} from '../src/contracts/ZavorthLiveCanaryControlledExecutorContract.js';
import type {
  ZavorthLiveCanaryAdapterActionKind,
  ZavorthLiveCanaryAdapterInput,
} from '../src/contracts/ZavorthLiveCanaryExecutionAdapterReviewContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../src/contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type { ZavorthOperationalRolloutScenarioInput } from '../src/contracts/ZavorthOperationalRolloutEvalContract.js';
import type { ZavorthToolOrchestrationVerificationStatus } from '../src/contracts/ZavorthToolOrchestrationVerificationContract.js';
import type { ZavorthUxEvidenceKind, ZavorthUxRolloutEvidenceInput } from '../src/contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import { ZavorthLiveCanaryControlledExecutorService } from '../src/services/ZavorthLiveCanaryControlledExecutorService.js';

type Args = {
  json: boolean;
  strict: boolean;
  includeDefaultScenarios: boolean;
  projectionSurfaces: ZavorthCrossSurfaceProjectionSurface[] | null;
  scenarios: ZavorthOperationalRolloutScenarioInput[];
  evidence: ZavorthUxRolloutEvidenceInput[];
  approvalId: string | null;
  ownerConfirmed: boolean;
  adapter: ZavorthLiveCanaryAdapterInput | null;
  requireRollback: boolean;
  finalTrigger: ZavorthLiveCanaryFinalTriggerInput | null;
  rollbackDrill: ZavorthLiveCanaryRollbackDrillInput | null;
  execution: ZavorthLiveCanaryExecutionRequest;
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthLiveCanaryControlledExecutorService();
  const input: ZavorthLiveCanaryControlledExecutorInput = {
    applyGate: {
      adapterReview: {
        evidenceCanary: {
          rolloutEval: {
            projectionSurfaces: args.projectionSurfaces,
            scenarios: args.scenarios,
            includeDefaultScenarios: args.includeDefaultScenarios,
            strict: args.strict,
          },
          evidence: args.evidence,
          canaryRequest: {
            mode: 'live',
            approvalId: args.approvalId,
            ownerConfirmed: args.ownerConfirmed,
          },
        },
        adapter: args.adapter,
        ownerApproval: {
          approvalId: args.approvalId,
          ownerConfirmed: args.ownerConfirmed,
        },
        requireRollback: args.requireRollback,
      },
      finalTrigger: args.finalTrigger,
      rollbackDrill: args.rollbackDrill,
    },
    execution: args.execution,
  };
  const snapshot = await service.buildSnapshot(input);

  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (snapshot.status === 'blocked' || snapshot.status === 'execution-failed') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    strict: false,
    includeDefaultScenarios: true,
    projectionSurfaces: null,
    scenarios: [],
    evidence: [],
    approvalId: null,
    ownerConfirmed: false,
    adapter: null,
    requireRollback: true,
    finalTrigger: null,
    rollbackDrill: null,
    execution: {
      execute: false,
      executorId: 'local_ack',
      operatorConfirmed: false,
      idempotencyKey: null,
      providerName: null,
      modelName: null,
      timeoutMs: 30000,
    },
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--no-defaults') out.includeDefaultScenarios = false;
    else if (arg === '--no-rollback-required') out.requireRollback = false;
    else if (arg === '--owner-confirmed') out.ownerConfirmed = true;
    else if (arg === '--approval') out.approvalId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--approval=')) out.approvalId = arg.slice('--approval='.length) || null;
    else if (arg === '--project') out.projectionSurfaces = parseProjectionSurfaces(argv[++index]);
    else if (arg.startsWith('--project=')) out.projectionSurfaces = parseProjectionSurfaces(arg.slice('--project='.length));
    else if (arg === '--scenario') out.scenarios.push(parseScenario(argv[++index]));
    else if (arg.startsWith('--scenario=')) out.scenarios.push(parseScenario(arg.slice('--scenario='.length)));
    else if (arg === '--evidence') out.evidence.push(parseEvidence(argv[++index]));
    else if (arg.startsWith('--evidence=')) out.evidence.push(parseEvidence(arg.slice('--evidence='.length)));
    else if (arg === '--adapter') out.adapter = parseAdapter(argv[++index]);
    else if (arg.startsWith('--adapter=')) out.adapter = parseAdapter(arg.slice('--adapter='.length));
    else if (arg === '--final-trigger') out.finalTrigger = parseFinalTrigger(argv[++index], out.finalTrigger);
    else if (arg.startsWith('--final-trigger=')) out.finalTrigger = parseFinalTrigger(arg.slice('--final-trigger='.length), out.finalTrigger);
    else if (arg === '--final-phrase') out.finalTrigger = { ...(out.finalTrigger || {}), phrase: String(argv[++index] || '') };
    else if (arg.startsWith('--final-phrase=')) out.finalTrigger = { ...(out.finalTrigger || {}), phrase: arg.slice('--final-phrase='.length) };
    else if (arg === '--default-final-phrase') out.finalTrigger = { ...(out.finalTrigger || {}), phrase: ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE };
    else if (arg === '--rollback-drill') out.rollbackDrill = parseRollbackDrill(argv[++index]);
    else if (arg.startsWith('--rollback-drill=')) out.rollbackDrill = parseRollbackDrill(arg.slice('--rollback-drill='.length));
    else if (arg === '--execute-local') {
      out.execution.execute = true;
      out.execution.executorId = 'local_ack';
      out.execution.operatorConfirmed = true;
    } else if (arg === '--execute-provider') {
      out.execution.execute = true;
      out.execution.executorId = 'provider_live_canary';
      out.execution.operatorConfirmed = true;
      out.adapter = out.adapter || providerCanaryAdapter();
    } else if (arg === '--executor') out.execution.executorId = parseExecutorId(argv[++index]);
    else if (arg.startsWith('--executor=')) out.execution.executorId = parseExecutorId(arg.slice('--executor='.length));
    else if (arg === '--operator-confirmed') out.execution.operatorConfirmed = true;
    else if (arg === '--idempotency-key') out.execution.idempotencyKey = String(argv[++index] || '') || null;
    else if (arg.startsWith('--idempotency-key=')) out.execution.idempotencyKey = arg.slice('--idempotency-key='.length) || null;
    else if (arg === '--provider') out.execution.providerName = String(argv[++index] || '') || null;
    else if (arg.startsWith('--provider=')) out.execution.providerName = arg.slice('--provider='.length) || null;
    else if (arg === '--model') out.execution.modelName = String(argv[++index] || '') || null;
    else if (arg.startsWith('--model=')) out.execution.modelName = arg.slice('--model='.length) || null;
    else if (arg === '--timeout-ms') out.execution.timeoutMs = Number(argv[++index] || 30000);
    else if (arg.startsWith('--timeout-ms=')) out.execution.timeoutMs = Number(arg.slice('--timeout-ms='.length) || 30000);
  }
  if (out.execution.execute && !out.execution.idempotencyKey) {
    out.execution.idempotencyKey = `cli-${Date.now()}`;
  }
  return out;
}

function providerCanaryAdapter(): ZavorthLiveCanaryAdapterInput {
  return {
    id: 'phase-10-provider-live-canary',
    surface: 'api',
    actionKind: 'provider_call',
    target: 'configured provider canary',
    impactDescription: 'Run the bounded read-only provider live canary.',
    rollbackPlan: 'No workspace mutation; rollback is receipt revocation and provider canary stop.',
    policyScope: 'owner-approved live provider canary',
    dryRunReplayCommand: 'npx tsx scripts/zavorth-provider-live-canary.ts --json',
    timeoutMs: 30000,
  };
}

function parseFinalTrigger(value: unknown, current: ZavorthLiveCanaryFinalTriggerInput | null): ZavorthLiveCanaryFinalTriggerInput {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    ...(current || {}),
    triggerId: parts[0]?.trim() || current?.triggerId || null,
    ownerConfirmed: parts[1] ? parts[1].trim() === 'true' : current?.ownerConfirmed ?? false,
    phrase: parts[2]?.trim() || current?.phrase || null,
    requestedBy: parts[3]?.trim() || current?.requestedBy || null,
    issuedAt: parts[4]?.trim() || current?.issuedAt || null,
  };
}

function parseRollbackDrill(value: unknown): ZavorthLiveCanaryRollbackDrillInput {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    drillId: parts[0]?.trim() || 'rollback-drill',
    performed: parts[1] ? parts[1].trim() === 'true' : false,
    successful: parts[2] ? parts[2].trim() === 'true' : false,
    summary: parts[3]?.trim() || raw,
    replayCommand: parts[4]?.trim() || null,
    rollbackCommand: parts[5]?.trim() || null,
    artifacts: parts[6]?.split(',').map((item) => item.trim()).filter(Boolean) || [],
  };
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

function parseAdapter(value: unknown): ZavorthLiveCanaryAdapterInput {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    id: parts[0]?.trim() || 'custom-live-canary-adapter',
    surface: parseProjectionSurface(parts[1]?.trim() || 'api'),
    actionKind: parseActionKind(parts[2]?.trim() || 'api_invoke'),
    target: parts[3]?.trim() || 'local canary adapter',
    impactDescription: parts[4]?.trim() || 'review envelope only',
    rollbackPlan: parts[5]?.trim() || null,
    policyScope: parts[6]?.trim() || 'owner-approved live canary review',
    dryRunReplayCommand: parts[7]?.trim() || null,
    timeoutMs: parts[8] ? Number(parts[8]) : 30000,
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

function parseProjectionSurface(value: string): ZavorthCrossSurfaceProjectionSurface {
  const allowed = new Set(['cli', 'telegram', 'discord', 'whatsapp', 'signal', 'imessage', 'web', 'api', 'command_center']);
  return allowed.has(value) ? value as ZavorthCrossSurfaceProjectionSurface : 'api';
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

function parseActionKind(value: string): ZavorthLiveCanaryAdapterActionKind {
  const allowed = new Set(['api_invoke', 'channel_send', 'webhook_call', 'provider_call', 'workspace_mutation', 'command_exec']);
  return allowed.has(value) ? value as ZavorthLiveCanaryAdapterActionKind : 'api_invoke';
}

function parseExecutorId(value: unknown): ZavorthLiveCanaryExecutorId {
  return String(value || '') === 'provider_live_canary' ? 'provider_live_canary' : 'local_ack';
}
