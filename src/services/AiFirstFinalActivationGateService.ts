import {
  AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION,
  type AiFirstFinalActivationAction,
  type AiFirstFinalActivationFinding,
  type AiFirstFinalActivationGateSnapshot,
  type AiFirstFinalActivationPhaseSummary,
  type AiFirstFinalActivationReadiness,
} from '../contracts/AiFirstFinalActivationGateContract.js';
import type { AiFirstHistoricalReplayGateSnapshot } from '../contracts/AiFirstHistoricalReplayGateContract.js';
import type { AiFirstLimitedCanarySwitchboardSnapshot } from '../contracts/AiFirstLimitedCanarySwitchboardContract.js';
import type { AiFirstPromotionCandidateRegistrySnapshot } from '../contracts/AiFirstPromotionCandidateRegistryContract.js';
import type { AiFirstRuntimeReceiptLedgerSnapshot } from '../contracts/AiFirstRuntimeReceiptLedgerContract.js';
import type { AiFirstShadowBatchRecorderSnapshot } from '../contracts/AiFirstShadowBatchRecorderContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type AiFirstFinalActivationGateRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstFinalActivationGateInput = {
  activationName?: string | null;
  batchSnapshot: AiFirstShadowBatchRecorderSnapshot;
  registrySnapshot: AiFirstPromotionCandidateRegistrySnapshot;
  switchboardSnapshot: AiFirstLimitedCanarySwitchboardSnapshot;
  ledgerSnapshot: AiFirstRuntimeReceiptLedgerSnapshot;
  historicalGateSnapshot: AiFirstHistoricalReplayGateSnapshot;
};

export class AiFirstFinalActivationGateService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstFinalActivationGateRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public buildGate(input: AiFirstFinalActivationGateInput): AiFirstFinalActivationGateSnapshot {
    const phaseSummaries = buildPhaseSummaries(input);
    const aggregate = buildAggregate(input);
    const findings = buildFindings(input, aggregate);
    const recommendation = buildRecommendation(findings);

    return {
      contractVersion: AI_FIRST_FINAL_ACTIVATION_GATE_CONTRACT_VERSION,
      source: 'ai-first-final-activation-gate',
      generatedAt: this.now().toISOString(),
      activationGateId: this.idFactory('activation-gate'),
      input: {
        activationName: safeText(input.activationName || 'ai-first-final-activation-gate'),
        batchId: safeId(input.batchSnapshot.batchId),
        registryId: safeId(input.registrySnapshot.registryId),
        switchboardId: safeId(input.switchboardSnapshot.switchboardId),
        ledgerId: safeId(input.ledgerSnapshot.ledgerId),
        historicalGateId: safeId(input.historicalGateSnapshot.gateId),
      },
      phaseSummaries,
      aggregate: {
        ...aggregate,
        finalFindingCount: findings.length,
      },
      findings,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'phase-summary',
          detail: `${phaseSummaries.length} AI-first promotion phase(s) consolidated into the activation gate.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'activation-decision',
          detail: `Final activation readiness: ${recommendation.readiness}.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'owner-approval',
          detail: 'Owner approval is still required before any controlled default routing change.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'fallback',
          detail: 'Current runtime fallback remains required for controlled activation.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Intent model0 does not flip the default runtime and does not execute tools.',
        },
      ],
      gates: [
        {
          id: 'checkpoint-10-receipts-present',
          status: aggregate.allReceiptsPresent ? 'passed' : 'warning',
          detail: aggregate.allReceiptsPresent
            ? 'Required phase receipts are present.'
            : 'One or more phase snapshots has no receipts.',
        },
        {
          id: 'checkpoint-10-runtime-invariants-preserved',
          status: aggregate.allRuntimeInvariantsPreserved ? 'passed' : 'blocked',
          detail: aggregate.allRuntimeInvariantsPreserved
            ? 'All phase recommendations preserve runtime invariants.'
            : 'One or more phase recommendation violates runtime invariants.',
        },
        {
          id: 'checkpoint-10-owner-controlled-only',
          status: 'passed',
          detail: 'Automatic activation remains disabled and owner approval remains required.',
        },
        {
          id: 'checkpoint-10-final-readiness',
          status: recommendation.readiness === 'blocked'
            ? 'blocked'
            : recommendation.readiness === 'hold'
              ? 'warning'
              : 'passed',
          detail: recommendation.reason,
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstFinalActivationGateSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Intent model0');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- activationGateId: ${snapshot.activationGateId}`);
    lines.push(`- readiness: ${snapshot.recommendation.readiness}`);
    lines.push(`- action: ${snapshot.recommendation.action}`);
    lines.push(`- samples: ${snapshot.aggregate.sampleCount}`);
    lines.push(`- passRate: ${formatRate(snapshot.aggregate.batchPassRate)}`);
    lines.push(`- canaryEnabledRoutes: ${snapshot.aggregate.canaryEnabledRoutes}`);
    lines.push(`- canarySelections: ${snapshot.aggregate.canarySelections}`);
    lines.push(`- latestCanaryRate: ${formatRate(snapshot.aggregate.latestCanaryRate)}`);
    lines.push(`- latestFallbackRate: ${formatRate(snapshot.aggregate.latestFallbackRate)}`);
    lines.push(`- ownerApprovalRequired: ${String(snapshot.recommendation.ownerApprovalRequired)}`);
    lines.push(`- activateAutomatically: ${String(snapshot.recommendation.activateAutomatically)}`);
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
    lines.push('## Phase summaries');
    for (const summary of snapshot.phaseSummaries) {
      lines.push(`- ${summary.phase}: ${summary.status} / ${summary.readiness} - ${summary.detail}`);
    }
    return lines.join('\n');
  }
}

