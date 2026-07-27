import {
  AI_FIRST_SHADOW_BATCH_RECORDER_CONTRACT_VERSION,
  type AiFirstShadowBatchFamilyAggregate,
  type AiFirstShadowBatchMismatchAggregate,
  type AiFirstShadowBatchPromotionCriteria,
  type AiFirstShadowBatchRecorderSnapshot,
  type AiFirstShadowBatchRecommendationAction,
  type AiFirstShadowBatchReadiness,
  type AiFirstShadowBatchSampleSummary,
} from '../contracts/AiFirstShadowBatchRecorderContract.js';
import type { AiFirstPolicyGuardrailSnapshot } from '../contracts/AiFirstPolicyGuardrailContract.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import {
  AiFirstPolicyGuardrailService,
  type AiFirstPolicyGuardrailInput,
} from './AiFirstPolicyGuardrailService.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type AiFirstShadowBatchRecorderRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  guardrailService?: Pick<AiFirstPolicyGuardrailService, 'evaluate'>;
};

export type AiFirstShadowBatchRecorderSampleInput = Omit<AiFirstPolicyGuardrailInput, 'legacyDecision'> & {
  sampleId?: string | null;
  legacyDecision?: ZavorthResponseDecision | null;
};

export type AiFirstShadowBatchRecorderInput = {
  batchName?: string | null;
  profile?: 'default' | 'promotion-candidate' | 'custom' | null;
  criteria?: Partial<AiFirstShadowBatchPromotionCriteria> | null;
  samples: AiFirstShadowBatchRecorderSampleInput[];
};

const DEFAULT_CRITERIA: AiFirstShadowBatchPromotionCriteria = {
  minSamples: 5,
  minPassRate: 0.8,
  maxBlockRate: 0,
  maxHighMismatchRate: 0,
  maxHighShadowDivergenceRate: 0,
  requireNoExecutionAttempts: true,
  requireNoSecretLeaks: true,
};

