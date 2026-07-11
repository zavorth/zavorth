import {
  ZAVORTH_UX_ROLLOUT_EVIDENCE_CANARY_CONTRACT_VERSION,
  type ZavorthUxEvidenceReview,
  type ZavorthUxEvidenceSanitizedItem,
  type ZavorthUxRolloutCanaryMode,
  type ZavorthUxRolloutCanaryPlan,
  type ZavorthUxRolloutEvidenceCanaryInput,
  type ZavorthUxRolloutEvidenceCanarySnapshot,
  type ZavorthUxRolloutEvidenceCanaryStatus,
  type ZavorthUxRolloutEvidenceInput,
  type ZavorthUxRolloutReceipt,
} from '../contracts/ZavorthUxRolloutEvidenceCanaryContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type {
  ZavorthOperationalRolloutEvalInput,
  ZavorthOperationalRolloutEvalSnapshot,
  ZavorthOperationalRolloutScenarioEval,
} from '../contracts/ZavorthOperationalRolloutEvalContract.js';
import { ZavorthOperationalRolloutEvalService } from './ZavorthOperationalRolloutEvalService.js';

type Runtime = {
  now?: () => Date;
  rolloutEval?: Pick<ZavorthOperationalRolloutEvalService, 'buildSnapshot'>;
};

const MIN_DEFAULT_EVIDENCE_ITEMS = 2;

export class ZavorthUxRolloutEvidenceCanaryService {
  private readonly now: () => Date;
  private readonly rolloutEval: Pick<ZavorthOperationalRolloutEvalService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rolloutEval = runtime.rolloutEval || new ZavorthOperationalRolloutEvalService({
      now: this.now,
    });
  }

  public buildSnapshot(input: ZavorthUxRolloutEvidenceCanaryInput = {}): ZavorthUxRolloutEvidenceCanarySnapshot {
    const generatedAt = this.now().toISOString();
    const rolloutEval = this.rolloutEval.buildSnapshot(input.rolloutEval || {});
    const sanitizedEvidence = sanitizeEvidence(input.evidence || []);
    const requireEvidenceForAllSurfaces = input.requireEvidenceForAllSurfaces === true;
    const minEvidenceItems = Math.max(0, input.minEvidenceItems ?? MIN_DEFAULT_EVIDENCE_ITEMS);
    const evidenceReviews = buildEvidenceReviews(rolloutEval, sanitizedEvidence, requireEvidenceForAllSurfaces);
    const canaryPlan = buildCanaryPlan({
      rolloutEval,
      evidenceReviews,
      sanitizedEvidence,
      minEvidenceItems,
      requestMode: input.canaryRequest?.mode || 'dry_run',
      approvalId: input.canaryRequest?.approvalId || null,
      ownerConfirmed: input.canaryRequest?.ownerConfirmed === true,
    });
    const status = resolveStatus(rolloutEval, evidenceReviews, canaryPlan, minEvidenceItems);
    const receipts = buildReceipts(status, canaryPlan, sanitizedEvidence, evidenceReviews);
    const summary = summarize(rolloutEval, sanitizedEvidence, evidenceReviews, canaryPlan);

    return {
      generatedAt,
      contractVersion: ZAVORTH_UX_ROLLOUT_EVIDENCE_CANARY_CONTRACT_VERSION,
      source: 'ZavorthUxRolloutEvidenceCanaryService',
      gate: 'ux-rollout-evidence-canary',
      status,
      rolloutEval,
      sanitizedEvidence,
      evidenceReviews,
      canaryPlan,
      receipts,
      safety: {
        evidenceOnly: true,
        noLiveActionExecuted: true,
        noZavorthControlVisualMutation: true,
        liveCanaryRequiresOwnerApproval: true,
        evidenceMustBeRedacted: true,
        evidenceNotPersistedByDefault: true,
        noExternalProviderRequired: true,
        rawSecretsSerialized: false,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts',
        json: 'npx tsx scripts/zavorth-ux-rollout-evidence-canary.ts --json',
        check: 'node scripts/zavorth-ux-rollout-evidence-canary-check.mjs',
        nextStage: 'ZavorthControl controls - Live Canary Execution Adapter Review',
      },
      narrative: narrativeForStatus(status, canaryPlan, summary),
    };
  }

  public formatSnapshotText(snapshot: ZavorthUxRolloutEvidenceCanarySnapshot): string {
    const lines = [
      'Zavorth UX Rollout Evidence And Canary Review - Surface controls',
      '',
      `Status: ${snapshot.status}`,
      `Canary mode: ${snapshot.canaryPlan.mode}`,
      `Evidence: ${snapshot.summary.evidenceItems} | accepted=${snapshot.summary.acceptedReviews} | missing=${snapshot.summary.missingReviews} | untrusted=${snapshot.summary.untrustedReviews} | redacted=${snapshot.summary.redactedEvidenceItems}`,
      `Execution prepared: ${snapshot.canaryPlan.executionPrepared} | performed: ${snapshot.canaryPlan.executionPerformed}`,
      '',
      'Evidence reviews:',
      ...snapshot.evidenceReviews.slice(0, 16).map((review) => `- ${review.scenarioId}/${review.surface}: ${review.status} | ${review.summary}`),
      '',
      'Canary next actions:',
      ...snapshot.canaryPlan.nextActions.map((action) => `- ${action}`),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }
}

