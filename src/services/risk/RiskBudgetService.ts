/**
 * Risk Budget OS — daily spend ceilings by dimension + mode.
 *
 * Composes (does not replace):
 * - ZavorthAutonomySliderService (via suggestModeFromAutonomyLevel)
 * - TrustedOperatorModeService (optional slight limit boost in operator mode)
 * - ProofLedgerService (mode change + budget exhaust events)
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_AUTOPILOT_LIMITS,
  DEFAULT_OBSERVER_LIMITS,
  DEFAULT_OPERATOR_LIMITS,
  RISK_BUDGET_CONTRACT_VERSION,
  RISK_BUDGET_DIMENSIONS,
  RISK_BUDGET_MODE_LABELS,
  RISK_BUDGET_MUTATION_DIMENSIONS,
  type RiskBudgetCounters,
  type RiskBudgetDimension,
  type RiskBudgetLimits,
  type RiskBudgetMode,
  type RiskBudgetRiskLevel,
  type RiskBudgetSpendDecision,
  type RiskBudgetSpendRequest,
  type RiskBudgetState,
} from '../../contracts/risk/RiskBudgetContract.js';
import type { ProofLedgerService } from '../proof/ProofLedgerService.js';

export type RiskBudgetServiceOptions = {
  stateFile?: string;
  now?: () => Date;
  /**
   * Timezone for dayKey. Prefer local calendar day.
   * - undefined / 'local' → host local offset
   * - 'UTC' → UTC date
   * - IANA tz strings are best-effort via Intl; falls back to local
   */
  timezone?: string | null;
  proofLedger?: Pick<ProofLedgerService, 'append'> | null;
  /**
   * Optional Trusted Operator composition.
   * When enabled and mode is operator, effective limits are raised slightly
   * (documented boost; never bypasses freeze / observer / autopilot hard caps).
   */
  trustedOperator?: { isEnabled(): boolean } | null;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  idFactory?: (prefix: string) => string;
};

const MUTATION_DIM_SET = new Set<string>(RISK_BUDGET_MUTATION_DIMENSIONS);

/** Soft warning threshold for operator mode (tracked usage, not hard block). */
const OPERATOR_SOFT_RATIO = 0.8;

/** Trusted-operator boost applied only in operator mode when TO is on. */
const TRUSTED_OPERATOR_BOOST: Partial<RiskBudgetLimits> = {
  diskMutations: 10,
  shellCommands: 5,
  networkSends: 10,
  modelCostUnits: 200,
};

export function defaultRiskBudgetStatePath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.zavorth', 'risk-budget.json');
}

export function suggestModeFromAutonomyLevel(
  level: string | null | undefined,
): RiskBudgetMode {
  const text = String(level || '').trim().toLowerCase();
  if (text === 'conservative' || text === 'safe' || text === 'strict' || text === 'observer') {
    return 'observer';
  }
  if (text === 'advanced' || text === 'power' || text === 'technical' || text === 'autopilot') {
    // Advanced maps to autopilot but remains capped by autopilot daily ceilings.
    return 'autopilot';
  }
  // balanced, business, default → governed operator path
  return 'operator';
}

export function limitsForMode(mode: RiskBudgetMode): RiskBudgetLimits {
  if (mode === 'observer') return { ...DEFAULT_OBSERVER_LIMITS };
  if (mode === 'autopilot') return { ...DEFAULT_AUTOPILOT_LIMITS };
  return { ...DEFAULT_OPERATOR_LIMITS };
}

function emptyCounters(): RiskBudgetCounters {
  return {
    diskMutations: 0,
    shellCommands: 0,
    networkSends: 0,
    modelCostUnits: 0,
  };
}

function cloneState(state: RiskBudgetState): RiskBudgetState {
  return {
    ...state,
    counters: { ...state.counters },
    limits: { ...state.limits },
  };
}

