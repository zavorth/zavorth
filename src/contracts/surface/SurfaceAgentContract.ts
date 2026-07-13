/**
 * Surface-agnostic agent product contracts.
 * Every surface (Telegram, Desktop, Control, CLI, future channels) must honor the same three gates.
 * Surfaces are adapters; none is product-primary.
 */

export const ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION =
  '2026-07-13.surface-agent-contracts-v1' as const;

export const ZAVORTH_SURFACE_AGENT_GATES = {
  power: 'C1_POWER_ACTION',
  trust: 'C2_HIGH_RISK',
  extend: 'C3_SKILL_INSTALL',
} as const;

export type SurfaceAgentGateId =
  (typeof ZAVORTH_SURFACE_AGENT_GATES)[keyof typeof ZAVORTH_SURFACE_AGENT_GATES];

/** Known + open-ended future surfaces share the same contract. */
export type SurfaceAgentPlatformId =
  | 'telegram'
  | 'desktop'
  | 'control'
  | 'cli'
  | 'discord'
  | 'web'
  | 'api'
  | 'whatsapp'
  | 'slack'
  | 'unknown'
  | (string & {});

export type SurfaceAgentRoutingKind =
  | 'pass_to_agent'
  | 'deterministic_slash'
  | 'callback'
  | 'high_risk_challenge_reply'
  | 'parse_only'
  | 'blocked';

export type SurfaceAgentRoutingDecision = {
  kind: SurfaceAgentRoutingKind;
  platform: SurfaceAgentPlatformId;
  agentFirstEnabled: boolean;
  reason: string;
};

export type SurfaceHighRiskGateDecision = {
  required: boolean;
  totpConfigured: boolean;
  canAutoApprove: false;
  approvalRequired: boolean;
  receiptRequired: true;
  reason: string;
};

export type SurfaceSkillInstallGateDecision = {
  previewAllowed: boolean;
  applyAllowed: boolean;
  consentRequired: boolean;
  consentPresent: boolean;
  forceRequested: boolean;
  forceAllowed: boolean;
  blockedReason: string | null;
};

export type SurfaceAgentContractEvaluation = {
  contractVersion: typeof ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION;
  platform: SurfaceAgentPlatformId;
  gates: {
    power: { id: typeof ZAVORTH_SURFACE_AGENT_GATES.power; ok: boolean; routing: SurfaceAgentRoutingDecision };
    trust: { id: typeof ZAVORTH_SURFACE_AGENT_GATES.trust; ok: boolean; highRisk: SurfaceHighRiskGateDecision };
    extend: {
      id: typeof ZAVORTH_SURFACE_AGENT_GATES.extend;
      ok: boolean;
      skillInstall: SurfaceSkillInstallGateDecision;
    };
  };
  ok: boolean;
  violations: string[];
};

export const ZAVORTH_SURFACE_AGENT_CANONICAL_PLATFORMS: readonly SurfaceAgentPlatformId[] = [
  'telegram',
  'desktop',
  'control',
  'cli',
  'discord',
  'web',
  'api',
] as const;

export function normalizeSurfaceAgentPlatform(
  platform?: string | null,
): SurfaceAgentPlatformId {
  const p = String(platform || '').trim().toLowerCase();
  if (!p) return 'unknown';
  if (p === 'zavorthcontrol' || p === 'zavorth-control' || p === 'control-ui') return 'control';
  if (p === 'desktop-app' || p === 'tauri' || p === 'electron') return 'desktop';
  if (p === 'command-line' || p === 'terminal') return 'cli';
  if (p === 'http' || p === 'rest' || p === 'public-api') return 'api';
  return p as SurfaceAgentPlatformId;
}

export function formatSurfaceAgentContractPitch(): string {
  return [
    `Surface agent contracts ${ZAVORTH_SURFACE_AGENT_CONTRACT_VERSION}`,
    'C1 Power — free text → agent + tools on every surface (slash stays deterministic)',
    'C2 Trust — high-risk never auto-approves; approval + receipt; TOTP when configured',
    'C3 Extend — skill install is preview → consent → apply → receipt (force operator-gated)',
    'No surface is product-primary; adapters share this core.',
  ].join('\n');
}
