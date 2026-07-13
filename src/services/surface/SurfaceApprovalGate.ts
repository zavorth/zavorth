/**
 * Shared approve gate for Desktop/Control/CLI/API/Telegram.
 * One-click approve only — no TOTP / 6-digit codes.
 */

import {
  HighRiskConfirmationService,
  type HighRiskGateResult,
} from '../HighRiskConfirmationService.js';

export type SurfaceApproveGateInput = {
  surface?: string | null;
  riskLevel?: string | number | null;
  requiresHighRiskPin?: boolean | null;
  metadata?: Record<string, unknown> | null;
  approvalGranted?: boolean;
  /** @deprecated Ignored. */
  totp?: string | null;
  /** Host CRITICAL typed phrase already matched (optional extra confirm, not TOTP). */
  strongConfirmationSatisfied?: boolean;
  env?: NodeJS.ProcessEnv;
  highRisk?: HighRiskConfirmationService;
};

export type SurfaceApproveGateResult = HighRiskGateResult & {
  surface: string;
};

const sharedHighRisk = new HighRiskConfirmationService();

export function assertSurfaceApproveGate(
  input: SurfaceApproveGateInput,
): SurfaceApproveGateResult {
  const highRisk = input.highRisk || sharedHighRisk;
  const surface = String(input.surface || 'unknown').trim() || 'unknown';
  const approvalGranted = input.approvalGranted !== false;

  const gate = highRisk.assertApprovalGate({
    risk: {
      riskLevel: input.riskLevel,
      requiresHighRiskPin: input.requiresHighRiskPin,
      metadata: input.metadata || null,
    },
    approvalGranted,
    env: input.env,
  });

  if (gate.ok) {
    return { ...gate, surface };
  }

  // Typed strong phrase (host CRITICAL) counts as explicit operator approve.
  if (
    !gate.ok &&
    gate.reason === 'high_risk_requires_explicit_approval' &&
    input.strongConfirmationSatisfied === true
  ) {
    return {
      ok: true,
      reason: 'high_risk_approved_via_strong_confirmation',
      requiresTotp: false,
      highRisk: true,
      surface,
    };
  }

  throw new Error(highRisk.formatGateFailure(gate));
}

export function isSurfaceHighRiskLevel(risk: unknown): boolean {
  return sharedHighRisk.isHighRiskRiskLevel(risk);
}