export class RiskBudgetService {
  private readonly stateFile: string;
  private readonly now: () => Date;
  private readonly timezone: string | null;
  private readonly proofLedger: Pick<ProofLedgerService, 'append'> | null;
  private readonly trustedOperator: { isEnabled(): boolean } | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly idFactory: (prefix: string) => string;
  private state: RiskBudgetState;
  private sequence = 0;

  constructor(options: RiskBudgetServiceOptions = {}) {
    this.stateFile = path.resolve(
      options.stateFile || defaultRiskBudgetStatePath(process.cwd()),
    );
    this.now = options.now || (() => new Date());
    this.timezone = options.timezone === undefined ? 'local' : options.timezone;
    this.proofLedger = options.proofLedger ?? null;
    this.trustedOperator = options.trustedOperator ?? null;
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.idFactory = options.idFactory
      || ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.state = this.load();
    this.ensureDayRollover(false);
  }

  public getState(): RiskBudgetState {
    this.ensureDayRollover(true);
    return cloneState(this.withEffectiveLimits(this.state));
  }

  public setMode(mode: RiskBudgetMode, notes: string | null = null): RiskBudgetState {
    const nextMode = normalizeMode(mode);
    this.ensureDayRollover(false);
    const previous = this.state.mode;
    this.state = {
      ...this.state,
      mode: nextMode,
      limits: this.computeEffectiveLimits(nextMode),
      notes: notes ?? this.state.notes,
      updatedAt: this.now().toISOString(),
    };
    this.persist();
    this.emitProof({
      title: 'Risk budget mode changed',
      summary: `Risk budget mode changed from ${previous} to ${nextMode}.`,
      status: 'ok',
      riskLevel: 'none',
      metadata: { previousMode: previous, mode: nextMode },
    });
    return this.getState();
  }

