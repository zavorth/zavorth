/**
 * Risk Budget OS contract (Proof OS companion).
 *
 * Daily counters + mode-based limits for disk / shell / network / model cost units.
 * Composes with autonomy slider + trusted operator; does not replace them.
 */

export const RISK_BUDGET_CONTRACT_VERSION = '2026-07-11.proof-os-risk-budget-v1' as const;

export type RiskBudgetMode = 'observer' | 'operator' | 'autopilot';

export type RiskBudgetDimension =
  | 'diskMutations'
  | 'shellCommands'
  | 'networkSends'
  | 'modelCostUnits';

export type RiskBudgetRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type RiskBudgetLimits = Record<RiskBudgetDimension, number>;

export type RiskBudgetCounters = Record<RiskBudgetDimension, number>;

export type RiskBudgetState = {
  contractVersion: typeof RISK_BUDGET_CONTRACT_VERSION;
  mode: RiskBudgetMode;
  /** Local calendar day key YYYY-MM-DD (from configured timezone / local offset). */
  dayKey: string;
  counters: RiskBudgetCounters;
  /** Effective limits for the current mode. */
  limits: RiskBudgetLimits;
  /** True when autopilot exhausted a dimension or force freeze was applied. */
  frozen: boolean;
  updatedAt: string;
  notes: string | null;
};

export type RiskBudgetSpendRequest = {
  dimension: RiskBudgetDimension;
  /** Default 1. */
  amount?: number;
  riskLevel?: RiskBudgetRiskLevel;
  toolName?: string | null;
  summary?: string | null;
};

export type RiskBudgetSpendDecision = {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  remaining: number;
  state: RiskBudgetState;
  proofEventId: string | null;
};

export const RISK_BUDGET_DIMENSIONS: readonly RiskBudgetDimension[] = [
  'diskMutations',
  'shellCommands',
  'networkSends',
  'modelCostUnits',
] as const;

export const RISK_BUDGET_MODES: readonly RiskBudgetMode[] = [
  'observer',
  'operator',
  'autopilot',
] as const;

/** English human labels for mode codes (full i18n is P12). */
export const RISK_BUDGET_MODE_LABELS: Readonly<Record<RiskBudgetMode, string>> = {
  observer: 'Observer',
  operator: 'Operator',
  autopilot: 'Autopilot',
};

/** Mutation dimensions blocked in observer mode without explicit approval. */
export const RISK_BUDGET_MUTATION_DIMENSIONS: readonly RiskBudgetDimension[] = [
  'diskMutations',
  'shellCommands',
  'networkSends',
] as const;

export const DEFAULT_OPERATOR_LIMITS: RiskBudgetLimits = {
  diskMutations: 50,
  shellCommands: 30,
  networkSends: 40,
  modelCostUnits: 1000,
};

export const DEFAULT_AUTOPILOT_LIMITS: RiskBudgetLimits = {
  diskMutations: 10,
  shellCommands: 5,
  networkSends: 15,
  modelCostUnits: 200,
};

export const DEFAULT_OBSERVER_LIMITS: RiskBudgetLimits = {
  diskMutations: 0,
  shellCommands: 0,
  networkSends: 0,
  modelCostUnits: 0,
};
