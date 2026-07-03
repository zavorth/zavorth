import {
  ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION,
  type ZavorthLiveCanaryAdapterCheck,
  type ZavorthLiveCanaryAdapterInput,
  type ZavorthLiveCanaryAdapterMode,
  type ZavorthLiveCanaryAdapterReviewReceipt,
  type ZavorthLiveCanaryAdapterReviewStatus,
  type ZavorthLiveCanaryExecutionAdapterReviewInput,
  type ZavorthLiveCanaryExecutionAdapterReviewSnapshot,
  type ZavorthLiveCanaryExecutionEnvelope,
} from '../contracts/ZavorthLiveCanaryExecutionAdapterReviewContract.js';
import type { ZavorthUxRolloutEvidenceCanaryInput } from '../contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import { ZavorthUxRolloutEvidenceCanaryService } from './ZavorthUxRolloutEvidenceCanaryService.js';

type Runtime = {
  now?: () => Date;
  uxCanary?: Pick<ZavorthUxRolloutEvidenceCanaryService, 'buildSnapshot'>;
};

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 60000;

export class ZavorthLiveCanaryExecutionAdapterReviewService {
  private readonly now: () => Date;
  private readonly uxCanary: Pick<ZavorthUxRolloutEvidenceCanaryService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.uxCanary = runtime.uxCanary || new ZavorthUxRolloutEvidenceCanaryService({
      now: this.now,
    });
  }

  public buildSnapshot(input: ZavorthLiveCanaryExecutionAdapterReviewInput = {}): ZavorthLiveCanaryExecutionAdapterReviewSnapshot {
    const generatedAt = this.now().toISOString();
    const evidenceInput = normalizeEvidenceCanaryInput(input);
    const evidenceCanary = this.uxCanary.buildSnapshot(evidenceInput);
    const adapter = normalizeAdapter(input.adapter);
    const requireRollback = input.requireRollback !== false;
    const checks = buildChecks(evidenceCanary, adapter, requireRollback);
    const status = resolveStatus(evidenceCanary, checks);
    const mode = modeForStatus(status);
    const executionEnvelope = buildEnvelope(adapter, mode, status === 'adapter-reviewed');
    const receipts = buildReceipts(status, evidenceCanary.canaryPlan.approvalAccepted, adapter, requireRollback);
    const summary = summarize(checks, adapter, evidenceCanary.canaryPlan.liveReviewReady);

    return {
      generatedAt,
      contractVersion: ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION,
      source: 'ZavorthLiveCanaryExecutionAdapterReviewService',
      phase: 'checkpoint-8-live-canary-execution-adapter-review',
      status,
      mode,
      evidenceCanary,
      adapter,
      checks,
      executionEnvelope,
      receipts,
      safety: {
        reviewOnly: true,
        noLiveActionExecuted: true,
        noExternalImpact: true,
        executionDisabledUntilFinalTrigger: true,
        ownerApprovalRequired: true,
        rollbackRequiredBeforeLive: true,
        noZavorthControlVisualMutation: true,
        rawSecretsSerialized: false,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts',
        json: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts --json',
        check: 'node scripts/zavorth-live-canary-adapter-review-check.mjs',
        nextStage: 'Certification matrix - Live Canary Apply Gate And Rollback Drill',
      },
      narrative: narrativeForStatus(status, mode, summary),
    };
  }

  public formatSnapshotText(snapshot: ZavorthLiveCanaryExecutionAdapterReviewSnapshot): string {
    const lines = [
      'Zavorth Live Canary Execution Adapter Review - ZavorthControl controls',
      '',
      `Status: ${snapshot.status}`,
      `Mode: ${snapshot.mode}`,
      `Adapter: ${snapshot.adapter.id} | ${snapshot.adapter.actionKind} | ${snapshot.adapter.surface}`,
      `Checks: ${snapshot.summary.passedChecks}/${snapshot.summary.checks} passed | rollback=${snapshot.summary.rollbackPresent} | approval=${snapshot.summary.approvalAccepted}`,
      `Execution enabled: ${snapshot.executionEnvelope.executionEnabled} | performed: ${snapshot.executionEnvelope.executionPerformed}`,
      '',
      'Checks:',
      ...snapshot.checks.map((check) => `- ${check.kind}: ${check.status} | ${check.summary}`),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }
}

function normalizeEvidenceCanaryInput(
  input: ZavorthLiveCanaryExecutionAdapterReviewInput,
): ZavorthUxRolloutEvidenceCanaryInput {
  return {
    ...(input.evidenceCanary || {}),
    canaryRequest: {
      ...(input.evidenceCanary?.canaryRequest || {}),
      mode: 'live',
      approvalId: input.ownerApproval?.approvalId || input.evidenceCanary?.canaryRequest?.approvalId || null,
      ownerConfirmed: input.ownerApproval?.ownerConfirmed ?? input.evidenceCanary?.canaryRequest?.ownerConfirmed ?? false,
    },
  };
}

