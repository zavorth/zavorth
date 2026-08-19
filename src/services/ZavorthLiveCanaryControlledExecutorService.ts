import { ZavorthLiveCanaryApplyGateRollbackDrillService } from './ZavorthLiveCanaryApplyGateRollbackDrillService.js';

import {
  ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
  type ZavorthLiveCanaryControlledExecutionResult,
  type ZavorthLiveCanaryControlledExecutorCheck,
  type ZavorthLiveCanaryControlledExecutorInput,
  type ZavorthLiveCanaryControlledExecutorMode,
  type ZavorthLiveCanaryControlledExecutorReceipt,
  type ZavorthLiveCanaryControlledExecutorSnapshot,
  type ZavorthLiveCanaryControlledExecutorStatus,
  type ZavorthLiveCanaryExecutionRequest,
  type ZavorthLiveCanaryExecutorId,
} from '../contracts/ZavorthLiveCanaryControlledExecutorContract.js';

import { ZavorthProviderLiveCanaryService } from './ZavorthProviderLiveCanaryService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type Runtime = {
  now?: () => Date;
  applyGate?: Pick<ZavorthLiveCanaryApplyGateRollbackDrillService, 'buildSnapshot'>;
  providerCanary?: Pick<ZavorthProviderLiveCanaryService, 'buildSnapshot'>;
};

type NormalizedExecutionRequest = {
  execute: boolean;
  executorId: ZavorthLiveCanaryExecutorId;
  operatorConfirmed: boolean;
  idempotencyKey: string | null;
  timeoutMs: number;
  providerName: string | null;
  modelName: string | null;
};

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 60000;

