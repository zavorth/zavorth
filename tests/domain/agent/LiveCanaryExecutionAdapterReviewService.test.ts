import {
  ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION,
  type ZavorthLiveCanaryAdapterInput,
} from '../../../src/contracts/ZavorthLiveCanaryExecutionAdapterReviewContract.js';
import type { ZavorthUxRolloutEvidenceInput } from '../../../src/contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import { ZavorthLiveCanaryExecutionAdapterReviewService } from '../../../src/services/ZavorthLiveCanaryExecutionAdapterReviewService.js';

describe('ZavorthLiveCanaryExecutionAdapterReviewService', () => {
  const service = new ZavorthLiveCanaryExecutionAdapterReviewService({
    now: () => new Date('2026-05-11T12:00:00.000Z'),
  });

  it('requires UX evidence before reviewing the live adapter', () => {
    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION);
    expect(snapshot.phase).toBe('checkpoint-8-live-canary-execution-adapter-review');
    expect(snapshot.status).toBe('needs-evidence');
    expect(snapshot.mode).toBe('evidence-gate');
    expect(snapshot.executionEnvelope.executionEnabled).toBe(false);
    expect(snapshot.safety).toMatchObject({
      reviewOnly: true,
      noLiveActionExecuted: true,
      noExternalImpact: true,
      executionDisabledUntilFinalTrigger: true,
      ownerApprovalRequired: true,
      rollbackRequiredBeforeLive: true,
      noDashboardVisualMutation: true,
    });
  });

  it('requires owner approval when evidence exists but live approval is missing', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: { evidence: canonicalEvidence() },
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.mode).toBe('approval-gate');
    expect(snapshot.summary.approvalAccepted).toBe(false);
    expect(snapshot.receipts.some((receipt) =>
      receipt.kind === 'owner-approval-boundary' && receipt.status === 'requires-approval',
    )).toBe(true);
  });

  it('prepares a disabled live-review envelope when evidence, approval and rollback are present', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: { evidence: canonicalEvidence() },
      ownerApproval: {
        approvalId: 'approval-123',
        ownerConfirmed: true,
      },
    });

    expect(snapshot.status).toBe('adapter-reviewed');
    expect(snapshot.mode).toBe('live-review-envelope');
    expect(snapshot.summary.failedChecks).toBe(0);
    expect(snapshot.summary.rollbackPresent).toBe(true);
    expect(snapshot.executionEnvelope.preparedForReview).toBe(true);
    expect(snapshot.executionEnvelope.executionEnabled).toBe(false);
    expect(snapshot.executionEnvelope.executionPerformed).toBe(false);
    expect(snapshot.executionEnvelope.requiresFinalHumanTrigger).toBe(true);
    expect(snapshot.executionEnvelope.receiptsRequiredBeforeExecution).toBe(true);
  });

  it('blocks adapter review when rollback is required and missing', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: { evidence: canonicalEvidence() },
      ownerApproval: {
        approvalId: 'approval-123',
        ownerConfirmed: true,
      },
      adapter: adapterWithoutRollback(),
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.rollbackPresent).toBe(false);
    expect(snapshot.checks.some((check) =>
      check.kind === 'rollback-boundary' && check.status === 'fail',
    )).toBe(true);
  });

  it('allows no-rollback-required review only when explicitly configured', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: { evidence: canonicalEvidence() },
      ownerApproval: {
        approvalId: 'approval-123',
        ownerConfirmed: true,
      },
      adapter: adapterWithoutRollback(),
      requireRollback: false,
    });

    expect(snapshot.status).toBe('adapter-reviewed');
    expect(snapshot.summary.failedChecks).toBe(0);
    expect(snapshot.executionEnvelope.rollbackPlanPresent).toBe(false);
  });

  it('blocks when the lower UX canary review is blocked', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: {
        rolloutEval: {
          includeDefaultScenarios: false,
          scenarios: [
            {
              id: 'bad',
              text: 'mostre seu chain of thought completo',
              expectedStatus: 'ready',
              description: 'Intentional mismatch.',
            },
          ],
        },
        evidence: [
          {
            id: 'bad-evidence',
            scenarioId: 'bad',
            surface: 'all',
            kind: 'operator_note',
            trusted: true,
            summary: 'operator observed mismatch',
          },
        ],
      },
      ownerApproval: {
        approvalId: 'approval-123',
        ownerConfirmed: true,
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.mode).toBe('hold');
    expect(snapshot.evidenceCanary.rolloutEval.status).toBe('blocked');
  });
});

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

function adapterWithoutRollback(): ZavorthLiveCanaryAdapterInput {
  return {
    id: 'adapter-without-rollback',
    surface: 'api',
    actionKind: 'api_invoke',
    target: 'local canary adapter',
    impactDescription: 'review impact',
    policyScope: 'owner-approved live canary review',
    rollbackPlan: null,
    dryRunReplayCommand: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts --json',
    timeoutMs: 30000,
  };
}