function normalizeAdapter(adapter: ZavorthLiveCanaryAdapterInput | null | undefined): ZavorthLiveCanaryAdapterInput {
  if (adapter) {
    return {
      ...adapter,
      timeoutMs: adapter.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }
  return {
    id: 'checkpoint-8-default-live-canary-adapter',
    surface: 'api',
    actionKind: 'api_invoke',
    target: 'local canary adapter',
    impactDescription: 'Review live canary envelope only; execution remains disabled.',
    policyScope: 'owner-approved live canary review',
    rollbackPlan: 'No-op rollback for review envelope; actual execution must provide reversible rollback receipt.',
    dryRunReplayCommand: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts --json --live',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

function buildChecks(
  evidenceCanary: ReturnType<ZavorthUxRolloutEvidenceCanaryService['buildSnapshot']>,
  adapter: ZavorthLiveCanaryAdapterInput,
  requireRollback: boolean,
): ZavorthLiveCanaryAdapterCheck[] {
  const checks: ZavorthLiveCanaryAdapterCheck[] = [];
  checks.push(check(
    'lower-phase-live-review',
    evidenceCanary.canaryPlan.liveReviewReady,
    'lower-phase-live-review',
    evidenceCanary.canaryPlan.liveReviewReady
      ? 'UX evidence canary review is live-review ready.'
      : `UX evidence canary status is ${evidenceCanary.status}.`,
    'Resolve UX evidence or approval gate before adapter review.',
  ));
  checks.push(check(
    'owner-approval',
    evidenceCanary.canaryPlan.approvalAccepted,
    'owner-approval',
    evidenceCanary.canaryPlan.approvalAccepted ? 'Owner approval is accepted.' : 'Owner approval is missing.',
    'Provide approval id and owner confirmation.',
  ));
  checks.push(check(
    'rollback-boundary',
    !requireRollback || Boolean(adapter.rollbackPlan && adapter.rollbackPlan.trim()),
    'rollback-boundary',
    adapter.rollbackPlan ? 'Rollback plan is present.' : 'Rollback plan is missing.',
    'Add rollback plan before live canary review.',
  ));
  checks.push(check(
    'scope-boundary',
    Boolean(adapter.target.trim() && adapter.impactDescription.trim() && adapter.policyScope.trim()),
    'scope-boundary',
    'Adapter target, impact and policy scope are declared.',
    'Declare target, impact and policy scope.',
  ));
  checks.push(check(
    'dry-run-replay',
    Boolean(adapter.dryRunReplayCommand && adapter.dryRunReplayCommand.trim()),
    'dry-run-replay',
    adapter.dryRunReplayCommand ? 'Dry-run replay command is present.' : 'Dry-run replay command is missing.',
    'Add a replayable dry-run command before live review.',
  ));
  checks.push(check(
    'timeout-boundary',
    Boolean(adapter.timeoutMs && adapter.timeoutMs > 0 && adapter.timeoutMs <= MAX_TIMEOUT_MS),
    'timeout-boundary',
    `Adapter timeout is ${adapter.timeoutMs ?? 'unset'}ms.`,
    `Set timeout between 1 and ${MAX_TIMEOUT_MS}ms.`,
  ));
  checks.push(check(
    'execution-disabled',
    true,
    'execution-disabled',
    'Execution is disabled during adapter review.',
    null,
  ));
  checks.push(check(
    'visual-boundary',
    evidenceCanary.safety.noZavorthControlVisualMutation,
    'visual-boundary',
    'ZavorthControl visual mutation remains disabled.',
    null,
  ));
  return checks;
}

function check(
  id: string,
  passed: boolean,
  kind: ZavorthLiveCanaryAdapterCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthLiveCanaryAdapterCheck {
  return {
    id,
    status: passed ? 'pass' : 'fail',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function resolveStatus(
  evidenceCanary: ReturnType<ZavorthUxRolloutEvidenceCanaryService['buildSnapshot']>,
  checks: ZavorthLiveCanaryAdapterCheck[],
): ZavorthLiveCanaryAdapterReviewStatus {
  if (evidenceCanary.status === 'blocked') return 'blocked';
  if (evidenceCanary.summary.acceptedReviews < evidenceCanary.summary.scenarios) return 'needs-evidence';
  if (evidenceCanary.status === 'needs-evidence') return 'needs-evidence';
  if (evidenceCanary.status === 'approval-required') return 'approval-required';
  if (checks.some((item) => item.status === 'fail')) return 'blocked';
  return 'adapter-reviewed';
}

function modeForStatus(status: ZavorthLiveCanaryAdapterReviewStatus): ZavorthLiveCanaryAdapterMode {
  if (status === 'adapter-reviewed') return 'live-review-envelope';
  if (status === 'approval-required') return 'approval-gate';
  if (status === 'needs-evidence') return 'evidence-gate';
  return 'hold';
}

function buildEnvelope(
  adapter: ZavorthLiveCanaryAdapterInput,
  mode: ZavorthLiveCanaryAdapterMode,
  preparedForReview: boolean,
): ZavorthLiveCanaryExecutionEnvelope {
  return {
    adapterId: adapter.id,
    mode,
    surface: adapter.surface,
    actionKind: adapter.actionKind,
    targetPreview: adapter.target.slice(0, 120),
    policyScope: adapter.policyScope,
    rollbackPlanPresent: Boolean(adapter.rollbackPlan && adapter.rollbackPlan.trim()),
    dryRunReplayCommand: adapter.dryRunReplayCommand || null,
    preparedForReview,
    executionEnabled: false,
    executionPerformed: false,
    requiresFinalHumanTrigger: true,
    receiptsRequiredBeforeExecution: true,
  };
}

function buildReceipts(
  status: ZavorthLiveCanaryAdapterReviewStatus,
  approvalAccepted: boolean,
  adapter: ZavorthLiveCanaryAdapterInput,
  requireRollback: boolean,
): ZavorthLiveCanaryAdapterReviewReceipt[] {
  return [
    {
      id: 'checkpoint-8-live-canary-adapter-review',
      kind: 'checkpoint-8-live-canary-adapter-review',
      status: receiptStatus(status),
      summary: `Adapter ${adapter.id} reviewed with status ${status}.`,
    },
    {
      id: 'checkpoint-8-lower-phase-boundary',
      kind: 'lower-phase-boundary',
      status: receiptStatus(status),
      summary: 'Adapter review depends on Surface controls UX evidence canary review.',
    },
    {
      id: 'checkpoint-8-owner-approval-boundary',
      kind: 'owner-approval-boundary',
      status: approvalAccepted ? 'recorded' : 'requires-approval',
      summary: approvalAccepted ? 'Owner approval accepted.' : 'Owner approval is required before live adapter review.',
    },
    {
      id: 'checkpoint-8-rollback-boundary',
      kind: 'rollback-boundary',
      status: !requireRollback || adapter.rollbackPlan ? 'recorded' : 'blocked',
      summary: adapter.rollbackPlan ? 'Rollback plan present.' : 'Rollback plan missing.',
    },
    {
      id: 'checkpoint-8-execution-disabled-boundary',
      kind: 'execution-disabled-boundary',
      status: 'recorded',
      summary: 'Execution remains disabled; this phase only prepares a review envelope.',
    },
    {
      id: 'checkpoint-8-visual-change-boundary',
      kind: 'visual-change-boundary',
      status: 'recorded',
      summary: 'No zavorthControl visual mutation is performed by adapter review.',
    },
  ];
}

function summarize(
  checks: ZavorthLiveCanaryAdapterCheck[],
  adapter: ZavorthLiveCanaryAdapterInput,
  liveReviewReady: boolean,
): ZavorthLiveCanaryExecutionAdapterReviewSnapshot['summary'] {
  return {
    checks: checks.length,
    passedChecks: checks.filter((item) => item.status === 'pass').length,
    failedChecks: checks.filter((item) => item.status === 'fail').length,
    rollbackPresent: Boolean(adapter.rollbackPlan && adapter.rollbackPlan.trim()),
    approvalAccepted: checks.some((item) => item.kind === 'owner-approval' && item.status === 'pass'),
    liveReviewReady,
    executionEnabled: false,
  };
}

function receiptStatus(status: ZavorthLiveCanaryAdapterReviewStatus): ZavorthLiveCanaryAdapterReviewReceipt['status'] {
  if (status === 'adapter-reviewed') return 'recorded';
  if (status === 'approval-required') return 'requires-approval';
  return 'blocked';
}

function narrativeForStatus(
  status: ZavorthLiveCanaryAdapterReviewStatus,
  mode: ZavorthLiveCanaryAdapterMode,
  summary: ZavorthLiveCanaryExecutionAdapterReviewSnapshot['summary'],
): ZavorthLiveCanaryExecutionAdapterReviewSnapshot['narrative'] {
  if (status === 'adapter-reviewed') {
    return {
      headline: 'Live canary adapter review passed.',
      operatorSummary: `${summary.passedChecks}/${summary.checks} checks passed. The envelope is ready for final human-trigger review.`,
      nextAction: 'Run Certification matrix apply gate and rollback drill before enabling execution.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Live canary adapter review needs approval.',
      operatorSummary: 'UX evidence is sufficient, but owner approval is missing.',
      nextAction: 'Provide approval id and owner confirmation.',
    };
  }
  if (status === 'needs-evidence') {
    return {
      headline: 'Live canary adapter review needs UX evidence.',
      operatorSummary: `Adapter mode is ${mode}; lower evidence gate is not satisfied.`,
      nextAction: 'Collect Surface controls UX evidence first.',
    };
  }
  return {
    headline: 'Live canary adapter review is blocked.',
    operatorSummary: `${summary.failedChecks} adapter check(s) failed.`,
    nextAction: 'Fix adapter scope, rollback, timeout or lower phase gates before proceeding.',
  };
}
