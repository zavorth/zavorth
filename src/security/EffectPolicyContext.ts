import type { ActionIntentSourceTrust } from '../runtime/effects/ActionIntent.js';

export type EffectPolicyAutonomyMode =
  | 'manual'
  | 'governed'
  | 'speculative'
  | 'autonomous';

export type EffectPolicyContext = {
  surface?: string;
  workspace?: string | null;
  autonomyMode?: EffectPolicyAutonomyMode;
  sourceTrust?: ActionIntentSourceTrust | string;
  approvalPresent?: boolean;
  adminPolicyPresent?: boolean;
  sandboxAvailable?: boolean;
  redactionApplied?: boolean;
  metadata?: Record<string, unknown>;
};

export function normalizeEffectPolicyContext(context: EffectPolicyContext = {}): Required<Omit<EffectPolicyContext, 'workspace' | 'metadata'>> & {
  workspace: string | null;
  metadata: Record<string, unknown>;
} {
  return {
    surface: context.surface || 'effect-boundary',
    workspace: context.workspace ?? null,
    autonomyMode: context.autonomyMode || 'governed',
    sourceTrust: context.sourceTrust || 'unknown',
    approvalPresent: context.approvalPresent === true,
    adminPolicyPresent: context.adminPolicyPresent === true,
    sandboxAvailable: context.sandboxAvailable !== false,
    redactionApplied: context.redactionApplied === true,
    metadata: context.metadata || {},
  };
}
