import type {
  AgentRuntimeBudgetDecision,
  AgentRuntimeBudgetRequest,
} from '../contracts/runtime/AgentRuntimeGovernanceContract.js';
import type { AutonomousMissionUsage } from '../contracts/runtime/AutonomousEngineeringPartnerContract.js';

const USAGE_KEYS = [
  'actions', 'mutableActions', 'cost', 'durationMs', 'networkCalls',
  'filesystemWrites', 'externalDeliveries', 'failures',
] as const satisfies readonly (keyof AutonomousMissionUsage)[];

const BUDGET_KEYS: Record<keyof AutonomousMissionUsage, keyof AgentRuntimeBudgetRequest['budget']> = {
  actions: 'maxActions',
  mutableActions: 'maxMutableActions',
  cost: 'maxCost',
  durationMs: 'maxDurationMs',
  networkCalls: 'maxNetworkCalls',
  filesystemWrites: 'maxFilesystemWrites',
  externalDeliveries: 'maxExternalDeliveries',
  failures: 'pauseOnFailureCount',
};

const RISK_RANK = { low: 0, medium: 1, high: 2, critical: 3 } as const;

export class AgentRuntimeBudgetEnforcementService {
  private readonly now: () => Date;
  private readonly locks = new Map<string, Promise<void>>();
  private readonly reservations = new Map<string, AutonomousMissionUsage>();

  public constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now ?? (() => new Date());
  }

  public async authorize(input: AgentRuntimeBudgetRequest): Promise<AgentRuntimeBudgetDecision> {
    validateIdentity(input.workspaceId, 'workspaceId');
    validateIdentity(input.missionId, 'missionId');
    const lockKey = `${input.workspaceId}:${input.missionId}`;
    const previous = this.locks.get(lockKey) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.locks.set(lockKey, queued);
    await previous;
    try {
      const decision = this.evaluate(input, this.reservations.get(lockKey));
      if (decision.allowed) this.reservations.set(lockKey, decision.usage);
      return decision;
    } finally {
      release();
      if (this.locks.get(lockKey) === queued) this.locks.delete(lockKey);
    }
  }

  private evaluate(input: AgentRuntimeBudgetRequest, reserved?: AutonomousMissionUsage): AgentRuntimeBudgetDecision {
    const usage = emptyUsage();
    const remaining = emptyUsage();
    const blockers: string[] = [];
    for (const key of USAGE_KEYS) {
      const current = Math.max(nonNegative(input.usage[key], `usage.${key}`), reserved?.[key] ?? 0);
      const requested = nonNegative(input.requested[key], `requested.${key}`);
      const maximum = nonNegative(input.budget[BUDGET_KEYS[key]], `budget.${BUDGET_KEYS[key]}`);
      usage[key] = current + requested;
      remaining[key] = Math.max(0, maximum - usage[key]);
      if (usage[key] > maximum) blockers.push(`${key} would exceed its runtime budget.`);
    }
    const now = this.now();
    const expiresAt = Date.parse(input.budget.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) blockers.push('The runtime budget has expired.');
    if (input.riskLevel && RISK_RANK[input.riskLevel] > RISK_RANK[input.budget.requiresHumanReviewAboveRisk]) {
      blockers.push('The requested risk level requires human review.');
    }
    return {
      allowed: blockers.length === 0,
      workspaceId: input.workspaceId,
      missionId: input.missionId,
      evaluatedAt: now.toISOString(),
      usage,
      remaining,
      blockers,
    };
  }
}

function emptyUsage(): AutonomousMissionUsage {
  return { actions: 0, mutableActions: 0, cost: 0, durationMs: 0, networkCalls: 0, filesystemWrites: 0, externalDeliveries: 0, failures: 0 };
}

function nonNegative(value: unknown, field: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${field} must be a finite non-negative number.`);
  return parsed;
}

function validateIdentity(value: string, field: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(`${field} is invalid.`);
}