function sanitizeEvidence(items: ZavorthUxRolloutEvidenceInput[]): ZavorthUxEvidenceSanitizedItem[] {
  return items.map((item) => {
    const redacted = redactText(item.summary);
    return {
      id: item.id,
      scenarioId: item.scenarioId || null,
      surface: item.surface || null,
      kind: item.kind,
      source: item.source || 'operator',
      capturedAt: item.capturedAt || null,
      trusted: item.trusted !== false,
      redacted: redacted.redacted,
      summaryPreview: redacted.text.slice(0, 240),
    };
  });
}

function buildEvidenceReviews(
  rolloutEval: ZavorthOperationalRolloutEvalSnapshot,
  evidence: ZavorthUxEvidenceSanitizedItem[],
  requireEvidenceForAllSurfaces: boolean,
): ZavorthUxEvidenceReview[] {
  const reviews: ZavorthUxEvidenceReview[] = [];
  for (const scenario of rolloutEval.scenarioEvals) {
    const scenarioEvidence = evidence.filter((item) => !item.scenarioId || item.scenarioId === scenario.id);
    reviews.push(reviewScenario(scenario, scenarioEvidence));
    if (requireEvidenceForAllSurfaces) {
      for (const surface of scenario.surfaces) {
        reviews.push(reviewSurface(scenario.id, surface, scenarioEvidence));
      }
    }
  }
  return reviews;
}

function reviewScenario(
  scenario: ZavorthOperationalRolloutScenarioEval,
  evidence: ZavorthUxEvidenceSanitizedItem[],
): ZavorthUxEvidenceReview {
  const accepted = evidence.filter((item) => item.trusted);
  const untrusted = evidence.filter((item) => !item.trusted);
  if (accepted.length > 0) {
    const redacted = accepted.some((item) => item.redacted);
    return {
      id: `review-${scenario.id}-all`,
      scenarioId: scenario.id,
      surface: 'all',
      status: redacted ? 'redacted' : 'accepted',
      evidenceIds: accepted.map((item) => item.id),
      summary: redacted ? 'Evidence accepted after redaction.' : 'Evidence accepted for scenario.',
      recommendation: null,
    };
  }
  if (untrusted.length > 0) {
    return {
      id: `review-${scenario.id}-all`,
      scenarioId: scenario.id,
      surface: 'all',
      status: 'untrusted',
      evidenceIds: untrusted.map((item) => item.id),
      summary: 'Only untrusted evidence was provided for scenario.',
      recommendation: 'Provide trusted operator evidence before canary review.',
    };
  }
  return {
    id: `review-${scenario.id}-all`,
    scenarioId: scenario.id,
    surface: 'all',
    status: 'missing',
    evidenceIds: [],
    summary: 'No UX evidence provided for scenario.',
    recommendation: 'Attach screenshot, transcript, CLI output, API payload or operator note.',
  };
}

function reviewSurface(
  scenarioId: string,
  surface: ZavorthCrossSurfaceProjectionSurface,
  evidence: ZavorthUxEvidenceSanitizedItem[],
): ZavorthUxEvidenceReview {
  const matching = evidence.filter((item) => item.surface === surface || item.surface === 'all');
  const accepted = matching.filter((item) => item.trusted);
  if (accepted.length > 0) {
    return {
      id: `review-${scenarioId}-${surface}`,
      scenarioId,
      surface,
      status: accepted.some((item) => item.redacted) ? 'redacted' : 'accepted',
      evidenceIds: accepted.map((item) => item.id),
      summary: `${surface} has trusted UX evidence.`,
      recommendation: null,
    };
  }
  return {
    id: `review-${scenarioId}-${surface}`,
    scenarioId,
    surface,
    status: matching.length > 0 ? 'untrusted' : 'missing',
    evidenceIds: matching.map((item) => item.id),
    summary: matching.length > 0 ? `${surface} evidence is untrusted.` : `${surface} evidence is missing.`,
    recommendation: `Capture ${surface} evidence before live canary review.`,
  };
}