  public spend(req: RiskBudgetSpendRequest): RiskBudgetSpendDecision {
    this.ensureDayRollover(true);
    const dimension = normalizeDimension(req.dimension);
    if (!dimension) {
      const state = this.getState();
      return {
        allowed: false,
        reason: `Unknown risk budget dimension: ${String(req.dimension)}`,
        requiresApproval: true,
        remaining: 0,
        state,
        proofEventId: null,
      };
    }

    const amountRaw = req.amount === undefined || req.amount === null ? 1 : Number(req.amount);
    const amount = Number.isFinite(amountRaw) ? Math.max(0, Math.floor(amountRaw)) : 1;
    const riskLevel = normalizeRiskLevel(req.riskLevel);
    const mode = this.state.mode;
    const limits = this.computeEffectiveLimits(mode);
    this.state.limits = limits;

    if (amount === 0) {
      const remaining = Math.max(0, limits[dimension] - this.state.counters[dimension]);
      return {
        allowed: true,
        reason: 'Zero-amount spend is a no-op.',
        requiresApproval: false,
        remaining,
        state: this.getState(),
        proofEventId: null,
      };
    }

    if (this.state.frozen) {
      return {
        allowed: false,
        reason: 'Risk budget is frozen; spends are blocked until unfreeze or day reset.',
        requiresApproval: true,
        remaining: Math.max(0, limits[dimension] - this.state.counters[dimension]),
        state: this.getState(),
        proofEventId: null,
      };
    }

    // Observer: no mutation side effects without explicit approval.
    if (mode === 'observer' && MUTATION_DIM_SET.has(dimension)) {
      return {
        allowed: false,
        reason: 'Observer mode blocks mutation budget spends without explicit approval.',
        requiresApproval: true,
        remaining: Math.max(0, limits[dimension] - this.state.counters[dimension]),
        state: this.getState(),
        proofEventId: null,
      };
    }

    // Observer also treats model cost as approval-gated when ceiling is 0.
    if (mode === 'observer' && dimension === 'modelCostUnits' && limits[dimension] <= 0) {
      return {
        allowed: false,
        reason: 'Observer mode has no model cost budget; approval required.',
        requiresApproval: true,
        remaining: 0,
        state: this.getState(),
        proofEventId: null,
      };
    }

    // Autopilot: only low/none risk may auto-spend.
    if (mode === 'autopilot' && riskLevel !== 'none' && riskLevel !== 'low') {
      return {
        allowed: false,
        reason: `Autopilot only auto-spends low-risk actions; risk=${riskLevel} requires approval.`,
        requiresApproval: true,
        remaining: Math.max(0, limits[dimension] - this.state.counters[dimension]),
        state: this.getState(),
        proofEventId: null,
      };
    }

    const current = this.state.counters[dimension];
    const limit = limits[dimension];
    const next = current + amount;
    const remainingBefore = Math.max(0, limit - current);

    if (next > limit) {
      if (mode === 'autopilot') {
        this.state = {
          ...this.state,
          frozen: true,
          counters: { ...this.state.counters },
          limits,
          notes: req.summary
            || `Autopilot freeze: ${dimension} would exceed daily ceiling (${current}+${amount}>${limit}).`,
          updatedAt: this.now().toISOString(),
        };
        this.persist();
        const proofEventId = this.emitProof({
          title: 'Risk budget exhausted',
          summary:
            `Risk budget exhausted on ${dimension} `
            + `(${current}+${amount} > ${limit}); autopilot frozen.`,
          status: 'failed',
          riskLevel: 'high',
          metadata: {
            dimension,
            amount,
            current,
            limit,
            toolName: req.toolName || null,
          },
        });
        return {
          allowed: false,
          reason: `Autopilot daily ceiling exceeded for ${dimension}; budget frozen.`,
          requiresApproval: true,
          remaining: remainingBefore,
          state: this.getState(),
          proofEventId,
        };
      }

      // operator (and any non-autopilot with a ceiling): hard stop, require approval
      return {
        allowed: false,
        reason:
          `Would exceed ${mode} ceiling for ${dimension} `
          + `(${current}+${amount}>${limit}); approval required.`,
        requiresApproval: true,
        remaining: remainingBefore,
        state: this.getState(),
        proofEventId: null,
      };
    }

    // Allowed path — commit spend
    this.state = {
      ...this.state,
      counters: {
        ...this.state.counters,
        [dimension]: next,
      },
      limits,
      updatedAt: this.now().toISOString(),
    };
    this.persist();

    const remaining = Math.max(0, limit - next);
    let reason = `Spent ${amount} on ${dimension} (${next}/${limit}).`;
    if (mode === 'operator' && limit > 0 && next / limit >= OPERATOR_SOFT_RATIO) {
      reason += ` Soft warning: usage is above ${Math.round(OPERATOR_SOFT_RATIO * 100)}% of daily ceiling.`;
    }

    return {
      allowed: true,
      reason,
      requiresApproval: false,
      remaining,
      state: this.getState(),
      proofEventId: null,
    };
  }

  public freeze(reason: string | null = null): RiskBudgetState {
    this.ensureDayRollover(false);
    this.state = {
      ...this.state,
      frozen: true,
      notes: reason || this.state.notes || 'Force freeze',
      updatedAt: this.now().toISOString(),
    };
    this.persist();
    this.emitProof({
      title: 'Risk budget frozen',
      summary: reason || 'Risk budget force-frozen by operator.',
      status: 'info',
      riskLevel: 'medium',
      metadata: { reason },
    });
    return this.getState();
  }

  public unfreeze(): RiskBudgetState {
    this.ensureDayRollover(false);
    this.state = {
      ...this.state,
      frozen: false,
      notes: null,
      updatedAt: this.now().toISOString(),
    };
    this.persist();
    this.emitProof({
      title: 'Risk budget unfrozen',
      summary: 'Risk budget freeze cleared.',
      status: 'ok',
      riskLevel: 'none',
      metadata: {},
    });
    return this.getState();
  }

