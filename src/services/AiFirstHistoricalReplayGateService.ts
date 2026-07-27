import {
  AI_FIRST_HISTORICAL_REPLAY_GATE_CONTRACT_VERSION,
  type AiFirstHistoricalReplayCriteria,
  type AiFirstHistoricalReplayFallbackTrend,
  type AiFirstHistoricalReplayFinding,
  type AiFirstHistoricalReplayGateAction,
  type AiFirstHistoricalReplayGateSnapshot,
  type AiFirstHistoricalReplayGateStatus,
  type AiFirstHistoricalReplayLedgerPoint,
  type AiFirstHistoricalReplaySelectionChange,
} from '../contracts/AiFirstHistoricalReplayGateContract.js';
import type {
  AiFirstRuntimeEntrypointFallbackReason,
  AiFirstRuntimeEntrypointSelectedPath,
} from '../contracts/AiFirstRuntimeEntrypointAdapterContract.js';
import type { AiFirstRuntimeReceiptLedgerSnapshot } from '../contracts/AiFirstRuntimeReceiptLedgerContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type AiFirstHistoricalReplayGateRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstHistoricalReplayGateInput = {
  gateName?: string | null;
  ledgers: AiFirstRuntimeReceiptLedgerSnapshot[];
  criteria?: Partial<AiFirstHistoricalReplayCriteria> | null;
};

const DEFAULT_CRITERIA: AiFirstHistoricalReplayCriteria = {
  minLedgers: 2,
  minTotalEntries: 4,
  minLatestCanaryRate: 0.5,
  maxLatestFallbackRate: 0.5,
  maxCanaryRateDrop: 0.1,
  maxFallbackRateIncrease: 0.1,
  requireNoInvariantViolations: true,
  requireNoSecretLeaks: true,
  requireNoNewFallbackReasons: true,
  requireStableReplaySelections: false,
};

export class AiFirstHistoricalReplayGateService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstHistoricalReplayGateRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public buildGate(input: AiFirstHistoricalReplayGateInput): AiFirstHistoricalReplayGateSnapshot {
    const criteria = normalizeCriteria(input.criteria || null);
    const ledgers = input.ledgers || [];
    const history = ledgers.map((ledger, index) => toLedgerPoint(ledger, index));
    const fallbackTrends = buildFallbackTrends(history);
    const replaySelectionChanges = buildReplaySelectionChanges(ledgers);
    const aggregate = buildAggregate({
      history,
      ledgers,
      fallbackTrends,
      replaySelectionChanges,
    });
    const findings = buildFindings({
      aggregate,
      criteria,
      fallbackTrends,
      replaySelectionChanges,
    });
    const recommendation = buildRecommendation(findings);