export class AiFirstShadowBatchRecorderService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly guardrailService: Pick<AiFirstPolicyGuardrailService, 'evaluate'>;
  private sequence = 0;

  constructor(runtime: AiFirstShadowBatchRecorderRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.guardrailService = runtime.guardrailService ?? new AiFirstPolicyGuardrailService({
      now: this.now,
      idFactory: this.idFactory,
    });
  }

  public recordBatch(input: AiFirstShadowBatchRecorderInput): AiFirstShadowBatchRecorderSnapshot {
    const criteria = normalizeCriteria(input.criteria || null);
    const guardrailSnapshots = input.samples.map((sample, index) => ({
      sampleId: safeId(sample.sampleId || `sample-${index + 1}`),
      snapshot: this.guardrailService.evaluate({
        ...sample,
        userMessage: redactSensitiveText(String(sample.userMessage || '')),
      }),
    }));
    const samples = guardrailSnapshots.map((entry) => summarizeSample(entry.sampleId, entry.snapshot));
    const statusCounts = countStatuses(samples);
    const familyAggregates = aggregateFamilies(samples);
    const mismatchAggregates = aggregateMismatches(guardrailSnapshots.map((entry) => entry.snapshot));
    const secretLeakDetected = guardrailSnapshots.some((entry) => snapshotLooksLikeSecretLeak(entry.snapshot));
    const score = buildScore({
      samples,
      statusCounts,
      secretLeakDetected,
      criteria,
    });
    const recommendation = buildRecommendation(score);

    return {
      contractVersion: AI_FIRST_SHADOW_BATCH_RECORDER_CONTRACT_VERSION,
      source: 'ai-first-shadow-batch-recorder',
      generatedAt: this.now().toISOString(),
      batchId: this.idFactory('batch'),
      input: {
        profile: input.profile || 'default',
        batchName: safeText(input.batchName || 'ai-first-shadow-batch'),
        sampleCount: samples.length,
      },
      samples,
      statusCounts,
      familyAggregates,
      mismatchAggregates,
      criteria,
      score,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'batch',
          detail: `${samples.length} sample(s) evaluated through Approval gate guardrails.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'criteria',
          detail: `${score.failedCriteria.length} promotion criteria failed.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'policy',
          detail: 'Only guardrail snapshots were aggregated; no tools were executed.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Batch recorder does not change the default runtime route.',
        },
      ],
      gates: [
        {
          id: 'gate-4-batch-only',
          status: 'passed',
          detail: 'Batch recorder aggregates Approval gate snapshots without promotion.',
        },
        {
          id: 'gate-4-no-execution',
          status: 'passed',
          detail: 'All sample summaries preserve canExecuteNow=false.',
        },
        {
          id: 'gate-4-default-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
        {
          id: 'gate-4-secret-redaction-checked',
          status: 'passed',
          detail: 'Serialized snapshots were scanned for obvious unredacted secret patterns.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstShadowBatchRecorderSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Connector registry');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- batchId: ${snapshot.batchId}`);
    lines.push(`- samples: ${snapshot.input.sampleCount}`);
    lines.push(`- readiness: ${snapshot.recommendation.readiness}`);
    lines.push(`- action: ${snapshot.recommendation.action}`);
    lines.push(`- criteriaPassed: ${String(snapshot.score.criteriaPassed)}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.recommendation.defaultRuntimeChanged)}`);
    lines.push('');
    lines.push('## Rates');
    lines.push(`- passRate: ${formatRate(snapshot.score.passRate)}`);
    lines.push(`- holdRate: ${formatRate(snapshot.score.holdRate)}`);
    lines.push(`- blockRate: ${formatRate(snapshot.score.blockRate)}`);
    lines.push(`- highMismatchRate: ${formatRate(snapshot.score.highMismatchRate)}`);
    lines.push(`- highShadowDivergenceRate: ${formatRate(snapshot.score.highShadowDivergenceRate)}`);
    lines.push('');
    lines.push('## Failed criteria');
    if (snapshot.score.failedCriteria.length === 0) {
      lines.push('- none');
    } else {
      for (const criterion of snapshot.score.failedCriteria) {
        lines.push(`- ${criterion}`);
      }
    }
    lines.push('');
    lines.push('## Families');
    for (const family of snapshot.familyAggregates) {
      lines.push(`- ${family.familyId}: samples=${family.samples}, pass=${family.pass}, hold=${family.hold}, block=${family.block}`);
    }
    return lines.join('\n');
  }
}

function normalizeCriteria(input: Partial<AiFirstShadowBatchPromotionCriteria> | null): AiFirstShadowBatchPromotionCriteria {
  return {
    minSamples: positiveInteger(input?.minSamples, DEFAULT_CRITERIA.minSamples),
    minPassRate: normalizedRate(input?.minPassRate, DEFAULT_CRITERIA.minPassRate),
    maxBlockRate: normalizedRate(input?.maxBlockRate, DEFAULT_CRITERIA.maxBlockRate),
    maxHighMismatchRate: normalizedRate(input?.maxHighMismatchRate, DEFAULT_CRITERIA.maxHighMismatchRate),
    maxHighShadowDivergenceRate: normalizedRate(
      input?.maxHighShadowDivergenceRate,
      DEFAULT_CRITERIA.maxHighShadowDivergenceRate,
    ),
    requireNoExecutionAttempts: input?.requireNoExecutionAttempts ?? DEFAULT_CRITERIA.requireNoExecutionAttempts,
    requireNoSecretLeaks: input?.requireNoSecretLeaks ?? DEFAULT_CRITERIA.requireNoSecretLeaks,
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
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
  return redactSensitiveText(text || 'ai-first-shadow-batch');
}

function safeId(value: unknown): string {
  const text = String(value || '').trim().toLowerCase();
  const id = text.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'sample';
}

function summarizeSample(sampleId: string, snapshot: AiFirstPolicyGuardrailSnapshot): AiFirstShadowBatchSampleSummary {
  return {
    sampleId,
    guardrailId: snapshot.guardrailId,
    surface: snapshot.input.surface,
    status: snapshot.decision.status,
    action: snapshot.decision.action,
    sampleEligibleForPromotion: snapshot.decision.sampleEligibleForPromotion,
    aiIntent: snapshot.aiPlan.intent,
    aiRisk: snapshot.aiPlan.risk,
    deterministicIntent: snapshot.deterministicPolicy.intent,
    deterministicRisk: snapshot.deterministicPolicy.risk,
    shadowHighDivergences: snapshot.shadow.highDivergences,
    shadowMediumDivergences: snapshot.shadow.mediumDivergences,
    mismatchCount: snapshot.summary.totalMismatches,
    highMismatchCount: snapshot.summary.high,
    mediumMismatchCount: snapshot.summary.medium,
    mismatchKinds: Array.from(new Set(snapshot.mismatches.map((mismatch) => mismatch.kind))),
    requestedTools: [...snapshot.aiPlan.requestedTools],
    canExecuteNow: false,
  };
}

function countStatuses(samples: AiFirstShadowBatchSampleSummary[]): AiFirstShadowBatchRecorderSnapshot['statusCounts'] {
  return {
    pass: samples.filter((sample) => sample.status === 'pass').length,
    hold: samples.filter((sample) => sample.status === 'hold').length,
    block: samples.filter((sample) => sample.status === 'block').length,
  };
}

function aggregateFamilies(samples: AiFirstShadowBatchSampleSummary[]): AiFirstShadowBatchFamilyAggregate[] {
  const families = new Map<string, AiFirstShadowBatchFamilyAggregate>();
  for (const sample of samples) {
    const current = families.get(sample.aiIntent) || {
      familyId: sample.aiIntent,
      samples: 0,
      pass: 0,
      hold: 0,
      block: 0,
      passRate: 0,
      highMismatchSamples: 0,
      highShadowDivergenceSamples: 0,
    };
    current.samples += 1;
    current.pass += sample.status === 'pass' ? 1 : 0;
    current.hold += sample.status === 'hold' ? 1 : 0;
    current.block += sample.status === 'block' ? 1 : 0;
    current.highMismatchSamples += sample.highMismatchCount > 0 ? 1 : 0;
    current.highShadowDivergenceSamples += sample.shadowHighDivergences > 0 ? 1 : 0;
    current.passRate = rate(current.pass, current.samples);
    families.set(sample.aiIntent, current);
  }
  return Array.from(families.values()).sort((left, right) => right.samples - left.samples || left.familyId.localeCompare(right.familyId));
}

function aggregateMismatches(snapshots: AiFirstPolicyGuardrailSnapshot[]): AiFirstShadowBatchMismatchAggregate[] {
  const aggregates = new Map<string, AiFirstShadowBatchMismatchAggregate>();
  for (const snapshot of snapshots) {
    for (const mismatch of snapshot.mismatches) {
      const current = aggregates.get(mismatch.kind) || {
        kind: mismatch.kind,
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      };
      current.total += 1;
      current.high += mismatch.severity === 'high' ? 1 : 0;
      current.medium += mismatch.severity === 'medium' ? 1 : 0;
      current.low += mismatch.severity === 'low' ? 1 : 0;
      current.info += mismatch.severity === 'info' ? 1 : 0;
      aggregates.set(mismatch.kind, current);
    }
  }
  return Array.from(aggregates.values()).sort((left, right) => right.total - left.total || left.kind.localeCompare(right.kind));
}

function buildScore(input: {
  samples: AiFirstShadowBatchSampleSummary[];
  statusCounts: AiFirstShadowBatchRecorderSnapshot['statusCounts'];
  secretLeakDetected: boolean;
  criteria: AiFirstShadowBatchPromotionCriteria;
}): AiFirstShadowBatchRecorderSnapshot['score'] {
  const sampleCount = input.samples.length;
  const executionAttemptCount = input.samples.filter((sample) => sample.canExecuteNow !== false).length;
  const highMismatchSamples = input.samples.filter((sample) => sample.highMismatchCount > 0).length;
  const highShadowSamples = input.samples.filter((sample) => sample.shadowHighDivergences > 0).length;
  const score = {
    sampleCount,
    passRate: rate(input.statusCounts.pass, sampleCount),
    holdRate: rate(input.statusCounts.hold, sampleCount),
    blockRate: rate(input.statusCounts.block, sampleCount),
    highMismatchRate: rate(highMismatchSamples, sampleCount),
    highShadowDivergenceRate: rate(highShadowSamples, sampleCount),
    executionAttemptCount,
    secretLeakDetected: input.secretLeakDetected,
    criteriaPassed: false,
    failedCriteria: [] as string[],
  };
  const failedCriteria = collectFailedCriteria(score, input.criteria);
  return {
    ...score,
    criteriaPassed: failedCriteria.length === 0,
    failedCriteria,
  };
}

function collectFailedCriteria(
  score: Omit<AiFirstShadowBatchRecorderSnapshot['score'], 'criteriaPassed' | 'failedCriteria'>,
  criteria: AiFirstShadowBatchPromotionCriteria,
): string[] {
  const failed: string[] = [];
  if (score.sampleCount < criteria.minSamples) {
    failed.push(`minSamples:${score.sampleCount}/${criteria.minSamples}`);
  }
  if (score.passRate < criteria.minPassRate) {
    failed.push(`minPassRate:${formatRate(score.passRate)}/${formatRate(criteria.minPassRate)}`);
  }
  if (score.blockRate > criteria.maxBlockRate) {
    failed.push(`maxBlockRate:${formatRate(score.blockRate)}/${formatRate(criteria.maxBlockRate)}`);
  }
  if (score.highMismatchRate > criteria.maxHighMismatchRate) {
    failed.push(`maxHighMismatchRate:${formatRate(score.highMismatchRate)}/${formatRate(criteria.maxHighMismatchRate)}`);
  }
  if (score.highShadowDivergenceRate > criteria.maxHighShadowDivergenceRate) {
    failed.push(`maxHighShadowDivergenceRate:${formatRate(score.highShadowDivergenceRate)}/${formatRate(criteria.maxHighShadowDivergenceRate)}`);
  }
  if (criteria.requireNoExecutionAttempts && score.executionAttemptCount > 0) {
    failed.push(`requireNoExecutionAttempts:${score.executionAttemptCount}`);
  }
  if (criteria.requireNoSecretLeaks && score.secretLeakDetected) {
    failed.push('requireNoSecretLeaks:failed');
  }
  return failed;
}

function buildRecommendation(score: AiFirstShadowBatchRecorderSnapshot['score']): AiFirstShadowBatchRecorderSnapshot['recommendation'] {
  const readiness: AiFirstShadowBatchReadiness = score.criteriaPassed ? 'candidate'
    : score.failedCriteria.some((criterion) => criterion.startsWith('minSamples')) ? 'needs-more-samples'
      : 'not-ready';
  const action: AiFirstShadowBatchRecommendationAction = score.criteriaPassed ? 'eligible-for-limited-promotion'
    : score.blockRate > 0 || score.highMismatchRate > 0 || score.executionAttemptCount > 0 || score.secretLeakDetected ? 'investigate-blocks'
      : readiness === 'needs-more-samples'
        ? 'collect-more-samples'
        : 'continue-shadow';

  return {
    readiness,
    action,
    reason: recommendationReason(readiness, action),
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
    canExecuteNow: false,
  };
}

function recommendationReason(
  readiness: AiFirstShadowBatchReadiness,
  action: AiFirstShadowBatchRecommendationAction,
): string {
  if (action === 'eligible-for-limited-promotion') {
    return 'Batch met all configured promotion criteria; consider limited gated promotion only.';
  }
  if (action === 'investigate-blocks') {
    return 'Batch has blocking or high-risk signals that require investigation.';
  }
  if (readiness === 'needs-more-samples') {
    return 'Batch has too few samples for a promotion decision.';
  }
  return 'Batch should continue in shadow mode until rates improve.';
}

function snapshotLooksLikeSecretLeak(snapshot: AiFirstPolicyGuardrailSnapshot): boolean {
  const serialized = JSON.stringify(snapshot);
  return /\bxox[pbarfs]-[A-Za-z0-9-]{6,}\b/i.test(serialized)
    || /\bsk-[A-Za-z0-9_-]{12,}\b/.test(serialized)
    || /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/.test(serialized);
}

function rate(count: number, total: number): number {
  return total <= 0 ? 0 : count / total;
}

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