function buildCanaryPlan(input: {
  rolloutEval: ZavorthOperationalRolloutEvalSnapshot;
  evidenceReviews: ZavorthUxEvidenceReview[];
  sanitizedEvidence: ZavorthUxEvidenceSanitizedItem[];
  minEvidenceItems: number;
  requestMode: 'dry_run' | 'live';
  approvalId: string | null;
  ownerConfirmed: boolean;
}): ZavorthUxRolloutCanaryPlan {
  const reasons: string[] = [];
  const nextActions: string[] = [];
  const acceptedScenarioReviews = input.evidenceReviews.filter((review) =>
    review.surface === 'all' && (review.status === 'accepted' || review.status === 'redacted'),
  ).length;
  const hasMinimumEvidence = input.sanitizedEvidence.filter((item) => item.trusted).length >= input.minEvidenceItems;
  const rolloutPassed = input.rolloutEval.status === 'passed';

  if (!rolloutPassed) reasons.push(`rollout eval is ${input.rolloutEval.status}`);
  if (!hasMinimumEvidence) reasons.push(`trusted evidence below minimum ${input.minEvidenceItems}`);
  if (acceptedScenarioReviews < input.rolloutEval.summary.scenarios) {
    reasons.push('not every scenario has accepted UX evidence');
  }

  const dryRunReady = rolloutPassed && hasMinimumEvidence && acceptedScenarioReviews >= input.rolloutEval.summary.scenarios;
  const approvalAccepted = Boolean(input.approvalId && input.ownerConfirmed);
  const liveApprovalRequired = input.requestMode === 'live' && !approvalAccepted;
  const liveReviewReady = dryRunReady && input.requestMode === 'live' && approvalAccepted;

  if (!dryRunReady) nextActions.push('Collect trusted UX evidence for every canonical scenario.');
  if (dryRunReady) nextActions.push('Run dry-run canary and collect operator evidence.');
  if (input.requestMode === 'live' && !approvalAccepted) nextActions.push('Request owner approval before preparing live canary review.');
  if (liveReviewReady) nextActions.push('Prepare live canary review envelope without executing live actions.');

  return {
    mode: resolveCanaryMode(input.requestMode, dryRunReady, liveReviewReady, liveApprovalRequired),
    dryRunReady,
    liveReviewReady,
    liveApprovalRequired,
    approvalAccepted,
    executionPrepared: false,
    executionPerformed: false,
    reasons,
    nextActions,
  };
}

function resolveCanaryMode(
  requestMode: 'dry_run' | 'live',
  dryRunReady: boolean,
  liveReviewReady: boolean,
  liveApprovalRequired: boolean,
): ZavorthUxRolloutCanaryMode {
  if (liveReviewReady) return 'live_canary_review';
  if (liveApprovalRequired) return 'evidence_review';
  if (dryRunReady && requestMode === 'dry_run') return 'dry_run_canary';
  if (dryRunReady) return 'evidence_review';
  return 'hold';
}

function resolveStatus(
  rolloutEval: ZavorthOperationalRolloutEvalSnapshot,
  evidenceReviews: ZavorthUxEvidenceReview[],
  canaryPlan: ZavorthUxRolloutCanaryPlan,
  minEvidenceItems: number,
): ZavorthUxRolloutEvidenceCanaryStatus {
  if (rolloutEval.status === 'blocked') return 'blocked';
  if (canaryPlan.liveApprovalRequired) return 'approval-required';
  const acceptedEvidence = evidenceReviews.filter((review) =>
    review.surface === 'all' && (review.status === 'accepted' || review.status === 'redacted'),
  ).length;
  if (!canaryPlan.dryRunReady || acceptedEvidence < minEvidenceItems) return 'needs-evidence';
  return 'ready-for-dry-run-canary';
}