    return {
      contractVersion: AI_FIRST_HISTORICAL_REPLAY_GATE_CONTRACT_VERSION,
      source: 'ai-first-historical-replay-gate',
      generatedAt: this.now().toISOString(),
      gateId: this.idFactory('historical-gate'),
      input: {
        gateName: safeText(input.gateName || 'ai-first-historical-replay-gate'),
        ledgerCount: ledgers.length,
        totalEntries: aggregate.totalEntries,
      },
      criteria,
      history,
      fallbackTrends,
      replaySelectionChanges,
      aggregate,
      findings,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'history',
          detail: `${history.length} historical ledger(s) compared with ${aggregate.totalEntries} total receipt entrie(s).`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'fallback-trend',
          detail: `${fallbackTrends.length} fallback reason trend(s) evaluated.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'replay-change',
          detail: `${replaySelectionChanges.length} replay selection change(s) detected.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'gate',
          detail: `Historical replay gate result: ${recommendation.status}.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Historical replay gate only recommends promotion state; it does not change runtime routing.',
        },
      ],
      gates: [
        {
          id: 'gate-9-history-loaded',
          status: history.length >= criteria.minLedgers ? 'passed' : 'warning',
          detail: `${history.length} ledger(s) loaded; minimum is ${criteria.minLedgers}.`,
        },
        {
          id: 'gate-9-no-source-violations',
          status: aggregate.sourceViolationCount === 0 ? 'passed' : 'blocked',
          detail: `${aggregate.sourceViolationCount} source invariant violation(s) detected.`,
        },
        {
          id: 'gate-9-no-secret-leaks',
          status: aggregate.secretLeakDetected ? 'blocked' : 'passed',
          detail: aggregate.secretLeakDetected ? 'Secret-like value detected in the historical input.'
            : 'No secret-like value detected in the historical input.',
        },
        {
          id: 'gate-9-no-runtime-change',
          status: 'passed',
          detail: 'defaultRuntimeChanged remains false and canExecuteNow remains false.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstHistoricalReplayGateSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Certification matrix');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- gateId: ${snapshot.gateId}`);
    lines.push(`- ledgers: ${snapshot.aggregate.totalLedgers}`);
    lines.push(`- entries: ${snapshot.aggregate.totalEntries}`);
    lines.push(`- latestCanaryRate: ${formatRate(snapshot.aggregate.latestCanaryRate)}`);
    lines.push(`- latestFallbackRate: ${formatRate(snapshot.aggregate.latestFallbackRate)}`);
    lines.push(`- replaySelectionChanges: ${snapshot.aggregate.replaySelectionChangeCount}`);
    lines.push(`- status: ${snapshot.recommendation.status}`);
    lines.push(`- action: ${snapshot.recommendation.action}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.recommendation.defaultRuntimeChanged)}`);
    lines.push(`- canExecuteNow: ${String(snapshot.recommendation.canExecuteNow)}`);
    lines.push('');
    lines.push('## Findings');
    if (snapshot.findings.length === 0) {
      lines.push('- none');
    } else {
      for (const finding of snapshot.findings) {
        lines.push(`- ${finding.severity}/${finding.kind}: ${finding.detail}`);
      }
    }
    lines.push('');
    lines.push('## History');
    if (snapshot.history.length === 0) {
      lines.push('- none');
    } else {
      for (const point of snapshot.history) {
        lines.push(`- ${point.ledgerId}: entries=${point.totalEntries}, canary=${formatRate(point.canaryRate)}, fallback=${formatRate(point.fallbackRate)}, violations=${point.sourceViolationCount}`);
      }
    }
    return lines.join('\n');
  }
}

function normalizeCriteria(input: Partial<AiFirstHistoricalReplayCriteria> | null): AiFirstHistoricalReplayCriteria {
  return {
    minLedgers: nonNegativeInteger(input?.minLedgers, DEFAULT_CRITERIA.minLedgers),
    minTotalEntries: nonNegativeInteger(input?.minTotalEntries, DEFAULT_CRITERIA.minTotalEntries),
    minLatestCanaryRate: rate(input?.minLatestCanaryRate, DEFAULT_CRITERIA.minLatestCanaryRate),
    maxLatestFallbackRate: rate(input?.maxLatestFallbackRate, DEFAULT_CRITERIA.maxLatestFallbackRate),
    maxCanaryRateDrop: rate(input?.maxCanaryRateDrop, DEFAULT_CRITERIA.maxCanaryRateDrop),
    maxFallbackRateIncrease: rate(input?.maxFallbackRateIncrease, DEFAULT_CRITERIA.maxFallbackRateIncrease),
    requireNoInvariantViolations: input?.requireNoInvariantViolations !== false,
    requireNoSecretLeaks: input?.requireNoSecretLeaks !== false,
    requireNoNewFallbackReasons: input?.requireNoNewFallbackReasons !== false,
    requireStableReplaySelections: input?.requireStableReplaySelections === true,
  };
}

