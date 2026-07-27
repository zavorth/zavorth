import { EXPERIENCE_AUTO_HEALING_CONTRACT_VERSION, type ExperienceAutoHealing } from './ExperienceContracts.js';
import type { UniversalAgentRun } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type AutoHealingProjectionInput = {
  activeRun?: UniversalAgentRun | null;
};

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberOr(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
    if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
  }
  return fallback;
}

export class AutoHealingProjectionService {
  public build(input: AutoHealingProjectionInput = {}): ExperienceAutoHealing {
    const run = input.activeRun || null;
    const metadata = run?.metadata || {};
    const speculativeReceipt = recordOrNull(metadata.superZavorthSpeculativeAutonomy);
    const healing =
      recordOrNull(metadata.autoHealing) ||
      recordOrNull(metadata.autoHeal) ||
      recordOrNull(metadata.selfHealing) ||
      recordOrNull(recordOrNull(metadata.sandbox)?.autoHealing) ||
      recordOrNull(speculativeReceipt?.autoHealing) ||
      null;

    if (!run || !healing) {
      return this.idle();
    }

    const status = this.statusFor(healing.status, run.status);
    return {
      contractVersion: EXPERIENCE_AUTO_HEALING_CONTRACT_VERSION,
      status,
      attempt: numberOr(healing.attempt ?? healing.currentAttempt, status === 'idle' ? 0 : 1),
      maxAttempts: numberOr(healing.maxAttempts ?? healing.limit, 3),
      lastErrorSummary: textOrNull(healing.lastErrorSummary ?? healing.errorSummary ?? healing.lastError),
      proposedCorrection: textOrNull(healing.proposedCorrection ?? healing.correction ?? healing.nextFix),
      validationCommand: textOrNull(healing.validationCommand ?? healing.command ?? metadata.validationCommand),
      budget: this.budgetFor(healing, metadata, status),
      cancelRequested: boolOr(healing.cancelRequested ?? healing.stopRequested, false),
    };
  }

  private idle(): ExperienceAutoHealing {
    return {
      contractVersion: EXPERIENCE_AUTO_HEALING_CONTRACT_VERSION,
      status: 'idle',
      attempt: 0,
      maxAttempts: 3,
      lastErrorSummary: null,
      proposedCorrection: null,
      validationCommand: null,
      budget: {
        elapsedMs: 0,
        maxElapsedMs: 120_000,
        tokenBudget: null,
        tokensUsed: null,
        estimatedCostUsd: null,
        cancellable: false,
        cancelCommand: null,
      },
      cancelRequested: false,
    };
  }

  private statusFor(value: unknown, runStatus: UniversalAgentRun['status']): ExperienceAutoHealing['status'] {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (normalized === 'running' || normalized === 'retrying' || normalized === 'fixing') return 'running';
    if (normalized === 'passed' || normalized === 'success' || normalized === 'validated') return 'passed';
    if (normalized === 'failed' || normalized === 'exhausted') return 'failed';
    if (normalized === 'blocked') return 'blocked';
    if (runStatus === 'failed') return 'failed';
    if (runStatus === 'running' || runStatus === 'thinking') return 'running';
    return 'idle';
  }

  private budgetFor(
    healing: Record<string, unknown>,
    metadata: Record<string, unknown>,
    status: ExperienceAutoHealing['status'],
  ): NonNullable<ExperienceAutoHealing['budget']> {
    const startedAt = Date.parse(String(healing.startedAt || metadata.startedAt || ''));
    const completedAt = Date.parse(String(healing.completedAt || healing.updatedAt || ''));
    const now = Date.now();
    const elapsedMs = numberOr(
      healing.elapsedMs ?? healing.elapsedMilliseconds,
      Number.isFinite(startedAt) ? Math.max(0, (Number.isFinite(completedAt) ? completedAt : now) - startedAt) : 0,
    );
    const maxElapsedMs = numberOr(healing.maxElapsedMs ?? healing.timeBudgetMs, 120_000);
    const inputTokens = Number(healing.inputTokens);
    const outputTokens = Number(healing.outputTokens);
    const tokensUsed =
      healing.tokensUsed ??       (Number.isFinite(inputTokens) || Number.isFinite(outputTokens)
        ? Math.max(0, Number.isFinite(inputTokens) ? inputTokens : 0) +
          Math.max(0, Number.isFinite(outputTokens) ? outputTokens : 0)
        : undefined);
    const tokenBudget = healing.tokenBudget ?? healing.maxTokens ?? null;
    const estimatedCostUsd = healing.estimatedCostUsd ?? healing.costUsd ?? null;
    const cancellable = boolOr(healing.cancellable, status === 'running');
    return {
      elapsedMs,
      maxElapsedMs,
      tokenBudget: tokenBudget === null ? null : numberOr(tokenBudget, 0),
      tokensUsed: tokensUsed === undefined ? null : numberOr(tokensUsed, 0),
      estimatedCostUsd: estimatedCostUsd === null ? null : numberOr(estimatedCostUsd, 0),
      cancellable,
      cancelCommand: cancellable ? 'zavorth ask "stop auto-healing and show error"' : null,
    };
  }
}