  /** Force a day reset (tests / manual recovery). Clears counters and freeze. */
  public resetDay(dayKey?: string): RiskBudgetState {
    const key = dayKey || this.computeDayKey(this.now());
    this.state = {
      ...this.state,
      dayKey: key,
      counters: emptyCounters(),
      frozen: false,
      limits: this.computeEffectiveLimits(this.state.mode),
      notes: null,
      updatedAt: this.now().toISOString(),
    };
    this.persist();
    return this.getState();
  }

  public toJson(state: RiskBudgetState = this.getState()): string {
    return JSON.stringify(state, null, 2);
  }

  public toMarkdown(state: RiskBudgetState = this.getState()): string {
    const label = RISK_BUDGET_MODE_LABELS[state.mode] || state.mode;
    const lines: string[] = [
      '# Zavorth Risk Budget',
      '',
      `- contract: ${state.contractVersion}`,
      `- mode: ${label} (\`${state.mode}\`)`,
      `- day: ${state.dayKey}`,
      `- frozen: ${state.frozen ? 'yes' : 'no'}`,
      `- updatedAt: ${state.updatedAt}`,
      '',
      '## Counters',
    ];
    for (const dim of RISK_BUDGET_DIMENSIONS) {
      lines.push(`- ${dim}: ${state.counters[dim]} / ${state.limits[dim]}`);
    }
    if (state.notes) {
      lines.push('');
      lines.push(`Notes: ${state.notes}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  public computeDayKey(date: Date = this.now()): string {
    return formatDayKey(date, this.timezone);
  }

  private ensureDayRollover(persistIfChanged: boolean): void {
    const dayKey = this.computeDayKey(this.now());
    if (this.state.dayKey === dayKey) {
      // Refresh effective limits (trusted operator may have toggled).
      this.state.limits = this.computeEffectiveLimits(this.state.mode);
      return;
    }
    this.state = {
      ...this.state,
      dayKey,
      counters: emptyCounters(),
      frozen: false,
      limits: this.computeEffectiveLimits(this.state.mode),
      notes: null,
      updatedAt: this.now().toISOString(),
    };
    if (persistIfChanged) {
      this.persist();
    }
  }

  private withEffectiveLimits(state: RiskBudgetState): RiskBudgetState {
    return {
      ...state,
      limits: this.computeEffectiveLimits(state.mode),
      counters: { ...state.counters },
    };
  }

  private computeEffectiveLimits(mode: RiskBudgetMode): RiskBudgetLimits {
    const base = limitsForMode(mode);
    // Trusted operator ON + operator mode → slight raise (never for observer / autopilot).
    if (
      mode === 'operator'
      && this.trustedOperator
      && typeof this.trustedOperator.isEnabled === 'function'
      && this.trustedOperator.isEnabled()
    ) {
      return {
        diskMutations: base.diskMutations + (TRUSTED_OPERATOR_BOOST.diskMutations || 0),
        shellCommands: base.shellCommands + (TRUSTED_OPERATOR_BOOST.shellCommands || 0),
        networkSends: base.networkSends + (TRUSTED_OPERATOR_BOOST.networkSends || 0),
        modelCostUnits: base.modelCostUnits + (TRUSTED_OPERATOR_BOOST.modelCostUnits || 0),
      };
    }
    return base;
  }

  private emitProof(input: {
    title: string;
    summary: string;
    status: 'ok' | 'failed' | 'pending' | 'info';
    riskLevel: RiskBudgetRiskLevel;
    metadata?: Record<string, unknown>;
  }): string | null {
    if (!this.proofLedger) return null;
    try {
      const event = this.proofLedger.append({
        runId: null,
        kind: 'system',
        surface: 'risk-budget',
        title: input.title,
        summary: input.summary,
        status: input.status,
        riskLevel: input.riskLevel,
        approvalId: null,
        artifacts: [],
        source: 'risk-budget',
        metadata: {
          contractVersion: RISK_BUDGET_CONTRACT_VERSION,
          ...(input.metadata || {}),
        },
      });
      return event.id;
    } catch {
      return null;
    }
  }

  private load(): RiskBudgetState {
    const base = this.defaultState();
    if (!this.existsSync(this.stateFile)) return base;
    try {
      const parsed = JSON.parse(this.readFileSync(this.stateFile, 'utf8')) as Partial<RiskBudgetState>;
      const mode = normalizeMode(parsed.mode || 'operator');
      const counters = emptyCounters();
      for (const dim of RISK_BUDGET_DIMENSIONS) {
        const value = Number((parsed.counters as RiskBudgetCounters | undefined)?.[dim]);
        counters[dim] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
      }
      return {
        contractVersion: RISK_BUDGET_CONTRACT_VERSION,
        mode,
        dayKey: typeof parsed.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dayKey)
          ? parsed.dayKey
          : base.dayKey,
        counters,
        limits: this.computeEffectiveLimits(mode),
        frozen: Boolean(parsed.frozen),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : base.updatedAt,
        notes: parsed.notes == null ? null : String(parsed.notes),
      };
    } catch {
      return base;
    }
  }

  private defaultState(): RiskBudgetState {
    const mode: RiskBudgetMode = 'operator';
    return {
      contractVersion: RISK_BUDGET_CONTRACT_VERSION,
      mode,
      dayKey: this.computeDayKey(this.now()),
      counters: emptyCounters(),
      limits: this.computeEffectiveLimits(mode),
      frozen: false,
      updatedAt: this.now().toISOString(),
      notes: null,
    };
  }

  private persist(): void {
    try {
      this.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const payload = {
        ...this.state,
        contractVersion: RISK_BUDGET_CONTRACT_VERSION,
        limits: this.computeEffectiveLimits(this.state.mode),
      };
      this.writeFileSync(this.stateFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // keep in-memory state
    }
  }
}

function normalizeMode(value: unknown): RiskBudgetMode {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'observer' || text === 'operator' || text === 'autopilot') return text;
  return 'operator';
}

function normalizeDimension(value: unknown): RiskBudgetDimension | null {
  const text = String(value || '').trim();
  // accept camelCase and kebab/snake aliases
  const aliases: Record<string, RiskBudgetDimension> = {
    diskmutations: 'diskMutations',
    disk_mutations: 'diskMutations',
    'disk-mutations': 'diskMutations',
    disk: 'diskMutations',
    shellcommands: 'shellCommands',
    shell_commands: 'shellCommands',
    'shell-commands': 'shellCommands',
    shell: 'shellCommands',
    networksends: 'networkSends',
    network_sends: 'networkSends',
    'network-sends': 'networkSends',
    network: 'networkSends',
    modelcostunits: 'modelCostUnits',
    model_cost_units: 'modelCostUnits',
    'model-cost-units': 'modelCostUnits',
    model: 'modelCostUnits',
    cost: 'modelCostUnits',
  };
  if (RISK_BUDGET_DIMENSIONS.includes(text as RiskBudgetDimension)) {
    return text as RiskBudgetDimension;
  }
  const key = text.toLowerCase();
  return aliases[key] || null;
}

function normalizeRiskLevel(value: unknown): RiskBudgetRiskLevel {
  const text = String(value || 'low').trim().toLowerCase();
  if (
    text === 'none'
    || text === 'low'
    || text === 'medium'
    || text === 'high'
    || text === 'critical'
  ) {
    return text;
  }
  return 'low';
}

function formatDayKey(date: Date, timezone: string | null): string {
  const tz = String(timezone || 'local').trim();
  if (!tz || tz === 'local' || tz === 'system') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (tz === 'UTC' || tz === 'utc') {
    return date.toISOString().slice(0, 10);
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // fall through to local
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
