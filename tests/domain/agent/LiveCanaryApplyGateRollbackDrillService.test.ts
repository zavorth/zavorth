import {
  ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION,
  ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
} from '../../../src/contracts/ZavorthLiveCanaryApplyGateRollbackDrillContract.js';
import type { ZavorthLiveCanaryAdapterInput } from '../../../src/contracts/ZavorthLiveCanaryExecutionAdapterReviewContract.js';
import type { ZavorthUxRolloutEvidenceInput } from '../../../src/contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import { ZavorthLiveCanaryApplyGateRollbackDrillService } from '../../../src/services/ZavorthLiveCanaryApplyGateRollbackDrillService.js';

describe('ZavorthLiveCanaryApplyGateRollbackDrillService', () => {
  const service = new ZavorthLiveCanaryApplyGateRollbackDrillService({
    now: () => new Date('2026-05-11T12:00:00.000Z'),
  });

  it('requires Dashboard controls adapter review before opening the apply gate', () => {
    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION);
    expect(snapshot.phase).toBe('checkpoint-9-live-canary-apply-gate-rollback-drill');
    expect(snapshot.status).toBe('needs-adapter-review');
    expect(snapshot.mode).toBe('adapter-review-gate');
    expect(snapshot.authorizationPacket.applyGateOpen).toBe(false);
    expect(snapshot.safety).toMatchObject({
      gateOnly: true,
      noLiveActionExecuted: true,
      noExternalImpactFromGate: true,
      requiresFinalHumanTrigger: true,
      rollbackDrillRequiredBeforeLive: true,
      noDashboardVisualMutation: true,
      separateExecutorRequired: true,
    });
  });

  it('requires exact final owner trigger after adapter review', () => {
    const snapshot = service.buildSnapshot({
      adapterReview: reviewedAdapterInput(),
      finalTrigger: {
        triggerId: 'trigger-1',
        ownerConfirmed: true,
        phrase: 'apply',
      },
      rollbackDrill: successfulRollbackDrill(),
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.mode).toBe('approval-gate');
    expect(snapshot.summary.finalTriggerAccepted).toBe(false);
    expect(snapshot.finalTrigger.phraseAccepted).toBe(false);
    expect(snapshot.receipts.some((receipt) =>
      receipt.kind === 'final-trigger-boundary' && receipt.status === 'requires-approval',
    )).toBe(true);
  });

  it('requires rollback drill after adapter review and final trigger', () => {
    const snapshot = service.buildSnapshot({
      adapterReview: reviewedAdapterInput(),
      finalTrigger: finalTrigger(),
    });

    expect(snapshot.status).toBe('rollback-drill-required');
    expect(snapshot.mode).toBe('rollback-drill-gate');
    expect(snapshot.summary.rollbackDrillAccepted).toBe(false);
    expect(snapshot.authorizationPacket.executionAuthorized).toBe(false);
  });

  it('blocks failed rollback drills', () => {
    const snapshot = service.buildSnapshot({
      adapterReview: reviewedAdapterInput(),
      finalTrigger: finalTrigger(),
      rollbackDrill: {
        ...successfulRollbackDrill(),
        successful: false,
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.mode).toBe('hold');
    expect(snapshot.checks.some((check) =>
      check.kind === 'rollback-drill' && check.status === 'fail',
    )).toBe(true);
  });

  it('opens a controlled apply gate without performing live execution', () => {
    const snapshot = service.buildSnapshot({
      adapterReview: reviewedAdapterInput(),
      finalTrigger: finalTrigger(),
      rollbackDrill: successfulRollbackDrill(),
    });

    expect(snapshot.status).toBe('ready-for-controlled-apply');
    expect(snapshot.mode).toBe('controlled-apply-gate');
    expect(snapshot.summary.failedChecks).toBe(0);
    expect(snapshot.summary.applyGateOpen).toBe(true);
    expect(snapshot.authorizationPacket.applyGateOpen).toBe(true);
    expect(snapshot.authorizationPacket.executionAuthorized).toBe(true);
    expect(snapshot.authorizationPacket.executionPerformed).toBe(false);
    expect(snapshot.authorizationPacket.liveActionExecutorBundled).toBe(false);
    expect(snapshot.authorizationPacket.requiresSeparateLiveInvocation).toBe(true);
    expect(snapshot.authorizationPacket.authorizationReceiptId).toBe('checkpoint-9-authorization:checkpoint-8-default-live-canary-adapter:trigger-123');
    expect(snapshot.authorizationPacket.expiresAt).toBe('2026-05-11T12:15:00.000Z');
  });

  it('blocks sensitive live targets before authorization', () => {
    const snapshot = service.buildSnapshot({
      adapterReview: reviewedAdapterInput({
        id: 'metadata-adapter',
        surface: 'api',
        actionKind: 'webhook_call',
        target: 'http://169.254.169.254/latest/meta-data',
        impactDescription: 'call metadata endpoint',
        policyScope: 'owner-approved live canary review',
        rollbackPlan: 'cancel call and revoke receipt',
        dryRunReplayCommand: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts --json',
        timeoutMs: 30000,
      }),
      finalTrigger: finalTrigger(),
      rollbackDrill: successfulRollbackDrill(),
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.checks.some((check) =>
      check.kind === 'execution-scope' && check.status === 'fail',
    )).toBe(true);
  });
});

function reviewedAdapterInput(adapter?: ZavorthLiveCanaryAdapterInput) {
  return {
    evidenceCanary: { evidence: canonicalEvidence() },
    ownerApproval: {
      approvalId: 'approval-123',
      ownerConfirmed: true,
    },
    adapter,
  };
}

function finalTrigger() {
  return {
    triggerId: 'trigger-123',
    ownerConfirmed: true,
    phrase: ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE,
    requestedBy: 'owner',
    issuedAt: '2026-05-11T12:00:00.000Z',
  };
}

function successfulRollbackDrill() {
  return {
    drillId: 'rollback-drill-123',
    performed: true,
    successful: true,
    summary: 'rollback drill replayed and restored the previous state',
    replayCommand: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts --json',
    rollbackCommand: 'npx tsx scripts/zavorth-live-canary-adapter-review.ts --json --no-defaults',
    artifacts: ['rollback-drill.log'],
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