function toLedgerPoint(
  ledger: AiFirstRuntimeReceiptLedgerSnapshot,
  index: number,
): AiFirstHistoricalReplayLedgerPoint {
  const totalEntries = ledger.summary.totalEntries;
  const fallbackSelections = ledger.summary.fallbackCurrentRuntime + ledger.summary.currentRuntimeOnly;
  return {
    index,
    ledgerId: safeId(ledger.ledgerId || `ledger-${index + 1}`),
    ledgerName: safeText(ledger.input.ledgerName || `ledger-${index + 1}`),
    generatedAt: safeText(ledger.generatedAt),
    totalEntries,
    canarySelected: ledger.summary.canarySelected,
    currentRuntimeSelected: ledger.summary.currentRuntimeSelected,
    fallbackSelections,
    canaryRate: divide(ledger.summary.canarySelected, totalEntries),
    fallbackRate: divide(fallbackSelections, totalEntries),
    fallbackReasons: ledger.fallbackReasons.map((entry) => ({
      reason: entry.reason,
      count: entry.count,
    })),
    sourceViolationCount: ledger.invariants.sourceViolations.length,
    secretLeakDetected: ledger.summary.secretLeakDetected || hasSecretLeak(JSON.stringify(ledger)),
    readiness: safeText(ledger.recommendation.readiness),
  };
}

function buildFallbackTrends(history: AiFirstHistoricalReplayLedgerPoint[]): AiFirstHistoricalReplayFallbackTrend[] {
  const first = history[0] || null;
  const latest = history.at(-1) || null;
  if (!first || !latest) {
    return [];
  }
  const firstCounts = fallbackReasonMap(first.fallbackReasons);
  const latestCounts = fallbackReasonMap(latest.fallbackReasons);
  const reasons = Array.from(new Set([...firstCounts.keys(), ...latestCounts.keys()]))
    .sort((left, right) => left.localeCompare(right));
  return reasons.map((reason) => {
    const firstCount = firstCounts.get(reason) || 0;
    const latestCount = latestCounts.get(reason) || 0;
    return {
      reason,
      firstCount,
      latestCount,
      delta: latestCount - firstCount,
      isNewInLatest: firstCount === 0 && latestCount > 0,
    };
  });
}

function buildReplaySelectionChanges(
  ledgers: AiFirstRuntimeReceiptLedgerSnapshot[],
): AiFirstHistoricalReplaySelectionChange[] {
  const byRequest = new Map<string, Array<{
    ledgerId: string;
    selectedPath: AiFirstRuntimeEntrypointSelectedPath;
  }>>();
  for (const ledger of ledgers) {
    for (const entry of ledger.entries) {
      const requestId = safeId(entry.requestId);
      const current = byRequest.get(requestId) || [];
      current.push({
        ledgerId: safeId(ledger.ledgerId),
        selectedPath: entry.selectedPath,
      });
      byRequest.set(requestId, current);
    }
  }

  const changes: AiFirstHistoricalReplaySelectionChange[] = [];
  for (const [requestId, selections] of byRequest.entries()) {
    if (selections.length < 2) {
      continue;
    }
    const selectedPaths = selections.map((selection) => selection.selectedPath);
    const uniquePaths = new Set(selectedPaths);
    if (uniquePaths.size < 2) {
      continue;
    }
    const firstSelectedPath = selectedPaths[0]!;
    const latestSelectedPath = selectedPaths[selectedPaths.length - 1]!;
    changes.push({
      requestId,
      ledgerIds: selections.map((selection) => selection.ledgerId),
      selectedPaths,
      firstSelectedPath,
      latestSelectedPath,
      becameFallbackInLatest: firstSelectedPath === 'ai-first-canary' && latestSelectedPath === 'current-runtime',
    });
  }
  return changes.sort((left, right) => left.requestId.localeCompare(right.requestId));
}

