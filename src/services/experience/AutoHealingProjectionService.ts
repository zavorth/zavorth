import {
  EXPERIENCE_AUTO_HEALING_CONTRACT_VERSION,
  type ExperienceAutoHealing,
} from './ExperienceContracts.js';
import type { UniversalAgentRun } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type AutoHealingProjectionInput = {
  activeRun?: UniversalAgentRun | null;
};

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numberOr(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

export class AutoHealingProjectionService {
  public build(input: AutoHealingProjectionInput = {}): ExperienceAutoHealing {
    const run = input.activeRun || null;
    const metadata = run?.metadata || {};
    const healing = recordOrNull(metadata.autoHealing)
      || recordOrNull(metadata.autoHeal)
      || recordOrNull(metadata.selfHealing)
      || recordOrNull(recordOrNull(metadata.sandbox)?.autoHealing)
      || null;

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
    };
  }

  private statusFor(value: unknown, runStatus: UniversalAgentRun['status']): ExperienceAutoHealing['status'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'running' || normalized === 'retrying' || normalized === 'fixing') return 'running';
    if (normalized === 'passed' || normalized === 'success' || normalized === 'validated') return 'passed';
    if (normalized === 'failed' || normalized === 'exhausted') return 'failed';
    if (normalized === 'blocked') return 'blocked';
    if (runStatus === 'failed') return 'failed';
    if (runStatus === 'running' || runStatus === 'thinking') return 'running';
    return 'idle';
  }
}
