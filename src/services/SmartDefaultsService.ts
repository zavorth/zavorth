/**
 * SmartDefaults — Provides default configurations per experience profile.
 *
 * Each profile gets optimized defaults for:
 * - memory: how much context to retain
 * - safety: approval requirements
 * - skills: auto-install behavior
 * - cron: scheduled automation
 * - receipts: audit trail level
 * - channels: suggested communication surfaces
 */

import type { ZavorthExperienceProfileId } from '../contracts/ui/ZavorthExperienceProfileContract.js';

export interface ProfileSmartDefaults {
  profileId: ZavorthExperienceProfileId;
  memory: {
    mode: 'off' | 'local-metadata' | 'local-summary';
    description: string;
  };
  safety: {
    mode: 'preview-first' | 'approval-required' | 'governed';
    description: string;
  };
  skills: {
    mode: 'manual' | 'auto-suggest' | 'auto-install' | 'governed';
    description: string;
  };
  cron: {
    enabled: boolean;
    description: string;
  };
  receipts: {
    level: 'basic' | 'full' | 'audit';
    description: string;
  };
  channels: {
    suggested: string[];
    description: string;
  };
  tieredAutonomy: {
    autoRiskThreshold: string;
    notifyRiskThreshold: string;
    description: string;
  };
}

const SMART_DEFAULTS: Record<ZavorthExperienceProfileId, ProfileSmartDefaults> = {
  personal: {
    profileId: 'personal',
    memory: {
      mode: 'local-metadata',
      description: 'Lightweight: remembers preferences and facts, not full conversations.',
    },
    safety: {
      mode: 'preview-first',
      description: 'Fast: shows preview before mutations, no approval for reads.',
    },
    skills: {
      mode: 'auto-suggest',
      description: 'Suggests useful skills but does not install automatically.',
    },
    cron: {
      enabled: false,
      description: 'No scheduled automation by default.',
    },
    receipts: {
      level: 'basic',
      description: 'Simple receipts for important actions only.',
    },
    channels: {
      suggested: ['zavorthControl', 'satellite', 'telegram'],
      description: 'Desktop, mobile companion, and Telegram.',
    },
    tieredAutonomy: {
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
      description: 'Maximum autonomy: auto-apply low/medium risk, only block security.',
    },
  },
  creator: {
    profileId: 'creator',
    memory: {
      mode: 'local-summary',
      description: 'Retains conversation summaries for research context.',
    },
    safety: {
      mode: 'preview-first',
      description: 'Fast with preview before publishing or external actions.',
    },
    skills: {
      mode: 'auto-suggest',
      description: 'Suggests content creation and research skills.',
    },
    cron: {
      enabled: false,
      description: 'No scheduled automation by default.',
    },
    receipts: {
      level: 'basic',
      description: 'Receipts for publishing and external actions.',
    },
    channels: {
      suggested: ['zavorthControl', 'satellite', 'telegram'],
      description: 'Desktop, mobile companion, and Telegram.',
    },
    tieredAutonomy: {
      autoRiskThreshold: 'low',
      notifyRiskThreshold: 'medium',
      description: 'Balanced: auto low, notify medium, approve high+.',
    },
  },
  developer: {
    profileId: 'developer',
    memory: {
      mode: 'local-summary',
      description: 'Full conversation summaries for code context.',
    },
    safety: {
      mode: 'approval-required',
      description: 'Confirms before file writes, installs, and shell execution.',
    },
    skills: {
      mode: 'auto-install',
      description: 'Installs useful dev skills automatically.',
    },
    cron: {
      enabled: true,
      description: 'Scheduled automation enabled for CI/CD and monitoring.',
    },
    receipts: {
      level: 'full',
      description: 'Complete receipts with diffs and command details.',
    },
    channels: {
      suggested: ['zavorthControl', 'cli', 'satellite'],
      description: 'Desktop, CLI, and mobile companion.',
    },
    tieredAutonomy: {
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
      description: 'Code-aware: auto low+medium, approve security only.',
    },
  },
  business: {
    profileId: 'business',
    memory: {
      mode: 'local-summary',
      description: 'Full summaries for audit and compliance.',
    },
    safety: {
      mode: 'governed',
      description: 'All mutations require approval with receipts.',
    },
    skills: {
      mode: 'governed',
      description: 'Skills reviewed before installation.',
    },
    cron: {
      enabled: true,
      description: 'Scheduled automation with audit trails.',
    },
    receipts: {
      level: 'audit',
      description: 'Full audit trail for every action.',
    },
    channels: {
      suggested: ['zavorthControl', 'cli', 'telegram', 'email'],
      description: 'Desktop, CLI, Telegram, and email.',
    },
    tieredAutonomy: {
      autoRiskThreshold: 'low',
      notifyRiskThreshold: 'low',
      description: 'Strict audit: everything requires approval.',
    },
  },
  power: {
    profileId: 'power',
    memory: {
      mode: 'local-summary',
      description: 'Full summaries for maximum context.',
    },
    safety: {
      mode: 'approval-required',
      description: 'Confirms before mutations, reads are free.',
    },
    skills: {
      mode: 'auto-install',
      description: 'Installs skills automatically.',
    },
    cron: {
      enabled: true,
      description: 'Full automation capabilities.',
    },
    receipts: {
      level: 'full',
      description: 'Complete receipts with runtime details.',
    },
    channels: {
      suggested: ['zavorthControl', 'cli', 'satellite', 'telegram'],
      description: 'All surfaces enabled.',
    },
    tieredAutonomy: {
      autoRiskThreshold: 'medium',
      notifyRiskThreshold: 'high',
      description: 'Advanced: like developer with more visibility.',
    },
  },
};

export class SmartDefaultsService {
  /**
   * Returns smart defaults for a given profile.
   */
  getDefaults(profileId: ZavorthExperienceProfileId): ProfileSmartDefaults {
    return SMART_DEFAULTS[profileId];
  }

  /**
   * Returns all profile defaults.
   */
  getAllDefaults(): ProfileSmartDefaults[] {
    return Object.values(SMART_DEFAULTS);
  }

  /**
   * Returns a comparison table of defaults across profiles.
   */
  getComparisonTable(): Array<{
    profileId: ZavorthExperienceProfileId;
    memory: string;
    safety: string;
    skills: string;
    cron: boolean;
    receipts: string;
  }> {
    return Object.values(SMART_DEFAULTS).map((defaults) => ({
      profileId: defaults.profileId,
      memory: defaults.memory.mode,
      safety: defaults.safety.mode,
      skills: defaults.skills.mode,
      cron: defaults.cron.enabled,
      receipts: defaults.receipts.level,
    }));
  }
}
