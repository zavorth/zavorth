import {
  ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION,
  type ZavorthLiveCanaryAdapterInput,
} from '../../../src/contracts/ZavorthLiveCanaryExecutionAdapterReviewContract.js';
import type { ZavorthUxRolloutEvidenceInput } from '../../../src/contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import { ZavorthLiveCanaryExecutionAdapterReviewService } from '../../../src/services/ZavorthLiveCanaryExecutionAdapterReviewService.js';
import { ZavorthUxRolloutEvidenceCanaryService } from '../../../src/services/ZavorthUxRolloutEvidenceCanaryService.js';
import type { ZavorthOperationalRolloutEvalSnapshot } from '../../../src/contracts/ZavorthOperationalRolloutEvalContract.js';

describe('ZavorthLiveCanaryExecutionAdapterReviewService', () => {
  const now = () => new Date('2026-05-11T12:00:00.000Z');
  
  // Mock rollout eval that always passes
  const passingRolloutEval = {
    buildSnapshot: () => ({
      status: 'passed',
      rolloutMode: 'dry_run_canary',
      strict: false,
      scenarioEvals: [],
      surfaceCoverage: [],
      projectionSamples: [],
      receipts: [],
      safety: {
        noLiveActionExecuted: true,
        noZavorthControlVisualMutation: true,
        projectionsOnly: true,
        noExternalProviderRequired: true,
        ownerApprovalRequiredForRolloutChange: true,
        continuousEvalDoesNotPersistByDefault: true,
        rawSecretsSerialized: false,
      },
      summary: {
        scenarios: 0,
        passedScenarios: 0,
        attentionScenarios: 0,
        blockedScenarios: 0,
        surfaces: 0,
        findings: 0,
        warnings: 0,
        failures: 0,
        score: 1,
      },
      commands: {
        report: 'npx tsx scripts/zavorth-operational-rollout-eval.ts',
        json: 'npx tsx scripts/zavorth-operational-rollout-eval.ts --json',
        check: 'node scripts/zavorth-operational-rollout-eval-check.mjs',
        nextAction: 'Surface controls - UX Rollout Evidence And Live Canary Review',
      },
      narrative: {
        headline: 'Operational eval passed for dry-run canary.',
        operatorSummary: '0 scenarios and 0 surfaces preserved policy, UX consistency and no-live-action boundaries.',
        nextAction: 'Proceed with dry_run_canary and collect real operator evidence.',
      },
      contractVersion: '2026-05-11.operational-rollout-eval',
      source: 'ZavorthOperationalRolloutEvalService',
      gate: 'operational-rollout-eval',
      generatedAt: new Date().toISOString(),
    }) as ZavorthOperationalRolloutEvalSnapshot,
  };

  const service = new ZavorthLiveCanaryExecutionAdapterReviewService({
    now,
    uxCanary: new ZavorthUxRolloutEvidenceCanaryService({
      now,
      rolloutEval: passingRolloutEval,
    }),
  });

  it('requires UX evidence before reviewing the live adapter', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: {
        rolloutEval: { includeDefaultScenarios: false },
      },
    });

    expect(snapshot.contractVersion).toBe(ZAVORTH_LIVE_CANARY_EXECUTION_ADAPTER_REVIEW_CONTRACT_VERSION);
    expect(snapshot.gate).toBe('live-canary-execution-adapter-review');
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
      noZavorthControlVisualMutation: true,
    });
  });

  it('blocks adapter review when evidence exists but live approval is missing', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: {
        evidence: canonicalEvidence(),
        rolloutEval: { includeDefaultScenarios: false },
        minEvidenceItems: 0,
        canaryRequest: { mode: 'live' },
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.mode).toBe('hold');
    expect(snapshot.summary.approvalAccepted).toBe(false);
    expect(snapshot.receipts.some((receipt) =>
      receipt.kind === 'owner-approval-boundary' && receipt.status === 'requires-approval',
    )).toBe(true);
  });

  it('prepares a disabled live-review envelope when evidence, approval and rollback are present', () => {
    const snapshot = service.buildSnapshot({
      evidenceCanary: {
        evidence: canonicalEvidence(),
        rolloutEval: { includeDefaultScenarios: false },
        minEvidenceItems: 0,
      },
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
      evidenceCanary: {
        evidence: canonicalEvidence(),
        rolloutEval: { includeDefaultScenarios: false },
        minEvidenceItems: 0,
      },
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
      evidenceCanary: {
        evidence: canonicalEvidence(),
        rolloutEval: { includeDefaultScenarios: false },
        minEvidenceItems: 0,
      },
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
    const blockedRolloutEval = {
      buildSnapshot: () => ({
        status: 'blocked',
        rolloutMode: 'hold',
        strict: false,
        scenarioEvals: [
          {
            id: 'bad',
            kind: 'custom',
            description: 'Intentional mismatch - projection is ready but expects blocked.',
            expectedStatus: 'blocked',
            observedStatus: 'ready',
            status: 'blocked',
            rolloutRecommendation: 'hold',
            score: 0,
            surfaces: [],
            actionCoverage: { requiredActionKind: 'blocked', coveredSurfaces: 0, expectedSurfaces: 0 },
            findings: [],
            projectionDigest: { cardCount: 0, actionCount: 0, fallbackSurfaces: 0, buttonSurfaces: 0, zavorthControlVisualMutation: false, noLiveActionExecuted: true },
          },
        ],
        surfaceCoverage: [],
        projectionSamples: [],
        receipts: [],
        safety: {
          noLiveActionExecuted: true,
          noZavorthControlVisualMutation: true,
          projectionsOnly: true,
          noExternalProviderRequired: true,
          ownerApprovalRequiredForRolloutChange: true,
          continuousEvalDoesNotPersistByDefault: true,
          rawSecretsSerialized: false,
        },
        summary: {
          scenarios: 1,
          passedScenarios: 0,
          attentionScenarios: 0,
          blockedScenarios: 1,
          surfaces: 0,
          findings: 0,
          warnings: 0,
          failures: 0,
          score: 0,
        },
        commands: {
          report: 'npx tsx scripts/zavorth-operational-rollout-eval.ts',
          json: 'npx tsx scripts/zavorth-operational-rollout-eval.ts --json',
          check: 'node scripts/zavorth-operational-rollout-eval-check.mjs',
          nextAction: 'Surface controls - UX Rollout Evidence And Live Canary Review',
        },
        narrative: {
          headline: 'Operational eval is blocked.',
          operatorSummary: '1 failure(s) require repair before rollout.',
          nextAction: 'Hold rollout and fix failing scenario or surface projection.',
        },
        contractVersion: '2026-05-11.operational-rollout-eval',
        source: 'ZavorthOperationalRolloutEvalService',
        gate: 'operational-rollout-eval',
        generatedAt: new Date().toISOString(),
      }) as ZavorthOperationalRolloutEvalSnapshot,
    };

    const service = new ZavorthLiveCanaryExecutionAdapterReviewService({
      now,
      uxCanary: new ZavorthUxRolloutEvidenceCanaryService({
        now,
        rolloutEval: blockedRolloutEval,
      }),
    });

    const snapshot = service.buildSnapshot({
      evidenceCanary: {
        rolloutEval: blockedRolloutEval,
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
        minEvidenceItems: 0,
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
