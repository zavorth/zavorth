import {
  AI_FIRST_PROMOTION_CANDIDATE_REGISTRY_CONTRACT_VERSION,
  type AiFirstPromotionAllowlistEntry,
  type AiFirstPromotionCandidateCriteria,
  type AiFirstPromotionCandidateEntry,
  type AiFirstPromotionCandidateRegistrySnapshot,
  type AiFirstPromotionCandidateStatus,
  type AiFirstPromotionPlanStep,
  type AiFirstPromotionRegistryAction,
  type AiFirstPromotionRegistryReadiness,
} from '../contracts/AiFirstPromotionCandidateRegistryContract.js';
import type {
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from '../contracts/AiFirstRoutePlanContract.js';
import type {
  AiFirstShadowBatchFamilyAggregate,
  AiFirstShadowBatchRecorderSnapshot,
  AiFirstShadowBatchSampleSummary,
} from '../contracts/AiFirstShadowBatchRecorderContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type AiFirstPromotionCandidateRegistryRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstPromotionCandidateRegistryInput = {
  registryName?: string | null;
  batchSnapshot: AiFirstShadowBatchRecorderSnapshot;
  criteria?: Partial<AiFirstPromotionCandidateCriteria> | null;
};

const DEFAULT_CRITERIA: AiFirstPromotionCandidateCriteria = {
  requireBatchCandidate: true,
  minFamilySamples: 2,
  minFamilyPassRate: 0.9,
  maxFamilyBlocks: 0,
  maxFamilyHighMismatchSamples: 0,
  maxFamilyHighShadowDivergenceSamples: 0,
  eligibleRiskLevels: ['safe'],
};

const RISK_RANK: Record<AiFirstRoutePlanRisk, number> = {
  safe: 0,
  attention: 1,
  danger: 2,
};

export class AiFirstPromotionCandidateRegistryService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstPromotionCandidateRegistryRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public buildRegistry(input: AiFirstPromotionCandidateRegistryInput): AiFirstPromotionCandidateRegistrySnapshot {
    const criteria = normalizeCriteria(input.criteria || null);
    const batch = input.batchSnapshot;
    const candidates = batch.familyAggregates.map((family) =>
      this.buildCandidateEntry({
        family,
        samples: batch.samples.filter((sample) => sample.aiIntent === family.familyId),
        criteria,
        batch,
      }));
    const allowlist = candidates.map((candidate) => this.buildAllowlistEntry(candidate, criteria));
    const summary = summarize(candidates, allowlist);
    const recommendation = buildRecommendation({
      batch,
      summary,
    });
    const promotionPlan = buildPromotionPlan({
      summary,
      recommendation,
      allowlist,
    });

