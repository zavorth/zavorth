import {
  ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION,
  ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
  type ZavorthLiveCanaryApplyAuthorizationPacket,
  type ZavorthLiveCanaryApplyGateCheck,
  type ZavorthLiveCanaryApplyGateMode,
  type ZavorthLiveCanaryApplyGateReceipt,
  type ZavorthLiveCanaryApplyGateRollbackDrillInput,
  type ZavorthLiveCanaryApplyGateRollbackDrillSnapshot,
  type ZavorthLiveCanaryApplyGateStatus,
  type ZavorthLiveCanaryFinalTriggerInput,
  type ZavorthLiveCanaryRollbackDrillInput,
} from '../contracts/ZavorthLiveCanaryApplyGateRollbackDrillContract.js';
import { ZavorthLiveCanaryExecutionAdapterReviewService } from './ZavorthLiveCanaryExecutionAdapterReviewService.js';

type Runtime = {
  now?: () => Date;
  adapterReview?: Pick<ZavorthLiveCanaryExecutionAdapterReviewService, 'buildSnapshot'>;
};

type NormalizedFinalTrigger = Required<Pick<ZavorthLiveCanaryFinalTriggerInput, 'triggerId' | 'ownerConfirmed' | 'phrase'>> & {
  requestedBy: string | null;
  issuedAt: string | null;
  phraseAccepted: boolean;
};

type NormalizedRollbackDrill = Required<Pick<ZavorthLiveCanaryRollbackDrillInput, 'drillId' | 'performed' | 'successful' | 'summary' | 'replayCommand' | 'rollbackCommand'>> & {
  artifacts: string[];
};

const AUTHORIZATION_TTL_MS = 15 * 60 * 1000;

export class ZavorthLiveCanaryApplyGateRollbackDrillService {
  private readonly now: () => Date;
  private readonly adapterReview: Pick<ZavorthLiveCanaryExecutionAdapterReviewService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapterReview = runtime.adapterReview || new ZavorthLiveCanaryExecutionAdapterReviewService({
      now: this.now,
    });
  }

  public buildSnapshot(input: ZavorthLiveCanaryApplyGateRollbackDrillInput = {}): ZavorthLiveCanaryApplyGateRollbackDrillSnapshot {
    const generatedAt = this.now().toISOString();
    const adapterReview = this.adapterReview.buildSnapshot(input.adapterReview || {});
    const adapter = adapterReview.adapter;
    const finalTrigger = normalizeFinalTrigger(input.finalTrigger);
    const rollbackDrill = normalizeRollbackDrill(input.rollbackDrill);
    const checks = buildChecks(adapterReview, finalTrigger, rollbackDrill);
    const status = resolveStatus(adapterReview.status, finalTrigger, rollbackDrill, checks);
    const mode = modeForStatus(status);
    const authorizationPacket = buildAuthorizationPacket(
      adapterReview,
      finalTrigger,
      rollbackDrill,
      status === 'ready-for-controlled-apply',
      this.now(),
    );
    const receipts = buildReceipts(status, adapterReview.status, finalTrigger, rollbackDrill, authorizationPacket);
    const summary = summarize(checks, status, adapterReview.status, finalTrigger, rollbackDrill);

    return {
      generatedAt,
      contractVersion: ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION,
      source: 'ZavorthLiveCanaryApplyGateRollbackDrillService',
      gate: 'live-canary-apply-gate-rollback-drill',
      status,
      mode,
      adapterReview,
      adapter,
      finalTrigger,
      rollbackDrill,
      checks,
      authorizationPacket,
      receipts,
      safety: {
        gateOnly: true,
        noLiveActionExecuted: true,
        noExternalImpactFromGate: true,
        requiresFinalHumanTrigger: true,
        rollbackDrillRequiredBeforeLive: true,
        noZavorthControlVisualMutation: true,
        rawSecretsSerialized: false,
        separateExecutorRequired: true,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-live-canary-apply-gate.ts',
        json: 'npx tsx scripts/zavorth-live-canary-apply-gate.ts --json',
        check: 'node scripts/zavorth-live-canary-apply-gate-check.mjs',
      },
      narrative: narrativeForStatus(status, mode, summary),
    };
  }

  public formatSnapshotText(snapshot: ZavorthLiveCanaryApplyGateRollbackDrillSnapshot): string {
    const lines = [
      'Zavorth Live Canary Apply Gate And Rollback Drill - Certification matrix',
      '',
      `Status: ${snapshot.status}`,
      `Mode: ${snapshot.mode}`,
      `Adapter: ${snapshot.adapter.id} | ${snapshot.adapter.actionKind} | ${snapshot.adapter.surface}`,
      `Checks: ${snapshot.summary.passedChecks}/${snapshot.summary.checks} passed | finalTrigger=${snapshot.summary.finalTriggerAccepted} | rollbackDrill=${snapshot.summary.rollbackDrillAccepted}`,
      `Apply gate open: ${snapshot.authorizationPacket.applyGateOpen} | authorized=${snapshot.authorizationPacket.executionAuthorized} | performed=${snapshot.authorizationPacket.executionPerformed}`,
      '',
      'Checks:',
      ...snapshot.checks.map((check) => `- ${check.kind}: ${check.status} | ${check.summary}`),
      '',
      `Required final phrase: ${snapshot.authorizationPacket.requiredFinalPhrase}`,
    ];
    return lines.join('\n');
  }
}

