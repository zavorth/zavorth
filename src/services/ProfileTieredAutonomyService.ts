/**
 * ProfileTieredAutonomy — Maps experience profiles to tiered autonomy configurations.
 *
 * Each profile gets its own thresholds for auto/notify/approve tiers:
 *
 * - personal:  Maximum autonomy (auto up to medium, only security-sensitive needs approval)
 * - creator:   Balanced (auto low, notify medium, approve high+)
 * - developer: Code-aware (auto low+medium, approve security only)
 * - business:  Strict audit (everything requires approval)
 * - power:     Like developer but with more visibility
 */

import type { ZavorthExperienceProfileId } from '../contracts/ui/ZavorthExperienceProfileContract.js';
import type { TieredAutonomyConfig } from './TieredAutonomyService.js';

export type ProfileTieredAutonomyConfig = TieredAutonomyConfig & {
  profileId: ZavorthExperienceProfileId;
  description: string;
};

/**
 * Default tiered autonomy configs per profile.
 * These can be overridden per-user via preferences.
 */
const PROFILE_TIERED_AUTONOMY_CONFIGS: Record<ZavorthExperienceProfileId, ProfileTieredAutonomyConfig> = {
  personal: {
    profileId: 'personal',
    description: 'Maximum autonomy: auto-apply low and medium risk, only block security-sensitive actions.',
    autoRiskThreshold: 'medium',
    notifyRiskThreshold: 'high',
    forceApprovalKinds: [],
    forceApprovalPatterns: [
      /\b(security|safety|policy|firewall|secret|encrypt|auth)\b/i,
      /\b(external\s*send|email|publish|post)\b/i,
      /\b(delete|remove|destroy|wipe)\b/i,
    ],
    notifyUndoWindowMs: 30_000,
  },
  creator: {
    profileId: 'creator',
    description: 'Balanced: auto-apply low risk, notify medium, approve high+.',
    autoRiskThreshold: 'low',
    notifyRiskThreshold: 'medium',
    forceApprovalKinds: ['user-model-update', 'approved-nudge'],
    forceApprovalPatterns: [
      /\b(security|safety|policy|approval|allowlist|denylist|sandbox|firewall|secret|permission|trust|encrypt|auth)\b/i,
      /\b(behavior|personality|tone|identity|soul)\b/i,
    ],
    notifyUndoWindowMs: 30_000,
  },
  developer: {
    profileId: 'developer',
    description: 'Code-aware: auto-apply low and medium, only approve security-sensitive.',
    autoRiskThreshold: 'medium',
    notifyRiskThreshold: 'high',
    forceApprovalKinds: ['user-model-update'],
    forceApprovalPatterns: [
      /\b(security|safety|policy|firewall|secret|encrypt|auth)\b/i,
      /\b(external\s*send|email|publish|post)\b/i,
    ],
    notifyUndoWindowMs: 30_000,
  },
  business: {
    profileId: 'business',
    description: 'Strict audit: everything requires approval for compliance.',
    autoRiskThreshold: 'low',
    notifyRiskThreshold: 'low',
    forceApprovalKinds: ['auto-skill-candidate', 'skill-improvement-candidate', 'user-model-update', 'approved-nudge', 'procedural-memory'],
    forceApprovalPatterns: [/.*/], // Match everything
    notifyUndoWindowMs: 0,
  },
  power: {
    profileId: 'power',
    description: 'Advanced: like developer with more visibility into runtime decisions.',
    autoRiskThreshold: 'medium',
    notifyRiskThreshold: 'high',
    forceApprovalKinds: ['user-model-update'],
    forceApprovalPatterns: [
      /\b(security|safety|policy|firewall|secret|encrypt|auth)\b/i,
    ],
    notifyUndoWindowMs: 30_000,
  },
};

export class ProfileTieredAutonomyService {
  /**
   * Returns the tiered autonomy config for a given profile.
   */
  getConfig(profileId: ZavorthExperienceProfileId): ProfileTieredAutonomyConfig {
    return PROFILE_TIERED_AUTONOMY_CONFIGS[profileId];
  }

  /**
   * Returns all profile configs.
   */
  getAllConfigs(): ProfileTieredAutonomyConfig[] {
    return Object.values(PROFILE_TIERED_AUTONOMY_CONFIGS);
  }

  /**
   * Returns a summary of autonomy levels per profile for display.
   */
  getAutonomySummary(): Array<{
    profileId: ZavorthExperienceProfileId;
    description: string;
    autoThreshold: string;
    notifyThreshold: string;
    approvalRequired: string;
  }> {
    return Object.values(PROFILE_TIERED_AUTONOMY_CONFIGS).map((config) => ({
      profileId: config.profileId,
      description: config.description,
      autoThreshold: `risk <= ${config.autoRiskThreshold}`,
      notifyThreshold: `risk <= ${config.notifyRiskThreshold}`,
      approvalRequired: (config.forceApprovalKinds ?? []).length > 0 || (config.forceApprovalPatterns ?? []).length > 1
        ? `${(config.forceApprovalKinds ?? []).length + (config.forceApprovalPatterns ?? []).length} patterns`
        : 'security only',
    }));
  }
}
