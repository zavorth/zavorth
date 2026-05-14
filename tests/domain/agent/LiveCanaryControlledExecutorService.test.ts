import {
  ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
} from '../../../src/contracts/ZavorthLiveCanaryApplyGateRollbackDrillContract.js';
import {
  ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
} from '../../../src/contracts/ZavorthLiveCanaryControlledExecutorContract.js';
import type { ZavorthProviderLiveCanarySnapshot } from '../../../src/contracts/ZavorthProviderLiveCanaryContract.js';
import type { ZavorthUxRolloutEvidenceInput } from '../../../src/contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import { ZavorthLiveCanaryControlledExecutorService } from '../../../src/services/ZavorthLiveCanaryControlledExecutorService.js';

describe('ZavorthLiveCanaryControlledExecutorService', () => {
  const service = new ZavorthLiveCanaryControlledExecutorService({
    now: () => new Date('2026-05-11T12:00:00.000Z'),
  });

  it('requires the Phase 9 apply gate before execution', async () => {
    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION);
    expect(snapshot.phase).toBe('phase-10-live-canary-controlled-executor');
    expect(snapshot.status).toBe('needs-apply-gate');
    expect(snapshot.executionResult.status).toBe('not-run');
    expect(snapshot.safety).toMatchObject({
      executesOnlyWithPhase9Authorization: true,
      explicitOperatorExecuteRequired: true,
      noImplicitExecutionFromChecks: true,
      idempotencyKeyRequiredForExecution: true,
      rollbackReceiptRequiredAfterExecution: true,
      noDashboardVisualMutation: true,
    });
  });

  it('reports ready-for-execution when the gate is open but execution is not requested', async () => {
    const snapshot = await service.buildSnapshot({
      applyGate: readyApplyGateInput(),
      execution: {
        execute: false,
        executorId: 'local_ack',
        idempotencyKey: 'idem-123',
      },
    });

    expect(snapshot.status).toBe('ready-for-execution');
    expect(snapshot.mode).toBe('operator-ready');
    expect(snapshot.summary.applyGateOpen).toBe(true);
    expect(snapshot.summary.executionPerformed).toBe(false);
    expect(snapshot.checks.some((check) =>
      check.kind === 'explicit-execute' && check.status === 'warn',
    )).toBe(true);
  });

  it('executes local_ack without external IO when explicitly requested', async () => {
    const snapshot = await service.buildSnapshot({
      applyGate: readyApplyGateInput(),
      execution: {
        execute: true,
        executorId: 'local_ack',
        operatorConfirmed: true,
        idempotencyKey: 'idem-123',
      },
    });

    expect(snapshot.status).toBe('executed');
    expect(snapshot.mode).toBe('controlled-live-execution');
    expect(snapshot.summary.executionPerformed).toBe(true);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.executionResult.executionReceiptId).toBe('phase-10-execution:phase-8-default-live-canary-adapter:idem-123');
    expect(snapshot.executionResult.rollbackReceiptId).toBe('phase-10-rollback:phase-8-default-live-canary-adapter:idem-123');
  });

  it('blocks execution when idempotency key is missing', async () => {
    const snapshot = await service.buildSnapshot({
      applyGate: readyApplyGateInput(),
      execution: {
        execute: true,
        executorId: 'local_ack',
        operatorConfirmed: true,
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.executionResult.status).toBe('not-run');
    expect(snapshot.checks.some((check) =>
      check.kind === 'idempotency-key' && check.status === 'fail',
    )).toBe(true);
  });

  it('executes provider_live_canary through the provider canary service', async () => {
    const providerService = {
      buildSnapshot: jest.fn(async () => providerSnapshot()),
    };
    const providerExecutor = new ZavorthLiveCanaryControlledExecutorService({
      now: () => new Date('2026-05-11T12:00:00.000Z'),
      providerCanary: providerService,
    });

    const snapshot = await providerExecutor.buildSnapshot({
      applyGate: readyApplyGateInput(providerAdapter()),
      execution: {
        execute: true,
        executorId: 'provider_live_canary',
        operatorConfirmed: true,
        idempotencyKey: 'idem-provider',
        providerName: 'test-provider',
        modelName: 'test-model',
      },
    });

    expect(snapshot.status).toBe('executed');
    expect(snapshot.summary.externalIoPerformed).toBe(true);
    expect(snapshot.executionResult.providerCanary?.status).toBe('passed');
    expect(providerService.buildSnapshot).toHaveBeenCalledWith({
      runLive: true,
      providerName: 'test-provider',
      modelName: 'test-model',
      timeoutMs: 30000,
    });
  });

  it('rejects unsupported adapter/executor combinations', async () => {
    const snapshot = await service.buildSnapshot({
      applyGate: readyApplyGateInput(providerAdapter()),
      execution: {
        execute: true,
        executorId: 'local_ack',
        operatorConfirmed: true,
        idempotencyKey: 'idem-123',
      },
    });

    expect(snapshot.status).toBe('unsupported-adapter');
    expect(snapshot.executionResult.status).toBe('not-run');
    expect(snapshot.receipts.some((receipt) =>
      receipt.kind === 'unsupported-adapter' && receipt.status === 'blocked',
    )).toBe(true);
  });
});

