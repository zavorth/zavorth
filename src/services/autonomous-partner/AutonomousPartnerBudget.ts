import type {
  AutonomousMissionRecord,
  ZavorthAutonomyBudget,
  ZavorthAutonomyLevel,
} from '../../contracts/AutonomousEngineeringPartnerContract.js';
import type { ZavorthMutationRiskLevel } from '../../contracts/ZavorthMutationPlaneContract.js';
import {
  cleanText,
  nonNegative,
  normalizeBudgetScope,
  normalizeRisk,
  positiveNumber,
  riskRank,
} from './AutonomousPartnerUtils.js';

type BudgetBase = Omit<ZavorthAutonomyBudget, 'expiresAt' | 'requiresHumanReviewAboveRisk'>;

const DEFAULT_BUDGETS: Record<ZavorthAutonomyLevel, BudgetBase> = {
  assist: {
    scope: 'run',
    maxActions: 4,
    maxMutableActions: 0,
    maxCost: 0,
    maxDurationMs: 30 * 60 * 1000,
    maxNetworkCalls: 2,
    maxFilesystemWrites: 0,
    maxExternalDeliveries: 0,
    pauseOnFailureCount: 1,
  },
  draft: {
    scope: 'run',
    maxActions: 8,
    maxMutableActions: 1,
    maxCost: 1,
    maxDurationMs: 60 * 60 * 1000,
    maxNetworkCalls: 5,
    maxFilesystemWrites: 5,
    maxExternalDeliveries: 0,
    pauseOnFailureCount: 2,
  },
  supervised: {
    scope: 'session',
    maxActions: 16,
    maxMutableActions: 4,
    maxCost: 5,
    maxDurationMs: 2 * 60 * 60 * 1000,
    maxNetworkCalls: 20,
    maxFilesystemWrites: 25,
    maxExternalDeliveries: 2,
    pauseOnFailureCount: 3,
  },
  delegated: {
    scope: 'session',
    maxActions: 32,
    maxMutableActions: 8,
    maxCost: 10,
    maxDurationMs: 4 * 60 * 60 * 1000,
    maxNetworkCalls: 50,
    maxFilesystemWrites: 80,
    maxExternalDeliveries: 5,
    pauseOnFailureCount: 3,
  },
  'autonomous-with-budget': {
    scope: 'run',
    maxActions: 64,
    maxMutableActions: 12,
    maxCost: 20,
    maxDurationMs: 8 * 60 * 60 * 1000,
    maxNetworkCalls: 100,
    maxFilesystemWrites: 150,
    maxExternalDeliveries: 8,
    pauseOnFailureCount: 2,
  },
};

export function normalizeAutonomyBudget(
  input: Partial<ZavorthAutonomyBudget> | null | undefined,
  level: ZavorthAutonomyLevel,
  riskLevel: ZavorthMutationRiskLevel,
  now: () => Date,
): ZavorthAutonomyBudget {
  const defaults = defaultBudgetFor(level, riskLevel, now);
  const maxDurationMs = positiveNumber(input?.maxDurationMs, defaults.maxDurationMs, 60_000, 24 * 60 * 60 * 1000);
  return {
    scope: normalizeBudgetScope(input?.scope, defaults.scope),
    maxActions: positiveNumber(input?.maxActions, defaults.maxActions, 1, 500),
    maxMutableActions: positiveNumber(input?.maxMutableActions, defaults.maxMutableActions, 0, 100),
    maxCost: positiveNumber(input?.maxCost, defaults.maxCost, 0, 10_000),
    maxDurationMs,
    maxNetworkCalls: positiveNumber(input?.maxNetworkCalls, defaults.maxNetworkCalls, 0, 10_000),
    maxFilesystemWrites: positiveNumber(input?.maxFilesystemWrites, defaults.maxFilesystemWrites, 0, 10_000),
    maxExternalDeliveries: positiveNumber(input?.maxExternalDeliveries, defaults.maxExternalDeliveries, 0, 1000),
    pauseOnFailureCount: positiveNumber(input?.pauseOnFailureCount, defaults.pauseOnFailureCount, 1, 20),
    requiresHumanReviewAboveRisk: normalizeRisk(
      input?.requiresHumanReviewAboveRisk || defaults.requiresHumanReviewAboveRisk,
    ),
    expiresAt: cleanText(input?.expiresAt, new Date(now().getTime() + maxDurationMs).toISOString()),
  };
}

export function defaultBudgetFor(
  level: ZavorthAutonomyLevel,
  riskLevel: ZavorthMutationRiskLevel,
  now: () => Date,
): ZavorthAutonomyBudget {
  const reviewRisk: ZavorthMutationRiskLevel = riskRank(riskLevel) >= riskRank('high') ? 'medium' : 'high';
  return {
    ...DEFAULT_BUDGETS[level],
    requiresHumanReviewAboveRisk: reviewRisk,
    expiresAt: new Date(now().getTime() + DEFAULT_BUDGETS[level].maxDurationMs).toISOString(),
  };
}

export function evaluateAutonomyBudget(
  mission: AutonomousMissionRecord,
  observedRisk?: ZavorthMutationRiskLevel | string | null,
  now: () => Date = () => new Date(),
): string[] {
  const blockers: string[] = [];
  const { usage, budget } = mission;
  if (usage.actions > budget.maxActions) {
    blockers.push(`Action budget exceeded: ${usage.actions}/${budget.maxActions}.`);
  }
  if (usage.mutableActions > budget.maxMutableActions) {
    blockers.push(`Mutation budget exceeded: ${usage.mutableActions}/${budget.maxMutableActions}.`);
  }
  if (usage.cost > budget.maxCost) {
    blockers.push(`Cost budget exceeded: ${usage.cost}/${budget.maxCost}.`);
  }
  if (usage.durationMs > budget.maxDurationMs) {
    blockers.push(`Duration budget exceeded: ${usage.durationMs}/${budget.maxDurationMs}ms.`);
  }
  if (usage.networkCalls > budget.maxNetworkCalls) {
    blockers.push(`Network budget exceeded: ${usage.networkCalls}/${budget.maxNetworkCalls}.`);
  }
  if (usage.filesystemWrites > budget.maxFilesystemWrites) {
    blockers.push(`Filesystem write budget exceeded: ${usage.filesystemWrites}/${budget.maxFilesystemWrites}.`);
  }
  if (usage.externalDeliveries > budget.maxExternalDeliveries) {
    blockers.push(`External delivery budget exceeded: ${usage.externalDeliveries}/${budget.maxExternalDeliveries}.`);
  }
  if (usage.failures >= budget.pauseOnFailureCount) {
    blockers.push(`Repeated failures reached the limit: ${usage.failures}/${budget.pauseOnFailureCount}.`);
  }
  const risk = observedRisk ? normalizeRisk(observedRisk) : mission.riskLevel;
  if (riskRank(risk) > riskRank(budget.requiresHumanReviewAboveRisk) && mission.status !== 'waiting_approval') {
    blockers.push(`Risk ${risk} exceeds review threshold ${budget.requiresHumanReviewAboveRisk}.`);
  }
  const expiresAtMs = Date.parse(budget.expiresAt);
  if (Number.isFinite(expiresAtMs) && expiresAtMs < now().getTime()) {
    blockers.push('Budget expired before completion.');
  }
  return blockers;
}