function normalizeFinalTrigger(trigger: ZavorthLiveCanaryFinalTriggerInput | null | undefined): NormalizedFinalTrigger {
  const phrase = trigger?.phrase?.trim() || '';
  return {
    triggerId: trigger?.triggerId?.trim() || null,
    ownerConfirmed: trigger?.ownerConfirmed === true,
    phrase,
    requestedBy: trigger?.requestedBy?.trim() || null,
    issuedAt: trigger?.issuedAt?.trim() || null,
    phraseAccepted: phrase.toUpperCase() === ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
  };
}

function normalizeRollbackDrill(drill: ZavorthLiveCanaryRollbackDrillInput | null | undefined): NormalizedRollbackDrill {
  return {
    drillId: drill?.drillId?.trim() || null,
    performed: drill?.performed === true,
    successful: drill?.successful === true,
    summary: drill?.summary?.trim() || '',
    replayCommand: drill?.replayCommand?.trim() || '',
    rollbackCommand: drill?.rollbackCommand?.trim() || '',
    artifacts: Array.isArray(drill?.artifacts)
      ? drill.artifacts.map((item) => item.trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

function buildChecks(
  adapterReview: ReturnType<ZavorthLiveCanaryExecutionAdapterReviewService['buildSnapshot']>,
  finalTrigger: NormalizedFinalTrigger,
  rollbackDrill: NormalizedRollbackDrill,
): ZavorthLiveCanaryApplyGateCheck[] {
  const adapter = adapterReview.adapter;
  return [
    check(
      'adapter-review-ready',
      adapterReview.status === 'adapter-reviewed' && adapterReview.executionEnvelope.preparedForReview && adapterReview.executionEnvelope.executionEnabled === false,
      'adapter-review-ready',
      `Adapter review status is ${adapterReview.status}.`,
      'Complete ZavorthControl controls adapter review before opening the apply gate.',
    ),
    check(
      'final-owner-trigger',
      Boolean(finalTrigger.triggerId && finalTrigger.ownerConfirmed && finalTrigger.phraseAccepted),
      'final-owner-trigger',
      finalTrigger.phraseAccepted ? 'Final owner trigger phrase is accepted.'
        : `Final phrase must be exactly "${ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE}".`,
      'Provide trigger id, owner confirmation and exact final phrase.',
    ),
    check(
      'rollback-drill',
      Boolean(rollbackDrill.drillId && rollbackDrill.performed && rollbackDrill.successful && rollbackDrill.summary),
      'rollback-drill',
      rollbackDrill.performed ? `Rollback drill ${rollbackDrill.drillId || 'without-id'} completed with success=${rollbackDrill.successful}.`
        : 'Rollback drill is missing.',
      'Run a rollback drill and provide a successful receipt before live apply.',
    ),
    check(
      'rollback-replay',
      Boolean(rollbackDrill.replayCommand && rollbackDrill.rollbackCommand),
      'rollback-replay',
      rollbackDrill.replayCommand && rollbackDrill.rollbackCommand ? 'Replay and rollback commands are present.'
        : 'Replay or rollback command is missing.',
      'Attach replay and rollback commands to make the canary reversible.',
    ),
    check(
      'execution-scope',
      Boolean(adapter.target.trim() && adapter.policyScope.trim() && adapter.impactDescription.trim() && !containsSensitiveTarget(adapter)),
      'execution-scope',
      containsSensitiveTarget(adapter) ? 'Adapter target or impact looks sensitive.'
        : 'Adapter target, impact and policy scope are bounded.',
      'Narrow the adapter target or replace sensitive target text before apply.',
    ),
    check(
      'receipt-chain',
      adapterReview.receipts.some((receipt) => receipt.kind === 'gate-8-live-canary-adapter-review' && receipt.status === 'recorded'),
      'receipt-chain',
      'ZavorthControl controls adapter review receipt chain is present.',
      'Re-run ZavorthControl controls review to produce recorded receipts.',
    ),
    check(
      'no-implicit-execution',
      adapterReview.executionEnvelope.executionPerformed === false,
      'no-implicit-execution',
      'No execution was performed by review or apply gate.',
      'Stop and inspect the adapter: the gate must never execute implicitly.',
    ),
    check(
      'visual-boundary',
      adapterReview.safety.noZavorthControlVisualMutation,
      'visual-boundary',
      'ZavorthControl visual mutation remains disabled.',
      null,
    ),
  ];
}

function check(
  id: string,
  passed: boolean,
  kind: ZavorthLiveCanaryApplyGateCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthLiveCanaryApplyGateCheck {
  return {
    id,
    status: passed ? 'pass' : 'fail',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function resolveStatus(
  adapterReviewStatus: ReturnType<ZavorthLiveCanaryExecutionAdapterReviewService['buildSnapshot']>['status'],
  finalTrigger: NormalizedFinalTrigger,
  rollbackDrill: NormalizedRollbackDrill,
  checks: ZavorthLiveCanaryApplyGateCheck[],
): ZavorthLiveCanaryApplyGateStatus {
  if (adapterReviewStatus === 'blocked') return 'blocked';
  if (adapterReviewStatus === 'needs-evidence') return 'needs-adapter-review';
  if (adapterReviewStatus === 'approval-required') return 'approval-required';
  if (adapterReviewStatus !== 'adapter-reviewed') return 'needs-adapter-review';
  if (!finalTrigger.triggerId || !finalTrigger.ownerConfirmed || !finalTrigger.phraseAccepted) return 'approval-required';
  if (!rollbackDrill.drillId || !rollbackDrill.performed) return 'rollback-drill-required';
  if (!rollbackDrill.successful) return 'blocked';
  if (checks.some((item) => item.status === 'fail')) return 'blocked';
  return 'ready-for-controlled-apply';
}

function modeForStatus(status: ZavorthLiveCanaryApplyGateStatus): ZavorthLiveCanaryApplyGateMode {
  if (status === 'ready-for-controlled-apply') return 'controlled-apply-gate';
  if (status === 'needs-adapter-review') return 'adapter-review-gate';
  if (status === 'approval-required') return 'approval-gate';
  if (status === 'rollback-drill-required') return 'rollback-drill-gate';
  return 'hold';
}

function buildAuthorizationPacket(
  adapterReview: ReturnType<ZavorthLiveCanaryExecutionAdapterReviewService['buildSnapshot']>,
  finalTrigger: NormalizedFinalTrigger,
  rollbackDrill: NormalizedRollbackDrill,
  authorized: boolean,
  now: Date,
): ZavorthLiveCanaryApplyAuthorizationPacket {
  const adapter = adapterReview.adapter;
  return {
    adapterId: adapter.id,
    surface: adapter.surface,
    actionKind: adapter.actionKind,
    targetPreview: adapterReview.executionEnvelope.targetPreview,
    policyScope: adapter.policyScope,
    applyGateOpen: authorized,
    executionAuthorized: authorized,
    executionPerformed: false,
    liveActionExecutorBundled: false,
    requiresSeparateLiveInvocation: true,
    rollbackDrillReceiptRequired: true,
    finalTriggerId: authorized ? finalTrigger.triggerId : null,
    rollbackDrillId: authorized ? rollbackDrill.drillId : null,
    authorizationReceiptId: authorized ? `gate-9-authorization:${adapter.id}:${finalTrigger.triggerId}` : null,
    expiresAt: authorized ? new Date(now.getTime() + AUTHORIZATION_TTL_MS).toISOString() : null,
    requiredFinalPhrase: ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
    conditions: [
      'A separate live adapter invocation must consume this authorization receipt.',
      'The adapter must emit execution and rollback receipts.',
      'The authorization expires quickly and must not be reused across targets.',
      'No zavorthControl visual mutation is authorized by this packet.',
    ],
  };
}

function buildReceipts(
  status: ZavorthLiveCanaryApplyGateStatus,
  adapterReviewStatus: ReturnType<ZavorthLiveCanaryExecutionAdapterReviewService['buildSnapshot']>['status'],
  finalTrigger: NormalizedFinalTrigger,
  rollbackDrill: NormalizedRollbackDrill,
  authorizationPacket: ZavorthLiveCanaryApplyAuthorizationPacket,
): ZavorthLiveCanaryApplyGateReceipt[] {
  return [
    {
      id: 'gate-9-live-canary-apply-gate',
      kind: 'gate-9-live-canary-apply-gate',
      status: receiptStatus(status),
      summary: `Apply gate status is ${status}.`,
    },
    {
      id: 'gate-9-adapter-review-chain',
      kind: 'adapter-review-chain',
      status: adapterReviewStatus === 'adapter-reviewed' ? 'recorded' : receiptStatus(status),
      summary: `ZavorthControl controls adapter review status is ${adapterReviewStatus}.`,
    },
    {
      id: 'gate-9-final-trigger-boundary',
      kind: 'final-trigger-boundary',
      status: finalTrigger.triggerId && finalTrigger.ownerConfirmed && finalTrigger.phraseAccepted ? 'recorded' : 'requires-approval',
      summary: finalTrigger.phraseAccepted ? 'Final trigger phrase accepted.' : 'Final owner trigger is required.',
    },
    {
      id: 'gate-9-rollback-drill-boundary',
      kind: 'rollback-drill-boundary',
      status: rollbackDrill.drillId && rollbackDrill.performed && rollbackDrill.successful ? 'recorded' : 'blocked',
      summary: rollbackDrill.successful ? 'Rollback drill succeeded.' : 'Rollback drill is required before apply.',
    },
    {
      id: 'gate-9-execution-scope-boundary',
      kind: 'execution-scope-boundary',
      status: authorizationPacket.executionAuthorized ? 'recorded' : receiptStatus(status),
      summary: authorizationPacket.executionAuthorized ? `Authorization receipt ${authorizationPacket.authorizationReceiptId} created.`
        : 'Execution authorization was not issued.',
    },
    {
      id: 'gate-9-no-implicit-execution-boundary',
      kind: 'no-implicit-execution-boundary',
      status: 'recorded',
      summary: 'The apply gate produced authorization only; no live action was executed.',
    },
    {
      id: 'gate-9-visual-change-boundary',
      kind: 'visual-change-boundary',
      status: 'recorded',
      summary: 'No zavorthControl visual mutation is performed by the apply gate.',
    },
  ];
}

function summarize(
  checks: ZavorthLiveCanaryApplyGateCheck[],
  status: ZavorthLiveCanaryApplyGateStatus,
  adapterReviewStatus: ReturnType<ZavorthLiveCanaryExecutionAdapterReviewService['buildSnapshot']>['status'],
  finalTrigger: NormalizedFinalTrigger,
  rollbackDrill: NormalizedRollbackDrill,
): ZavorthLiveCanaryApplyGateRollbackDrillSnapshot['summary'] {
  return {
    checks: checks.length,
    passedChecks: checks.filter((item) => item.status === 'pass').length,
    failedChecks: checks.filter((item) => item.status === 'fail').length,
    adapterReviewed: adapterReviewStatus === 'adapter-reviewed',
    finalTriggerAccepted: Boolean(finalTrigger.triggerId && finalTrigger.ownerConfirmed && finalTrigger.phraseAccepted),
    rollbackDrillAccepted: Boolean(rollbackDrill.drillId && rollbackDrill.performed && rollbackDrill.successful),
    applyGateOpen: status === 'ready-for-controlled-apply',
    executionAuthorized: status === 'ready-for-controlled-apply',
    executionPerformed: false,
  };
}

function receiptStatus(status: ZavorthLiveCanaryApplyGateStatus): ZavorthLiveCanaryApplyGateReceipt['status'] {
  if (status === 'ready-for-controlled-apply') return 'recorded';
  if (status === 'approval-required') return 'requires-approval';
  return 'blocked';
}

function narrativeForStatus(
  status: ZavorthLiveCanaryApplyGateStatus,
  mode: ZavorthLiveCanaryApplyGateMode,
  summary: ZavorthLiveCanaryApplyGateRollbackDrillSnapshot['summary'],
): ZavorthLiveCanaryApplyGateRollbackDrillSnapshot['narrative'] {
  if (status === 'ready-for-controlled-apply') {
    return {
      headline: 'Live canary apply gate is open.',
      operatorSummary: `${summary.passedChecks}/${summary.checks} checks passed. A short-lived authorization packet was issued without executing a live action.`,
      nextAction: 'Pass the authorization receipt to the live adapter executor and capture execution plus rollback receipts.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Live canary apply gate needs final owner trigger.',
      operatorSummary: `Apply mode is ${mode}; exact final phrase and owner confirmation are required.`,
      nextAction: `Confirm with the exact phrase "${ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE}".`,
    };
  }
  if (status === 'rollback-drill-required') {
    return {
      headline: 'Live canary apply gate needs a rollback drill.',
      operatorSummary: 'Adapter review and final trigger can proceed only after a successful rollback drill receipt.',
      nextAction: 'Run the rollback drill, record replay and rollback commands, then retry the apply gate.',
    };
  }
  if (status === 'needs-adapter-review') {
    return {
      headline: 'Live canary apply gate needs adapter review.',
      operatorSummary: 'ZavorthControl controls adapter review is not recorded as adapter-reviewed.',
      nextAction: 'Complete ZavorthControl controls evidence, approval and adapter review first.',
    };
  }
  return {
    headline: 'Live canary apply gate is blocked.',
    operatorSummary: `${summary.failedChecks} apply gate check(s) failed.`,
    nextAction: 'Fix failed checks before trying to authorize a controlled apply.',
  };
}

function containsSensitiveTarget(adapter: ReturnType<ZavorthLiveCanaryExecutionAdapterReviewService['buildSnapshot']>['adapter']): boolean {
  const text = [
    adapter.target,
    adapter.impactDescription,
    adapter.policyScope,
  ].join('\n').toLowerCase();
  return [
    '169.254.169.254',
    'metadata.google.internal',
    'rm -rf',
    'format c:',
    'del /f /s /q',
    'powershell -enc',
    'invoke-expression',
  ].some((needle) => text.includes(needle));
}