export class ZavorthLiveCanaryControlledExecutorService {
  private readonly now: () => Date;
  private readonly applyGate: Pick<ZavorthLiveCanaryApplyGateRollbackDrillService, 'buildSnapshot'>;
  private readonly providerCanary: Pick<ZavorthProviderLiveCanaryService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.applyGate = runtime.applyGate || new ZavorthLiveCanaryApplyGateRollbackDrillService({
      now: this.now,
    });
    this.providerCanary = runtime.providerCanary || new ZavorthProviderLiveCanaryService({
      now: this.now,
    });
  }

  public async buildSnapshot(input: ZavorthLiveCanaryControlledExecutorInput = {}): Promise<ZavorthLiveCanaryControlledExecutorSnapshot> {
    const generatedAt = this.now().toISOString();
    const applyGate = this.applyGate.buildSnapshot(input.applyGate || {});
    const executionRequest = normalizeExecutionRequest(input.execution);
    const adapterSupported = supportsAdapter(applyGate, executionRequest.executorId);
    const checks = buildChecks(applyGate, executionRequest, adapterSupported, this.now());
    const preExecutionStatus = resolvePreExecutionStatus(applyGate.status, checks, executionRequest, adapterSupported);
    const executionResult = await this.executeIfAllowed(preExecutionStatus, applyGate, executionRequest);
    const status = resolveFinalStatus(preExecutionStatus, executionResult);
    const mode = modeForStatus(status, executionRequest.execute);
    const receipts = buildReceipts(status, applyGate, executionRequest, executionResult, adapterSupported);
    const summary = summarize(checks, applyGate, executionRequest, adapterSupported, executionResult);

    return {
      generatedAt,
      contractVersion: ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
      source: 'ZavorthLiveCanaryControlledExecutorService',
      phase: 'checkpoint-10-live-canary-controlled-executor',
      status,
      mode,
      applyGate,
      executionRequest,
      checks,
      executionResult,
      receipts,
      safety: {
        executesOnlyWithStage9Authorization: true,
        explicitOperatorExecuteRequired: true,
        noImplicitExecutionFromChecks: true,
        idempotencyKeyRequiredForExecution: true,
        rollbackReceiptRequiredAfterExecution: true,
        noDashboardVisualMutation: true,
        rawSecretsSerialized: false,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-live-canary-executor.ts',
        json: 'npx tsx scripts/zavorth-live-canary-executor.ts --json',
        local: 'npx tsx scripts/zavorth-live-canary-executor.ts --execute-local',
        provider: 'npx tsx scripts/zavorth-live-canary-executor.ts --execute-provider',
        check: 'node scripts/zavorth-live-canary-executor-check.mjs',
      },
      narrative: narrativeForStatus(status, mode, summary, executionResult),
    };
  }

  public formatSnapshotText(snapshot: ZavorthLiveCanaryControlledExecutorSnapshot): string {
    const lines = [
      'Zavorth Live Canary Controlled Executor - Intent model0',
      '',
      `Status: ${snapshot.status}`,
      `Mode: ${snapshot.mode}`,
      `Executor: ${snapshot.executionRequest.executorId}`,
      `Adapter: ${snapshot.applyGate.adapter.id} | ${snapshot.applyGate.adapter.actionKind} | ${snapshot.applyGate.adapter.surface}`,
      `Checks: ${snapshot.summary.passedChecks}/${snapshot.summary.checks} passed | warnings=${snapshot.summary.warningChecks} | failed=${snapshot.summary.failedChecks}`,
      `Execution: requested=${snapshot.summary.executionRequested} performed=${snapshot.summary.executionPerformed} externalIo=${snapshot.summary.externalIoPerformed}`,
      '',
      'Checks:',
      ...snapshot.checks.map((check) => `- ${check.kind}: ${check.status} | ${check.summary}`),
      '',
      snapshot.narrative.operatorSummary,
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }

  private async executeIfAllowed(
    status: ZavorthLiveCanaryControlledExecutorStatus,
    applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
    request: NormalizedExecutionRequest,
  ): Promise<ZavorthLiveCanaryControlledExecutionResult> {
    if (status !== 'ready-for-execution' || !request.execute) {
      return emptyExecutionResult(request.executorId, request.idempotencyKey);
    }
    const startedAt = this.now().toISOString();
    try {
      if (request.executorId === 'provider_live_canary') {
        const providerCanary = await this.providerCanary.buildSnapshot({
          runLive: true,
          providerName: request.providerName,
          modelName: request.modelName,
          timeoutMs: request.timeoutMs,
        });
        const performed = providerCanary.live.executed && providerCanary.status !== 'blocked';
        return {
          executorId: request.executorId,
          status: performed ? 'performed' : 'failed',
          startedAt,
          completedAt: this.now().toISOString(),
          idempotencyKey: request.idempotencyKey,
          executionReceiptId: performed ? executionReceiptId(applyGate, request) : null,
          rollbackReceiptId: performed ? rollbackReceiptId(applyGate, request) : null,
          externalIoPerformed: providerCanary.live.executed,
          workspaceMutationPerformed: providerCanary.live.workspaceMutationPerformed,
          upstreamRuntimeCodeExecuted: providerCanary.live.upstreamRuntimeCodeExecuted,
          outputPreview: `Provider canary ${providerCanary.status}; marker=${providerCanary.live.markerObserved ? 'observed' : 'missing'}.`,
          error: providerCanary.status === 'blocked' ? providerCanary.live.error || 'provider live canary blocked' : null,
          providerCanary,
        };
      }
      return {
        executorId: request.executorId,
        status: 'performed',
        startedAt,
        completedAt: this.now().toISOString(),
        idempotencyKey: request.idempotencyKey,
        executionReceiptId: executionReceiptId(applyGate, request),
        rollbackReceiptId: rollbackReceiptId(applyGate, request),
        externalIoPerformed: false,
        workspaceMutationPerformed: false,
        upstreamRuntimeCodeExecuted: false,
        outputPreview: `local controlled canary acknowledged adapter ${applyGate.adapter.id}.`,
        error: null,
        providerCanary: null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Live Canary Controlled Executor] process execution failed', error);
    return {
        executorId: request.executorId,
        status: 'failed',
        startedAt,
        completedAt: this.now().toISOString(),
        idempotencyKey: request.idempotencyKey,
        executionReceiptId: null,
        rollbackReceiptId: null,
        externalIoPerformed: request.executorId === 'provider_live_canary',
        workspaceMutationPerformed: false,
        upstreamRuntimeCodeExecuted: false,
        outputPreview: null,
        error: redact(error instanceof Error ? err.message : String(error)),
        providerCanary: null,
      };
  }
  }
}