type AggregateDraft = Omit<AiFirstFinalActivationGateSnapshot['aggregate'], 'finalFindingCount'>;

function buildPhaseSummaries(input: AiFirstFinalActivationGateInput): AiFirstFinalActivationPhaseSummary[] {
  return [
    {
      phase: 'checkpoint-4',
      sourceId: safeId(input.batchSnapshot.batchId),
      readiness: input.batchSnapshot.recommendation.readiness,
      action: input.batchSnapshot.recommendation.action,
      status: input.batchSnapshot.recommendation.readiness === 'candidate' && input.batchSnapshot.score.criteriaPassed
        ? 'passed'
        : input.batchSnapshot.statusCounts.block > 0
          ? 'blocked'
          : 'warning',
      receiptCount: input.batchSnapshot.receipts.length,
      gateCount: input.batchSnapshot.gates.length,
      detail: `${input.batchSnapshot.score.sampleCount} shadow sample(s), passRate=${formatRate(input.batchSnapshot.score.passRate)}.`,
    },
    {
      phase: 'checkpoint-5',
      sourceId: safeId(input.registrySnapshot.registryId),
      readiness: input.registrySnapshot.recommendation.readiness,
      action: input.registrySnapshot.recommendation.action,
      status: input.registrySnapshot.recommendation.readiness === 'ready-for-manual-canary'
        ? 'passed'
        : input.registrySnapshot.recommendation.readiness === 'blocked'
          ? 'blocked'
          : 'warning',
      receiptCount: input.registrySnapshot.receipts.length,
      gateCount: input.registrySnapshot.gates.length,
      detail: `${input.registrySnapshot.summary.eligibleFamilies} eligible family/families and ${input.registrySnapshot.summary.proposedAllowlistEntries} allowlist proposal(s).`,
    },
    {
      phase: 'checkpoint-6',
      sourceId: safeId(input.switchboardSnapshot.switchboardId),
      readiness: input.switchboardSnapshot.recommendation.readiness,
      action: input.switchboardSnapshot.recommendation.action,
      status: input.switchboardSnapshot.recommendation.readiness === 'canary-ready'
        ? 'passed'
        : 'warning',
      receiptCount: input.switchboardSnapshot.receipts.length,
      gateCount: input.switchboardSnapshot.gates.length,
      detail: `${input.switchboardSnapshot.summary.canaryEnabledRoutes} route(s) enabled and ${input.switchboardSnapshot.summary.aiFirstCanarySelections} canary selection(s).`,
    },
    {
      phase: 'checkpoint-8',
      sourceId: safeId(input.ledgerSnapshot.ledgerId),
      readiness: input.ledgerSnapshot.recommendation.readiness,
      action: input.ledgerSnapshot.recommendation.action,
      status: input.ledgerSnapshot.recommendation.readiness === 'ledger-clean'
        ? 'passed'
        : 'blocked',
      receiptCount: input.ledgerSnapshot.receipts.length,
      gateCount: input.ledgerSnapshot.gates.length,
      detail: `${input.ledgerSnapshot.summary.totalEntries} runtime receipt entrie(s) captured.`,
    },
    {
      phase: 'checkpoint-9',
      sourceId: safeId(input.historicalGateSnapshot.gateId),
      readiness: input.historicalGateSnapshot.recommendation.status,
      action: input.historicalGateSnapshot.recommendation.action,
      status: input.historicalGateSnapshot.recommendation.status === 'go'
        ? 'passed'
        : input.historicalGateSnapshot.recommendation.status === 'no-go'
          ? 'blocked'
          : 'warning',
      receiptCount: input.historicalGateSnapshot.receipts.length,
      gateCount: input.historicalGateSnapshot.gates.length,
      detail: `${input.historicalGateSnapshot.aggregate.totalLedgers} historical ledger(s), latestCanaryRate=${formatRate(input.historicalGateSnapshot.aggregate.latestCanaryRate)}.`,
    },
  ];
}

