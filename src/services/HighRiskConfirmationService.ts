import { Task } from '../contracts/TaskContract.js';

export type HighRiskGateResult = {
  ok: boolean;
  reason: string;
  /** Always false — TOTP was removed from product permissions. */
  requiresTotp: false;
  highRisk: boolean;
};

export type HighRiskRiskParts = {
  risk_level?: number | null;
  riskLevel?: string | number | null;
  requiresHighRiskPin?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type HighRiskTask = Pick<Task, 'risk_level' | 'metadata'>;

/**
 * High-risk labeling + simple approve gate (no TOTP / no 6-digit codes).
 * Product policy: permissions stay one-click (or temporary grants / reduced friction).
 * Delivery of approve UI is surface-specific; policy is surface-agnostic.
 */
export class HighRiskConfirmationService {
  public isConfigured(): boolean {
    // TOTP host secrets are no longer part of the permission product.
    return false;
  }

  public requiresPin(task: HighRiskTask | null | undefined): boolean {
    if (!task) return false;
    return this.requiresHighRiskFromParts({
      risk_level: task.risk_level,
      requiresHighRiskPin: Boolean(task.metadata?.requiresHighRiskPin),
      metadata: (task.metadata || null) as Record<string, unknown> | null,
    });
  }

  public requiresHighRiskConfirmation(task: HighRiskTask | null | undefined): boolean {
    return this.requiresPin(task);
  }

  public isHighRiskRiskLevel(risk: unknown): boolean {
    if (typeof risk === 'number' && Number.isFinite(risk)) {
      return risk >= 3;
    }
    const s = String(risk ?? '')
      .trim()
      .toLowerCase();
    if (!s) return false;
    if (s === 'high' || s === 'critical' || s === 'severe' || s === 'danger') return true;
    const n = Number(s);
    return Number.isFinite(n) && n >= 3;
  }

  public requiresHighRiskFromParts(input: HighRiskRiskParts): boolean {
    if (input.requiresHighRiskPin === true) return true;
    const meta = input.metadata || {};
    if (meta.requiresHighRiskPin === true || meta.requires_high_risk_pin === true) return true;
    if (this.isHighRiskRiskLevel(input.risk_level)) return true;
    if (this.isHighRiskRiskLevel(input.riskLevel)) return true;
    if (this.isHighRiskRiskLevel(meta.risk_level) || this.isHighRiskRiskLevel(meta.riskLevel)) {
      return true;
    }
    if (this.isHighRiskRiskLevel(meta.risk) || this.isHighRiskRiskLevel(meta.risk_class)) {
      return true;
    }
    return false;
  }

  /**
   * Simple gate: high-risk never auto-approves without an explicit operator approve.
   * No authenticator codes. Temporary grants / session friction reduction stay separate systems.
   */
  public assertApprovalGate(input: {
    task?: HighRiskTask | null;
    risk?: HighRiskRiskParts | null;
    approvalGranted?: boolean;
    /** @deprecated Ignored — TOTP removed from product. */
    providedCode?: string | null;
    env?: NodeJS.ProcessEnv;
  }): HighRiskGateResult {
    const highRisk = input.task
      ? this.requiresPin(input.task)
      : this.requiresHighRiskFromParts(input.risk || {});

    if (!highRisk) {
      return { ok: true, reason: 'not_high_risk', requiresTotp: false, highRisk: false };
    }

    if (input.approvalGranted !== true) {
      return {
        ok: false,
        reason: 'high_risk_requires_explicit_approval',
        requiresTotp: false,
        highRisk: true,
      };
    }

    return {
      ok: true,
      reason: 'high_risk_approved',
      requiresTotp: false,
      highRisk: true,
    };
  }

  public formatGateFailure(result: HighRiskGateResult): string {
    if (result.reason === 'high_risk_requires_explicit_approval') {
      return 'This action needs an explicit Approve (one click). It will not run automatically.';
    }
    return result.reason || 'Approval blocked.';
  }

  /** @deprecated No-op validate — codes are not used. Always true for non-high-risk; false only if empty code path callers expect pin. */
  public validate(_task: Task, _providedCode: string): boolean {
    return true;
  }

  public describeRequirement(): string {
    return 'This action is high-risk. Use a simple Approve (or your workspace temporary grant).';
  }
}