function readyApplyGateInput(adapter?: ReturnType<typeof providerAdapter>) {
  return {
    adapterReview: {
      evidenceCanary: { evidence: canonicalEvidence() },
      ownerApproval: {
        approvalId: 'approval-123',
        ownerConfirmed: true,
      },
      adapter,
    },
    finalTrigger: {
      triggerId: 'trigger-123',
      ownerConfirmed: true,
      phrase: ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
      requestedBy: 'owner',
      issuedAt: '2026-05-11T12:00:00.000Z',
    },
    rollbackDrill: {
      drillId: 'rollback-drill-123',
      performed: true,
      successful: true,
      summary: 'rollback drill replayed and restored state',
      replayCommand: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts --json',
      rollbackCommand: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts --json --no-defaults',
      artifacts: ['rollback.log'],
    },
  };
}

function providerAdapter() {
  return {
    id: 'provider-adapter',
    surface: 'api' as const,
    actionKind: 'provider_call' as const,
    target: 'configured provider canary',
    impactDescription: 'read-only provider live canary',
    rollbackPlan: 'receipt revocation only',
    policyScope: 'owner-approved live provider canary',
    dryRunReplayCommand: 'npx tsx scripts/zavorth-provider-live-canary.ts --json',
    timeoutMs: 30000,
  };
}

function canonicalEvidence(): ZavorthUxRolloutEvidenceInput[] {
  return [
    {
      id: 'e1',
      scenarioId: 'verification-required-subagents-skills',
      surface: 'telegram',
      kind: 'channel_transcript',
      trusted: true,
      summary: 'operator saw verification action and fallback',
    },
    {
      id: 'e2',
      scenarioId: 'approval-required-workspace-command',
      surface: 'cli',
      kind: 'cli_output',
      trusted: true,
      summary: 'operator saw approval boundary',
    },
    {
      id: 'e3',
      scenarioId: 'needs-setup-android-adb',
      surface: 'whatsapp',
      kind: 'channel_transcript',
      trusted: true,
      summary: 'operator saw doctor fallback',
    },
    {
      id: 'e4',
      scenarioId: 'ready-after-evidence',
      surface: 'api',
      kind: 'api_payload',
      trusted: true,
      summary: 'operator saw ready answer action',
    },
    {
      id: 'e5',
      scenarioId: 'blocked-raw-reasoning',
      surface: 'discord',
      kind: 'channel_transcript',
      trusted: true,
      summary: 'operator saw blocked action',
    },
  ];
}

function providerSnapshot(): ZavorthProviderLiveCanarySnapshot {
  return {
    generatedAt: '2026-05-11T12:00:00.000Z',
    contractVersion: '2026-05-10.provider-live-canary',
    source: 'ZavorthProviderLiveCanaryService',
    status: 'passed',
    mode: 'live',
    selectedProviderName: 'test-provider',
    selectedModelName: 'test-model',
    timeoutMs: 30000,
    canaryMarker: 'ZAVORTH_LIVE_SUBAGENT_CANARY_OK',
    providerEntries: [
      {
        providerName: 'test-provider',
        available: true,
        selected: true,
        reason: 'fixture',
      },
    ],
    live: {
      executed: true,
      completed: true,
      markerObserved: true,
      subagentStatus: 'completed',
      workerResults: 1,
      failedWorkerResults: 0,
      externalIoPerformed: true,
      workspaceMutationPerformed: false,
      upstreamRuntimeCodeExecuted: false,
      error: null,
    },
    guarantees: {
      noSecretValuesSerialized: true,
      noWorkspaceMutationRequested: true,
      noToolsRequestedByCanary: true,
      singleWorkerOnly: true,
      boundedTimeout: true,
      providerCredentialsOnlyPresenceChecked: true,
    },
    narrative: {
      headline: 'Provider live canary',
      operatorSummary: 'fixture passed',
      nextAction: 'done',
    },
    commands: {
      dryRun: 'npm run zavorth:provider-live-canary',
      live: 'npm run zavorth:provider-live-canary -- --run-live',
      json: 'npm run zavorth:provider-live-canary:json -- --run-live',
      check: 'npm run zavorth:provider-live-canary:check --silent',
    },
  };
}