function buildReceipts(
  status: ZavorthUxRolloutEvidenceCanaryStatus,
  canaryPlan: ZavorthUxRolloutCanaryPlan,
  evidence: ZavorthUxEvidenceSanitizedItem[],
  reviews: ZavorthUxEvidenceReview[],
): ZavorthUxRolloutReceipt[] {
  const receipts: ZavorthUxRolloutReceipt[] = [
    {
      id: 'checkpoint-7-ux-evidence-review',
      kind: 'checkpoint-7-ux-evidence-review',
      status: receiptStatus(status),
      summary: `${reviews.length} evidence review entries evaluated.`,
    },
    {
      id: 'checkpoint-7-canary-plan',
      kind: 'canary-plan',
      status: receiptStatus(status),
      summary: `Canary mode ${canaryPlan.mode}; dryRunReady=${canaryPlan.dryRunReady}; liveReviewReady=${canaryPlan.liveReviewReady}.`,
    },
    {
      id: 'checkpoint-7-visual-change-boundary',
      kind: 'visual-change-boundary',
      status: 'recorded',
      summary: 'No zavorthControl visual mutation is performed by canary review.',
    },
    {
      id: 'checkpoint-7-no-persistence-boundary',
      kind: 'no-persistence-boundary',
      status: 'recorded',
      summary: 'Evidence is reviewed from input and is not persisted by default.',
    },
  ];
  if (evidence.some((item) => item.redacted)) {
    receipts.push({
      id: 'checkpoint-7-evidence-redaction',
      kind: 'evidence-redaction',
      status: 'recorded',
      summary: 'One or more evidence summaries were redacted before review.',
    });
  }
  if (canaryPlan.liveApprovalRequired) {
    receipts.push({
      id: 'checkpoint-7-live-approval-boundary',
      kind: 'live-approval-boundary',
      status: 'requires-approval',
      summary: 'Live canary review requires owner approval and an approval id.',
    });
  }
  return receipts;
}

function summarize(
  rolloutEval: ZavorthOperationalRolloutEvalSnapshot,
  evidence: ZavorthUxEvidenceSanitizedItem[],
  reviews: ZavorthUxEvidenceReview[],
  canaryPlan: ZavorthUxRolloutCanaryPlan,
): ZavorthUxRolloutEvidenceCanarySnapshot['summary'] {
  return {
    scenarios: rolloutEval.summary.scenarios,
    surfaces: rolloutEval.summary.surfaces,
    evidenceItems: evidence.length,
    acceptedReviews: reviews.filter((review) => review.status === 'accepted' || review.status === 'redacted').length,
    missingReviews: reviews.filter((review) => review.status === 'missing').length,
    untrustedReviews: reviews.filter((review) => review.status === 'untrusted').length,
    redactedEvidenceItems: evidence.filter((item) => item.redacted).length,
    canaryMode: canaryPlan.mode,
  };
}

function redactText(value: string): { text: string; redacted: boolean } {
  let text = value;
  const before = text;
  text = text.replace(/\b(sk|pk|rk|ghp|glpat|xox[baprs])-?[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]');
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
  text = text.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_NUMBER]');
  return { text, redacted: text !== before };
}

function receiptStatus(status: ZavorthUxRolloutEvidenceCanaryStatus): ZavorthUxRolloutReceipt['status'] {
  if (status === 'blocked') return 'blocked';
  if (status === 'approval-required') return 'requires-approval';
  if (status === 'needs-evidence') return 'attention';
  return 'recorded';
}

function narrativeForStatus(
  status: ZavorthUxRolloutEvidenceCanaryStatus,
  canaryPlan: ZavorthUxRolloutCanaryPlan,
  summary: ZavorthUxRolloutEvidenceCanarySnapshot['summary'],
): ZavorthUxRolloutEvidenceCanarySnapshot['narrative'] {
  if (status === 'ready-for-dry-run-canary') {
    return {
      headline: 'UX evidence is sufficient for dry-run canary.',
      operatorSummary: `${summary.evidenceItems} evidence item(s) cover ${summary.scenarios} scenario(s).`,
      nextAction: canaryPlan.nextActions[0] || 'Run dry-run canary.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Live canary review needs owner approval.',
      operatorSummary: 'Evidence is sufficient, but live review remains approval gated.',
      nextAction: 'Provide owner confirmation and approval id.',
    };
  }
  if (status === 'blocked') {
    return {
      headline: 'Canary review is blocked by rollout eval.',
      operatorSummary: 'The lower rollout evaluation must pass before canary review.',
      nextAction: 'Fix rollout evaluation failures first.',
    };
  }
  return {
    headline: 'More UX evidence is needed.',
    operatorSummary: `${summary.missingReviews} review(s) are missing and ${summary.untrustedReviews} are untrusted.`,
    nextAction: canaryPlan.nextActions[0] || 'Attach trusted evidence.',
  };
}