    return {
      contractVersion: AI_FIRST_PROMOTION_CANDIDATE_REGISTRY_CONTRACT_VERSION,
      source: 'ai-first-promotion-candidate-registry',
      generatedAt: this.now().toISOString(),
      registryId: this.idFactory('registry'),
      input: {
        registryName: safeText(input.registryName || 'ai-first-promotion-candidate-registry'),
        batchId: batch.batchId,
        batchName: batch.input.batchName,
        batchReadiness: batch.recommendation.readiness,
        batchCriteriaPassed: batch.score.criteriaPassed,
        sampleCount: batch.input.sampleCount,
      },
      criteria,
      candidates,
      allowlist,
      promotionPlan,
      summary,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'registry',
          detail: `${candidates.length} family candidate(s) evaluated from batch ${batch.batchId}.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'allowlist',
          detail: `${summary.proposedAllowlistEntries} allowlist proposal(s) prepared; ${summary.withheldAllowlistEntries} withheld.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'promotion-plan',
          detail: 'Promotion plan is proposal-only and requires manual activation.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Registry does not change the default runtime route.',
        },
      ],
      gates: [
        {
          id: 'gate-5-registry-only',
          status: 'passed',
          detail: 'Candidate registry records eligibility but does not activate routes.',
        },
        {
          id: 'gate-5-allowlist-proposal-only',
          status: 'passed',
          detail: 'Allowlist entries are proposed or withheld; none are enabled by default.',
        },
        {
          id: 'gate-5-manual-activation-required',
          status: 'passed',
          detail: 'Every allowlist entry requires manual activation and Approval gate guardrails.',
        },
        {
          id: 'gate-5-current-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstPromotionCandidateRegistrySnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Credential vault');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- registryId: ${snapshot.registryId}`);
    lines.push(`- batchId: ${snapshot.input.batchId}`);
    lines.push(`- readiness: ${snapshot.recommendation.readiness}`);
    lines.push(`- action: ${snapshot.recommendation.action}`);
    lines.push(`- eligibleFamilies: ${snapshot.summary.eligibleFamilies}`);
    lines.push(`- proposedAllowlistEntries: ${snapshot.summary.proposedAllowlistEntries}`);
    lines.push(`- activateAutomatically: ${String(snapshot.recommendation.activateAutomatically)}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.recommendation.defaultRuntimeChanged)}`);
    lines.push('');
    lines.push('## Candidates');
    for (const candidate of snapshot.candidates) {
      lines.push(`- ${candidate.familyId}: ${candidate.status} / samples=${candidate.samples} / passRate=${formatRate(candidate.passRate)} - ${candidate.reason}`);
    }
    lines.push('');
    lines.push('## Promotion plan');
    for (const step of snapshot.promotionPlan) {
      lines.push(`- ${step.order}. ${step.kind}: ${step.detail}`);
    }
    return lines.join('\n');
  }

  private buildCandidateEntry(input: {
    family: AiFirstShadowBatchFamilyAggregate;
    samples: AiFirstShadowBatchSampleSummary[];
    criteria: AiFirstPromotionCandidateCriteria;
    batch: AiFirstShadowBatchRecorderSnapshot;
  }): AiFirstPromotionCandidateEntry {
    const observedRiskLevels = uniqueRiskLevels(input.samples.flatMap((sample) => [sample.aiRisk, sample.deterministicRisk]));
    const allowedSurfaces = uniqueStrings(input.samples
      .filter((sample) => sample.status === 'pass')
      .map((sample) => sample.surface));
    const eligibility = evaluateFamilyEligibility(input);
    return {
      id: this.idFactory('candidate'),
      familyId: input.family.familyId,
      status: eligibility.status,
      samples: input.family.samples,
      pass: input.family.pass,
      hold: input.family.hold,
      block: input.family.block,
      passRate: input.family.passRate,
      highMismatchSamples: input.family.highMismatchSamples,
      highShadowDivergenceSamples: input.family.highShadowDivergenceSamples,
      allowedSurfaces,
      observedRiskLevels,
      allowlistRouteKey: `ai-first:${input.family.familyId}`,
      reason: eligibility.reason,
    };
  }

  private buildAllowlistEntry(
    candidate: AiFirstPromotionCandidateEntry,
    criteria: AiFirstPromotionCandidateCriteria,
  ): AiFirstPromotionAllowlistEntry {
    const proposed = candidate.status === 'eligible';
    const allowedRiskLevels = proposed
      ? candidate.observedRiskLevels.filter((risk) => criteria.eligibleRiskLevels.includes(risk))
      : [];
    return {
      id: this.idFactory('allowlist'),
      routeKey: candidate.allowlistRouteKey,
      familyId: candidate.familyId,
      status: proposed ? 'proposed' : 'withheld',
      surfaces: proposed ? candidate.allowedSurfaces : [],
      allowedRiskLevels,
      maxRisk: maxRisk(allowedRiskLevels),
      requiresStage3Guardrail: true,
      requiresBatchReceipt: true,
      requiresManualActivation: true,
      defaultEnabled: false,
      canExecuteNow: false,
      reason: proposed ? 'Family met batch and family-level criteria; propose limited allowlist only.'
        : candidate.reason,
    };
  }
}

function normalizeCriteria(input: Partial<AiFirstPromotionCandidateCriteria> | null): AiFirstPromotionCandidateCriteria {
  return {
    requireBatchCandidate: input?.requireBatchCandidate ?? DEFAULT_CRITERIA.requireBatchCandidate,
    minFamilySamples: positiveInteger(input?.minFamilySamples, DEFAULT_CRITERIA.minFamilySamples),
    minFamilyPassRate: normalizedRate(input?.minFamilyPassRate, DEFAULT_CRITERIA.minFamilyPassRate),
    maxFamilyBlocks: nonNegativeInteger(input?.maxFamilyBlocks, DEFAULT_CRITERIA.maxFamilyBlocks),
    maxFamilyHighMismatchSamples: nonNegativeInteger(
      input?.maxFamilyHighMismatchSamples,
      DEFAULT_CRITERIA.maxFamilyHighMismatchSamples,
    ),
    maxFamilyHighShadowDivergenceSamples: nonNegativeInteger(
      input?.maxFamilyHighShadowDivergenceSamples,
      DEFAULT_CRITERIA.maxFamilyHighShadowDivergenceSamples,
    ),
    eligibleRiskLevels: uniqueRiskLevels(input?.eligibleRiskLevels || DEFAULT_CRITERIA.eligibleRiskLevels),
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function normalizedRate(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function safeText(value: unknown): string {
  const text = String(value || '').trim();
  return redactSensitiveText(text || 'ai-first-promotion-candidate-registry');
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function uniqueRiskLevels(values: AiFirstRoutePlanRisk[]): AiFirstRoutePlanRisk[] {
  const allowed = new Set<AiFirstRoutePlanRisk>(['safe', 'attention', 'danger']);
  const seen = new Set<AiFirstRoutePlanRisk>();
  const risks: AiFirstRoutePlanRisk[] = [];
  for (const value of values) {
    if (!allowed.has(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    risks.push(value);
  }
  return risks.length > 0 ? risks : ['safe'];
}

function maxRisk(values: AiFirstRoutePlanRisk[]): AiFirstRoutePlanRisk {
  return values.reduce<AiFirstRoutePlanRisk>((current, next) => (
    RISK_RANK[next] > RISK_RANK[current] ? next : current
  ), 'safe');
}

function evaluateFamilyEligibility(input: {
  family: AiFirstShadowBatchFamilyAggregate;
  samples: AiFirstShadowBatchSampleSummary[];
  criteria: AiFirstPromotionCandidateCriteria;
  batch: AiFirstShadowBatchRecorderSnapshot;
}): { status: AiFirstPromotionCandidateStatus; reason: string } {
  if (input.criteria.requireBatchCandidate && input.batch.recommendation.readiness !== 'candidate') {
    return {
      status: input.batch.recommendation.readiness === 'needs-more-samples' ? 'watch' : 'blocked',
      reason: `Batch readiness is ${input.batch.recommendation.readiness}; family cannot be proposed.`,
    };
  }
  if (input.family.samples < input.criteria.minFamilySamples) {
    return {
      status: 'watch',
      reason: `Family has ${input.family.samples}/${input.criteria.minFamilySamples} required samples.`,
    };
  }
  if (input.family.passRate < input.criteria.minFamilyPassRate) {
    return {
      status: 'watch',
      reason: `Family passRate ${formatRate(input.family.passRate)} is below ${formatRate(input.criteria.minFamilyPassRate)}.`,
    };
  }
  if (input.family.block > input.criteria.maxFamilyBlocks) {
    return {
      status: 'blocked',
      reason: `Family has ${input.family.block} blocked sample(s).`,
    };
  }
  if (input.family.highMismatchSamples > input.criteria.maxFamilyHighMismatchSamples) {
    return {
      status: 'blocked',
      reason: `Family has ${input.family.highMismatchSamples} high mismatch sample(s).`,
    };
  }
  if (input.family.highShadowDivergenceSamples > input.criteria.maxFamilyHighShadowDivergenceSamples) {
    return {
      status: 'blocked',
      reason: `Family has ${input.family.highShadowDivergenceSamples} high shadow divergence sample(s).`,
    };
  }
  const observedRiskLevels = uniqueRiskLevels(input.samples.flatMap((sample) => [sample.aiRisk, sample.deterministicRisk]));
  const unsupportedRisks = observedRiskLevels.filter((risk) => !input.criteria.eligibleRiskLevels.includes(risk));
  if (unsupportedRisks.length > 0) {
    return {
      status: 'blocked',
      reason: `Family observed unsupported risk level(s): ${unsupportedRisks.join(', ')}.`,
    };
  }
  return {
    status: 'eligible',
    reason: 'Family met batch and family-level promotion criteria.',
  };
}

function summarize(
  candidates: AiFirstPromotionCandidateEntry[],
  allowlist: AiFirstPromotionAllowlistEntry[],
): AiFirstPromotionCandidateRegistrySnapshot['summary'] {
  return {
    totalFamilies: candidates.length,
    eligibleFamilies: candidates.filter((candidate) => candidate.status === 'eligible').length,
    watchFamilies: candidates.filter((candidate) => candidate.status === 'watch').length,
    blockedFamilies: candidates.filter((candidate) => candidate.status === 'blocked').length,
    proposedAllowlistEntries: allowlist.filter((entry) => entry.status === 'proposed').length,
    withheldAllowlistEntries: allowlist.filter((entry) => entry.status === 'withheld').length,
  };
}

function buildRecommendation(input: {
  batch: AiFirstShadowBatchRecorderSnapshot;
  summary: AiFirstPromotionCandidateRegistrySnapshot['summary'];
}): AiFirstPromotionCandidateRegistrySnapshot['recommendation'] {
  const readiness: AiFirstPromotionRegistryReadiness = input.summary.eligibleFamilies > 0
    ? 'ready-for-manual-canary'
    : input.batch.recommendation.readiness === 'needs-more-samples' || input.summary.watchFamilies > 0
      ? 'continue-shadow'
      : 'blocked';
  const action: AiFirstPromotionRegistryAction = readiness === 'ready-for-manual-canary'
    ? 'prepare-limited-promotion-plan'
    : readiness === 'continue-shadow'
      ? 'collect-more-samples'
      : input.summary.blockedFamilies > 0
        ? 'investigate-blocks'
        : 'reject-promotion';
  return {
    readiness,
    action,
    reason: recommendationReason(readiness, action),
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
    canExecuteNow: false,
    activateAutomatically: false,
  };
}

function recommendationReason(
  readiness: AiFirstPromotionRegistryReadiness,
  action: AiFirstPromotionRegistryAction,
): string {
  if (action === 'prepare-limited-promotion-plan') {
    return 'One or more families can be proposed for manual limited canary only.';
  }
  if (action === 'collect-more-samples') {
    return 'Registry needs more shadow samples before any allowlist proposal.';
  }
  if (action === 'investigate-blocks') {
    return 'Blocked families require investigation before promotion planning.';
  }
  if (readiness === 'blocked') {
    return 'No family is eligible for promotion from this batch.';
  }
  return 'Continue shadow evaluation.';
}

function buildPromotionPlan(input: {
  summary: AiFirstPromotionCandidateRegistrySnapshot['summary'];
  recommendation: AiFirstPromotionCandidateRegistrySnapshot['recommendation'];
  allowlist: AiFirstPromotionAllowlistEntry[];
}): AiFirstPromotionPlanStep[] {
  const steps: AiFirstPromotionPlanStep[] = [
    {
      order: 1,
      id: 'gate-5:keep-default-runtime',
      kind: 'keep-default-runtime',
      status: 'planned',
      detail: 'Keep current runtime route as authoritative.',
    },
  ];
  if (input.summary.proposedAllowlistEntries > 0) {
    steps.push({
      order: 2,
      id: 'gate-5:register-allowlist-proposal',
      kind: 'register-allowlist-proposal',
      status: 'planned',
      detail: `Prepare ${input.summary.proposedAllowlistEntries} allowlist proposal(s), disabled by default.`,
    });
    steps.push({
      order: 3,
      id: 'gate-5:manual-canary-review',
      kind: 'manual-canary-review',
      status: 'planned',
      detail: 'Require owner review before any limited canary activation.',
    });
    return steps;
  }
  if (input.recommendation.action === 'investigate-blocks') {
    steps.push({
      order: 2,
      id: 'gate-5:investigate-blocks',
      kind: 'investigate-blocks',
      status: 'planned',
      detail: 'Investigate blocked families and high-risk mismatches before collecting promotion candidates.',
    });
  } else {
    steps.push({
      order: 2,
      id: 'gate-5:continue-shadow',
      kind: 'continue-shadow',
      status: 'planned',
      detail: 'Collect more Connector registry batches before creating allowlist proposals.',
    });
  }
  return steps;
}

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
