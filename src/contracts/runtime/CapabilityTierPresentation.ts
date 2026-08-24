/**
 * Unified capability-tier vocabulary for permission presentation.
 *
 * One public vocabulary aligns the three internal risk dialects:
 * - ToolExposurePolicy exposure modes (safe / confirm / restricted)
 * - Trusted Operator lanes (green / yellow / red)
 * - Classifier and tool-exposure risk levels (safe / attention / danger)
 *
 * Presentation only: mapping never relaxes a stricter tier.
 */

export type CapabilityTier = 'safe-read' | 'confirm' | 'restricted';

export type CapabilityTierExposureMode = 'safe' | 'confirm' | 'restricted' | 'unknown';
export type CapabilityTierRiskLevel = 'safe' | 'attention' | 'danger' | 'unknown';
export type CapabilityTierOperatorLane = 'green' | 'yellow' | 'red';

export function capabilityTierFromExposureMode(mode: CapabilityTierExposureMode): CapabilityTier {
  if (mode === 'safe') return 'safe-read';
  if (mode === 'restricted') return 'restricted';
  return 'confirm';
}

export function capabilityTierFromRisk(risk: CapabilityTierRiskLevel): CapabilityTier {
  if (risk === 'safe') return 'safe-read';
  if (risk === 'danger') return 'restricted';
  return 'confirm';
}

export function capabilityTierFromLane(lane: CapabilityTierOperatorLane): CapabilityTier {
  if (lane === 'green') return 'safe-read';
  if (lane === 'red') return 'restricted';
  return 'confirm';
}

export function capabilityTierLabel(tier: CapabilityTier): string {
  if (tier === 'safe-read') return 'Safe read: runs without approval prompts.';
  if (tier === 'restricted') return 'Restricted: requires preview, approval phrase, and receipt.';
  return 'Confirm: requires explicit operator approval before execution.';
}