function buildAggregate(input: {
  history: AiFirstHistoricalReplayLedgerPoint[];
  ledgers: AiFirstRuntimeReceiptLedgerSnapshot[];
  fallbackTrends: AiFirstHistoricalReplayFallbackTrend[];
  replaySelectionChanges: AiFirstHistoricalReplaySelectionChange[];
}): AiFirstHistoricalReplayGateSnapshot['aggregate'] {
  const baseline = input.history[0] || null;
  const latest = input.history.at(-1) || null;
  const totalEntries = input.history.reduce((sum, point) => sum + point.totalEntries, 0);
  const sourceViolationCount = input.history.reduce((sum, point) => sum + point.sourceViolationCount, 0);
  const secretLeakDetected = input.history.some((point) => point.secretLeakDetected)
    || hasSecretLeak(JSON.stringify(input.ledgers));
  const baselineCanaryRate = baseline?.canaryRate || 0;
  const latestCanaryRate = latest?.canaryRate || 0;
  const baselineFallbackRate = baseline?.fallbackRate || 0;
  const latestFallbackRate = latest?.fallbackRate || 0;
  return {
    totalLedgers: input.history.length,
    totalEntries,
    baselineLedgerId: baseline?.ledgerId || null,
    latestLedgerId: latest?.ledgerId || null,
    baselineCanaryRate,
    latestCanaryRate,
    canaryRateDrop: Math.max(0, baselineCanaryRate - latestCanaryRate),
    baselineFallbackRate,
    latestFallbackRate,
    fallbackRateIncrease: Math.max(0, latestFallbackRate - baselineFallbackRate),
    newFallbackReasonCount: input.fallbackTrends.filter((trend) => trend.isNewInLatest).length,
    replaySelectionChangeCount: input.replaySelectionChanges.length,
    emptyLedgerCount: input.history.filter((point) => point.totalEntries === 0).length,
    sourceViolationCount,
    secretLeakDetected,
  };
}

function buildFindings(input: {
  aggregate: AiFirstHistoricalReplayGateSnapshot['aggregate'];
  criteria: AiFirstHistoricalReplayCriteria;
  fallbackTrends: AiFirstHistoricalReplayFallbackTrend[];
  replaySelectionChanges: AiFirstHistoricalReplaySelectionChange[];
}): AiFirstHistoricalReplayFinding[] {
  const findings: AiFirstHistoricalReplayFinding[] = [];
  const add = (
    kind: AiFirstHistoricalReplayFinding['kind'],
    severity: AiFirstHistoricalReplayFinding['severity'],
    detail: string,
  ) => {
    findings.push({
      id: `gate-9-${kind}-${findings.length + 1}`,
      kind,
      severity,
      detail,
    });
  };

  if (input.aggregate.totalLedgers < input.criteria.minLedgers) {
    add('insufficient-history', 'medium', `${input.aggregate.totalLedgers} ledger(s) available; minimum is ${input.criteria.minLedgers}.`);
  }
  if (input.aggregate.totalEntries < input.criteria.minTotalEntries) {
    add('insufficient-entries', 'medium', `${input.aggregate.totalEntries} receipt entrie(s) available; minimum is ${input.criteria.minTotalEntries}.`);
  }
  if (input.aggregate.emptyLedgerCount > 0) {
    add('empty-ledger', 'high', `${input.aggregate.emptyLedgerCount} empty ledger(s) cannot support promotion.`);
  }
  if (input.aggregate.latestCanaryRate < input.criteria.minLatestCanaryRate) {
    add('low-canary-rate', 'medium', `Latest canary rate ${formatRate(input.aggregate.latestCanaryRate)} is below ${formatRate(input.criteria.minLatestCanaryRate)}.`);
  }
  if (input.aggregate.latestFallbackRate > input.criteria.maxLatestFallbackRate) {
    add('high-fallback-rate', 'medium', `Latest fallback rate ${formatRate(input.aggregate.latestFallbackRate)} is above ${formatRate(input.criteria.maxLatestFallbackRate)}.`);
  }
  if (input.aggregate.canaryRateDrop > input.criteria.maxCanaryRateDrop) {
    add('canary-rate-regression', 'high', `Canary rate dropped by ${formatRate(input.aggregate.canaryRateDrop)} from baseline to latest.`);
  }
  if (input.aggregate.fallbackRateIncrease > input.criteria.maxFallbackRateIncrease) {
    add('fallback-rate-regression', 'high', `Fallback rate increased by ${formatRate(input.aggregate.fallbackRateIncrease)} from baseline to latest.`);
  }
  if (input.criteria.requireNoNewFallbackReasons) {
    const newFallbackReasons = input.fallbackTrends.filter((trend) => trend.isNewInLatest);
    if (newFallbackReasons.length > 0) {
      add('new-fallback-reason', 'medium', `Latest ledger introduced ${newFallbackReasons.length} new fallback reason(s): ${newFallbackReasons.map((trend) => trend.reason).join(', ')}.`);
    }
  }
  if (input.criteria.requireStableReplaySelections && input.replaySelectionChanges.length > 0) {
    add('replay-selection-changed', 'medium', `${input.replaySelectionChanges.length} request replay selection(s) changed across ledgers.`);
  }
  if (input.criteria.requireNoInvariantViolations && input.aggregate.sourceViolationCount > 0) {
    add('source-invariant-violation', 'high', `${input.aggregate.sourceViolationCount} source invariant violation(s) detected in historical ledgers.`);
  }
  if (input.criteria.requireNoSecretLeaks && input.aggregate.secretLeakDetected) {
    add('secret-leak', 'high', 'Secret-like value detected in historical replay input.');
  }
  return findings;
}