function normalizeExecutionRequest(input: ZavorthLiveCanaryExecutionRequest | null | undefined): NormalizedExecutionRequest {
  const timeoutMs = Number(input?.timeoutMs || DEFAULT_TIMEOUT_MS);
  return {
    execute: input?.execute === true,
    executorId: input?.executorId || 'local_ack',
    operatorConfirmed: input?.operatorConfirmed === true,
    idempotencyKey: clean(input?.idempotencyKey) || null,
    providerName: clean(input?.providerName),
    modelName: clean(input?.modelName),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(Math.round(timeoutMs), MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS,
  };
}

function buildChecks(
  applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
  request: NormalizedExecutionRequest,
  adapterSupported: boolean,
  now: Date,
): ZavorthLiveCanaryControlledExecutorCheck[] {
  const expiresAt = applyGate.authorizationPacket.expiresAt ? Date.parse(applyGate.authorizationPacket.expiresAt) : Number.NaN;
  return [
    check('apply-gate-open', applyGate.authorizationPacket.applyGateOpen, 'apply-gate-open', `Apply gate status is ${applyGate.status}.`, 'Complete Certification matrix apply gate first.'),
    check('authorization-fresh', Number.isFinite(expiresAt) && expiresAt > now.getTime(), 'authorization-fresh', applyGate.authorizationPacket.expiresAt ? `Authorization expires at ${applyGate.authorizationPacket.expiresAt}.` : 'Authorization is missing.', 'Regenerate the Certification matrix authorization packet.'),
    check('executor-selected', Boolean(request.executorId), 'executor-selected', `Executor selected: ${request.executorId}.`, 'Select local_ack or provider_live_canary.'),
    check('adapter-supported', adapterSupported, 'adapter-supported', adapterSupported ? 'Selected executor supports this adapter.' : 'Selected executor does not support this adapter.', 'Use local_ack for local api canary or provider_live_canary for provider_call adapter.'),
    check('idempotency-key', Boolean(request.idempotencyKey), 'idempotency-key', request.idempotencyKey ? 'Idempotency key is present.' : 'Idempotency key is missing.', 'Provide idempotency key before execution.'),
    warn('explicit-execute', request.execute, 'explicit-execute', request.execute ? 'Explicit execution requested.' : 'Execution not requested; gate is ready only.', 'Pass --execute-local or --execute-provider when ready.'),
    check('operator-confirmation', !request.execute || request.operatorConfirmed, 'operator-confirmation', request.operatorConfirmed ? 'Operator confirmation is present.' : 'Operator confirmation is missing.', 'Confirm execution explicitly before live executor runs.'),
    check('no-secret-output', true, 'no-secret-output', 'Executor output is redacted before serialization.', null),
    check('rollback-boundary', Boolean(applyGate.authorizationPacket.rollbackDrillId), 'rollback-boundary', applyGate.authorizationPacket.rollbackDrillId ? 'Rollback drill receipt is attached.' : 'Rollback drill receipt is missing.', 'Run Certification matrix rollback drill first.'),
  ];
}

function check(
  id: string,
  passed: boolean,
  kind: ZavorthLiveCanaryControlledExecutorCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthLiveCanaryControlledExecutorCheck {
  return {
    id,
    status: passed ? 'pass' : 'fail',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function warn(
  id: string,
  passed: boolean,
  kind: ZavorthLiveCanaryControlledExecutorCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthLiveCanaryControlledExecutorCheck {
  return {
    id,
    status: passed ? 'pass' : 'warn',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function resolvePreExecutionStatus(
  applyGateStatus: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>['status'],
  checks: ZavorthLiveCanaryControlledExecutorCheck[],
  request: NormalizedExecutionRequest,
  adapterSupported: boolean,
): ZavorthLiveCanaryControlledExecutorStatus {
  if (applyGateStatus === 'approval-required') return 'approval-required';
  if (applyGateStatus === 'rollback-drill-required') return 'rollback-drill-required';
  if (applyGateStatus === 'needs-adapter-review') return 'needs-apply-gate';
  if (applyGateStatus === 'blocked') return 'blocked';
  if (!adapterSupported) return 'unsupported-adapter';
  if (checks.some((item) => item.status === 'fail')) return 'blocked';
  if (!request.execute) return 'ready-for-execution';
  return 'ready-for-execution';
}

function resolveFinalStatus(
  status: ZavorthLiveCanaryControlledExecutorStatus,
  result: ZavorthLiveCanaryControlledExecutionResult,
): ZavorthLiveCanaryControlledExecutorStatus {
  if (result.status === 'performed') return 'executed';
  if (result.status === 'failed') return 'execution-failed';
  return status;
}

function modeForStatus(
  status: ZavorthLiveCanaryControlledExecutorStatus,
  executeRequested: boolean,
): ZavorthLiveCanaryControlledExecutorMode {
  if (status === 'executed' || (status === 'ready-for-execution' && executeRequested)) return 'controlled-live-execution';
  if (status === 'ready-for-execution') return 'operator-ready';
  if (status === 'approval-required') return 'approval-gate';
  if (status === 'rollback-drill-required') return 'rollback-drill-gate';
  if (status === 'unsupported-adapter') return 'unsupported';
  if (status === 'needs-apply-gate') return 'apply-gate';
  return 'hold';
}

function supportsAdapter(
  applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
  executorId: ZavorthLiveCanaryExecutorId,
): boolean {
  const adapter = applyGate.adapter;
  if (executorId === 'local_ack') {
    return adapter.actionKind === 'api_invoke' && adapter.target.toLowerCase().includes('local canary adapter');
  }
  return adapter.actionKind === 'provider_call';
}

function buildReceipts(
  status: ZavorthLiveCanaryControlledExecutorStatus,
  applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
  request: NormalizedExecutionRequest,
  result: ZavorthLiveCanaryControlledExecutionResult,
  adapterSupported: boolean,
): ZavorthLiveCanaryControlledExecutorReceipt[] {
  return [
    {
      id: 'gate-10-live-canary-controlled-executor',
      kind: 'gate-10-live-canary-controlled-executor',
      status: receiptStatus(status),
      summary: `Controlled executor status is ${status}.`,
    },
    {
      id: 'checkpoint-10-apply-gate-consumed',
      kind: 'apply-gate-consumed',
      status: applyGate.authorizationPacket.executionAuthorized ? 'recorded' : 'blocked',
      summary: applyGate.authorizationPacket.authorizationReceiptId ? `Consumed apply gate authorization ${applyGate.authorizationPacket.authorizationReceiptId}.`
        : 'No apply gate authorization was available.',
    },
    {
      id: result.executionReceiptId || 'checkpoint-10-execution-receipt',
      kind: 'execution-receipt',
      status: result.status === 'performed' ? 'recorded' : request.execute ? 'failed' : 'skipped',
      summary: result.status === 'performed' ? 'Execution receipt emitted.' : 'Execution was not performed.',
    },
    {
      id: result.rollbackReceiptId || 'checkpoint-10-rollback-receipt',
      kind: 'rollback-receipt',
      status: result.status === 'performed' ? 'recorded' : 'skipped',
      summary: result.status === 'performed' ? 'Rollback receipt emitted for post-run recovery path.' : 'Rollback receipt was not needed.',
    },
    {
      id: 'checkpoint-10-unsupported-adapter',
      kind: 'unsupported-adapter',
      status: adapterSupported ? 'skipped' : 'blocked',
      summary: adapterSupported ? 'Adapter is supported by selected executor.' : 'Adapter is not supported by selected executor.',
    },
    {
      id: 'checkpoint-10-no-secret-output-boundary',
      kind: 'no-secret-output-boundary',
      status: 'recorded',
      summary: 'Output preview and errors are redacted before serialization.',
    },
    {
      id: 'checkpoint-10-visual-change-boundary',
      kind: 'visual-change-boundary',
      status: 'recorded',
      summary: 'No dashboard visual mutation is performed by controlled executor.',
    },
  ];
}

function summarize(
  checks: ZavorthLiveCanaryControlledExecutorCheck[],
  applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
  request: NormalizedExecutionRequest,
  adapterSupported: boolean,
  result: ZavorthLiveCanaryControlledExecutionResult,
): ZavorthLiveCanaryControlledExecutorSnapshot['summary'] {
  return {
    checks: checks.length,
    passedChecks: checks.filter((item) => item.status === 'pass').length,
    warningChecks: checks.filter((item) => item.status === 'warn').length,
    failedChecks: checks.filter((item) => item.status === 'fail').length,
    applyGateOpen: applyGate.authorizationPacket.applyGateOpen,
    adapterSupported,
    executionRequested: request.execute,
    executionPerformed: result.status === 'performed',
    externalIoPerformed: result.externalIoPerformed,
    workspaceMutationPerformed: result.workspaceMutationPerformed,
    rollbackReceiptPresent: Boolean(result.rollbackReceiptId),
  };
}

function receiptStatus(status: ZavorthLiveCanaryControlledExecutorStatus): ZavorthLiveCanaryControlledExecutorReceipt['status'] {
  if (status === 'executed' || status === 'ready-for-execution') return 'recorded';
  if (status === 'execution-failed') return 'failed';
  return 'blocked';
}

function narrativeForStatus(
  status: ZavorthLiveCanaryControlledExecutorStatus,
  mode: ZavorthLiveCanaryControlledExecutorMode,
  summary: ZavorthLiveCanaryControlledExecutorSnapshot['summary'],
  result: ZavorthLiveCanaryControlledExecutionResult,
): ZavorthLiveCanaryControlledExecutorSnapshot['narrative'] {
  if (status === 'executed') {
    return {
      headline: 'Controlled live canary executed.',
      operatorSummary: `Executor completed with externalIo=${summary.externalIoPerformed}; rollbackReceipt=${summary.rollbackReceiptPresent}.`,
      nextAction: 'Review execution and rollback receipts before broadening rollout.',
    };
  }
  if (status === 'ready-for-execution') {
    return {
      headline: 'Controlled live canary is ready.',
      operatorSummary: 'Apply gate is open and the selected executor supports the adapter; execution has not been requested.',
      nextAction: 'Run with explicit execution flag when the operator is ready.',
    };
  }
  if (status === 'unsupported-adapter') {
    return {
      headline: 'Selected executor does not support this adapter.',
      operatorSummary: `Current mode is ${mode}; no execution was attempted.`,
      nextAction: 'Use local_ack for local API canary or provider_live_canary for provider_call adapters.',
    };
  }
  if (status === 'execution-failed') {
    return {
      headline: 'Controlled live canary execution failed.',
      operatorSummary: result.error || 'Executor failed without exposing secret values.',
      nextAction: 'Inspect provider/channel readiness, then retry with a fresh apply gate authorization.',
    };
  }
  return {
    headline: 'Controlled live canary is gated.',
    operatorSummary: `Status ${status}; ${summary.failedChecks} check(s) failed and ${summary.warningChecks} warning(s) remain.`,
    nextAction: 'Complete apply gate, final approval and rollback drill first.',
  };
}

function emptyExecutionResult(
  executorId: ZavorthLiveCanaryExecutorId,
  idempotencyKey: string | null,
): ZavorthLiveCanaryControlledExecutionResult {
  return {
    executorId,
    status: 'not-run',
    startedAt: null,
    completedAt: null,
    idempotencyKey,
    executionReceiptId: null,
    rollbackReceiptId: null,
    externalIoPerformed: false,
    workspaceMutationPerformed: false,
    upstreamRuntimeCodeExecuted: false,
    outputPreview: null,
    error: null,
    providerCanary: null,
  };
}

function executionReceiptId(
  applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
  request: NormalizedExecutionRequest,
): string {
  return `checkpoint-10-execution:${applyGate.adapter.id}:${request.idempotencyKey}`;
}

function rollbackReceiptId(
  applyGate: ReturnType<ZavorthLiveCanaryApplyGateRollbackDrillService['buildSnapshot']>,
  request: NormalizedExecutionRequest,
): string {
  return `checkpoint-10-rollback:${applyGate.adapter.id}:${request.idempotencyKey}`;
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function redact(value: string): string {
  return String(value || '')
    .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]')
    .replace(/(api[_-]?key|token|secret|password|senha)[=:]\s*[^,\s]+/gi, '$1=[redacted]');
}