function buildAggregate(input: AiFirstFinalActivationGateInput): AggregateDraft {
  const allReceiptsPresent = [
    input.batchSnapshot.receipts,
    input.registrySnapshot.receipts,
    input.switchboardSnapshot.receipts,
    input.ledgerSnapshot.receipts,
    input.historicalGateSnapshot.receipts,
  ].every((receipts) => receipts.length > 0);

  return {
    sampleCount: input.batchSnapshot.score.sampleCount,
    batchPassRate: input.batchSnapshot.score.passRate,
    batchBlockRate: input.batchSnapshot.score.blockRate,
    eligibleFamilies: input.registrySnapshot.summary.eligibleFamilies,
    proposedAllowlistEntries: input.registrySnapshot.summary.proposedAllowlistEntries,
    canaryEnabledRoutes: input.switchboardSnapshot.summary.canaryEnabledRoutes,
    canarySelections: input.switchboardSnapshot.summary.aiFirstCanarySelections,
    fallbackSelections: input.switchboardSnapshot.summary.fallbackSelections,
    ledgerEntries: input.ledgerSnapshot.summary.totalEntries,
    latestCanaryRate: input.historicalGateSnapshot.aggregate.latestCanaryRate,
    latestFallbackRate: input.historicalGateSnapshot.aggregate.latestFallbackRate,
    historicalFindingCount: input.historicalGateSnapshot.findings.length,
    allReceiptsPresent,
    allRuntimeInvariantsPreserved: runtimeInvariantsPreserved(input),
    ownerApprovalRequired: true,
    automaticActivationAllowed: false,
  };
}

function buildFindings(
  input: AiFirstFinalActivationGateInput,
  aggregate: AggregateDraft,
): AiFirstFinalActivationFinding[] {
  const findings: AiFirstFinalActivationFinding[] = [];
  const add = (
    kind: AiFirstFinalActivationFinding['kind'],
    severity: AiFirstFinalActivationFinding['severity'],
    detail: string,
  ) => {
    findings.push({
      id: `checkpoint-10-${kind}-${findings.length + 1}`,
      kind,
      severity,
      detail,
    });
  };

  if (input.batchSnapshot.recommendation.readiness !== 'candidate') {
    add('batch-not-candidate', input.batchSnapshot.statusCounts.block > 0 ? 'high' : 'medium', `Batch readiness is ${input.batchSnapshot.recommendation.readiness}.`);
  }
  if (!input.batchSnapshot.score.criteriaPassed) {
    add('batch-criteria-failed', 'high', `Batch failed criteria: ${input.batchSnapshot.score.failedCriteria.join(', ') || 'unknown'}.`);
  }
  if (input.registrySnapshot.recommendation.readiness !== 'ready-for-manual-canary') {
    add('registry-not-ready', input.registrySnapshot.recommendation.readiness === 'blocked' ? 'high' : 'medium', `Registry readiness is ${input.registrySnapshot.recommendation.readiness}.`);
  }
  if (input.registrySnapshot.summary.proposedAllowlistEntries < 1) {
    add('allowlist-missing', 'medium', 'No proposed allowlist entry is available for controlled activation.');
  }
  if (input.switchboardSnapshot.recommendation.readiness !== 'canary-ready') {
    add('switchboard-not-ready', 'medium', `Switchboard readiness is ${input.switchboardSnapshot.recommendation.readiness}.`);
  }
  if (input.switchboardSnapshot.summary.canaryEnabledRoutes < 1) {
    add('manual-canary-missing', 'medium', 'No manually enabled canary route is present.');
  }
  if (input.switchboardSnapshot.summary.aiFirstCanarySelections < 1) {
    add('canary-selection-missing', 'medium', 'No AI-first canary selection has been observed.');
  }
  if (input.ledgerSnapshot.recommendation.readiness !== 'ledger-clean') {
    add('ledger-not-clean', 'high', `Latest ledger readiness is ${input.ledgerSnapshot.recommendation.readiness}.`);
  }
  if (input.ledgerSnapshot.invariants.sourceViolations.length > 0) {
    add('ledger-source-violation', 'high', `${input.ledgerSnapshot.invariants.sourceViolations.length} ledger source invariant violation(s) detected.`);
  }
  if (input.ledgerSnapshot.summary.secretLeakDetected) {
    add('ledger-secret-leak', 'high', 'Latest ledger reports secret-like content.');
  }
  if (input.historicalGateSnapshot.recommendation.status === 'hold') {
    add('historical-gate-hold', 'medium', `Historical gate is on hold: ${input.historicalGateSnapshot.recommendation.reason}`);
  }
  if (input.historicalGateSnapshot.recommendation.status === 'no-go') {
    add('historical-gate-blocked', 'high', `Historical gate blocked activation: ${input.historicalGateSnapshot.recommendation.reason}`);
  }
  if (!aggregate.allRuntimeInvariantsPreserved) {
    add('runtime-invariant-violation', 'high', 'At least one phase snapshot does not preserve default runtime invariants.');
  }
  return findings;
}