function buildRecommendation(
  findings: AiFirstHistoricalReplayFinding[],
): AiFirstHistoricalReplayGateSnapshot['recommendation'] {
  const hasHigh = findings.some((finding) => finding.severity === 'high');
  const status: AiFirstHistoricalReplayGateStatus = hasHigh ? 'no-go'
    : findings.length > 0
      ? 'hold'
      : 'go';
  const action: AiFirstHistoricalReplayGateAction = status === 'go'
    ? 'prepare-broader-canary'
    : status === 'hold'
      ? findings.every((finding) => finding.kind === 'insufficient-history' || finding.kind === 'insufficient-entries') ? 'collect-more-history'
        : 'investigate-regressions'
      : findings.some((finding) => finding.kind === 'source-invariant-violation' || finding.kind === 'secret-leak' || finding.kind === 'empty-ledger') ? 'reject-promotion'
        : 'investigate-regressions';
  return {
    status,
    action,
    reason: recommendationReason(status, action, findings),
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
    canExecuteNow: false,
    promoteDefaultRuntime: false,
  };
}

function recommendationReason(
  status: AiFirstHistoricalReplayGateStatus,
  action: AiFirstHistoricalReplayGateAction,
  findings: AiFirstHistoricalReplayFinding[],
): string {
  if (status === 'go') {
    return 'Historical receipts are stable enough to prepare a broader canary; default runtime remains unchanged.';
  }
  if (action === 'collect-more-history') {
    return 'More receipt history is needed before increasing AI-first routing exposure.';
  }
  if (action === 'reject-promotion') {
    return 'Promotion is blocked by hard safety or integrity findings in the replay history.';
  }
  return `Promotion is held pending investigation of ${findings.length} replay finding(s).`;
}

function fallbackReasonMap(
  reasons: AiFirstHistoricalReplayLedgerPoint['fallbackReasons'],
): Map<AiFirstRuntimeEntrypointFallbackReason, number> {
  const map = new Map<AiFirstRuntimeEntrypointFallbackReason, number>();
  for (const entry of reasons) {
    map.set(entry.reason, (map.get(entry.reason) || 0) + entry.count);
  }
  return map;
}

function divide(numerator: number, denominator: number): number {
  return denominator > 0 ? roundRate(numerator / denominator) : 0;
}

function roundRate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function rate(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, numberValue));
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(0, Math.floor(numberValue));
}

function hasSecretLeak(value: string): boolean {
  return /\bxox[pbarfs]-[A-Za-z0-9-]{6,}\b/i.test(value)
    || /\bsk-[A-Za-z0-9_-]{12,}\b/.test(value)
    || /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/.test(value)
    || /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*\s*[:=]\s*[^\s,;]+/i.test(value);
}

function safeText(value: unknown): string {
  return redactSensitiveText(String(value || '').trim() || 'unknown');
}

function safeId(value: unknown): string {
  const text = safeText(value).toLowerCase();
  const id = text.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'id';
}