function buildRecommendation(
  findings: AiFirstFinalActivationFinding[],
): AiFirstFinalActivationGateSnapshot['recommendation'] {
  const hasHigh = findings.some((finding) => finding.severity === 'high');
  const readiness: AiFirstFinalActivationReadiness = hasHigh
    ? 'blocked'
    : findings.length > 0
      ? 'hold'
      : 'ready-for-owner-controlled-default';
  const action: AiFirstFinalActivationAction = readiness === 'ready-for-owner-controlled-default'
    ? 'prepare-owner-controlled-default'
    : readiness === 'hold'
      ? findings.every((finding) => finding.kind === 'historical-gate-hold')
        ? 'collect-more-history'
        : 'continue-canary'
      : findings.some((finding) => finding.kind === 'runtime-invariant-violation' || finding.kind === 'ledger-secret-leak')
        ? 'reject-activation'
        : 'investigate-blockers';

  return {
    readiness,
    action,
    reason: recommendationReason(readiness, action, findings),
    defaultRuntimeChanged: false,
    keepCurrentRuntimeDecision: true,
    canExecuteNow: false,
    activateAutomatically: false,
    ownerApprovalRequired: true,
    promoteDefaultRuntime: false,
  };
}

function recommendationReason(
  readiness: AiFirstFinalActivationReadiness,
  action: AiFirstFinalActivationAction,
  findings: AiFirstFinalActivationFinding[],
): string {
  if (readiness === 'ready-for-owner-controlled-default') {
    return 'All AI-first promotion phases are clean enough to prepare owner-controlled default routing.';
  }
  if (action === 'collect-more-history') {
    return 'Activation remains on hold while more historical canary receipts are collected.';
  }
  if (readiness === 'blocked') {
    return `Activation is blocked by ${findings.length} finding(s).`;
  }
  return `Activation remains on hold pending ${findings.length} finding(s).`;
}

function runtimeInvariantsPreserved(input: AiFirstFinalActivationGateInput): boolean {
  const recommendations = [
    input.batchSnapshot.recommendation,
    input.registrySnapshot.recommendation,
    input.switchboardSnapshot.recommendation,
    input.ledgerSnapshot.recommendation,
    input.historicalGateSnapshot.recommendation,
  ];
  return recommendations.every((recommendation) =>
    recommendation.defaultRuntimeChanged === false
    && recommendation.keepCurrentRuntimeDecision === true
    && recommendation.canExecuteNow === false)
    && input.registrySnapshot.recommendation.activateAutomatically === false
    && input.switchboardSnapshot.recommendation.activateAutomatically === false
    && input.historicalGateSnapshot.recommendation.promoteDefaultRuntime === false;
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function safeText(value: unknown): string {
  return redactSensitiveText(String(value || '').trim() || 'unknown');
}

function safeId(value: unknown): string {
  const text = safeText(value).toLowerCase();
  const id = text.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'id';
}
