/**
 * ProgressiveDisclosure — Manages complexity reveal over time.
 *
 * Instead of showing all features at once, the agent starts simple and
 * reveals complexity as the user demonstrates readiness:
 *
 * - Week 1: Basic mode, defaults
 * - Week 2: "Want to see your usage stats?"
 * - Week 3: "Want to automate this?"
 * - Week 4: "Want to configure more providers?"
 *
 * Tracks user milestones and suggests next-level features.
 * State is persisted to disk for cross-session continuity.
 */

import fs from 'fs';
import path from 'path';
import type { ZavorthExperienceProfileId } from '../contracts/ui/ZavorthExperienceProfileContract.js';

export type DisclosureLevel = 'basic' | 'intermediate' | 'advanced' | 'expert';

export interface DisclosureMilestone {
  id: string;
  level: DisclosureLevel;
  trigger: 'time' | 'usage' | 'explicit';
  triggerCondition: string;
  suggestion: string;
  feature: string;
}

export interface UserDisclosureState {
  profileId: ZavorthExperienceProfileId;
  currentLevel: DisclosureLevel;
  milestonesAchieved: string[];
  suggestionsShown: string[];
  createdAt: string;
  lastActiveAt: string;
}

const DISCLOSURE_MILESTONES: DisclosureMilestone[] = [
  // Basic → Intermediate
  {
    id: 'first-week',
    level: 'intermediate',
    trigger: 'time',
    triggerCondition: '7 days since first use',
    suggestion: 'Want to see your usage stats and favorite commands?',
    feature: 'stats-dashboard',
  },
  {
    id: 'ten-conversations',
    level: 'intermediate',
    trigger: 'usage',
    triggerCondition: '10 conversations completed',
    suggestion: 'You are getting the hang of this! Want to customize my responses?',
    feature: 'response-customization',
  },

  // Intermediate → Advanced
  {
    id: 'thirty-conversations',
    level: 'advanced',
    trigger: 'usage',
    triggerCondition: '30 conversations completed',
    suggestion: 'Want to automate recurring tasks with cron jobs?',
    feature: 'cron-automation',
  },
  {
    id: 'first-skill-used',
    level: 'advanced',
    trigger: 'usage',
    triggerCondition: 'Used a skill for the first time',
    suggestion: 'Want me to suggest skills based on your workflow?',
    feature: 'skill-suggestions',
  },
  {
    id: 'month-active',
    level: 'advanced',
    trigger: 'time',
    triggerCondition: '30 days since first use',
    suggestion: 'Want to configure multiple providers for failover?',
    feature: 'provider-mesh',
  },

  // Advanced → Expert
  {
    id: 'fifty-conversations',
    level: 'expert',
    trigger: 'usage',
    triggerCondition: '50 conversations completed',
    suggestion: 'You are a power user! Want to enable subagents and advanced orchestration?',
    feature: 'subagent-orchestration',
  },
  {
    id: 'multiple-channels',
    level: 'expert',
    trigger: 'usage',
    triggerCondition: 'Used 3+ different channels',
    suggestion: 'Want to set up cross-channel session continuity?',
    feature: 'cross-channel-sync',
  },
  {
    id: 'custom-skills',
    level: 'expert',
    trigger: 'usage',
    triggerCondition: 'Created or imported a custom skill',
    suggestion: 'Want to publish your skill to the marketplace?',
    feature: 'skill-publishing',
  },
];

const LEVEL_ORDER: DisclosureLevel[] = ['basic', 'intermediate', 'advanced', 'expert'];

export interface ProgressiveDisclosureOptions {
  /** Directory to persist disclosure state. Default: data/runtime/progressive-disclosure */
  storageDir?: string;
  /** Whether to persist state to disk. Default: true */
  persistToDisk?: boolean;
  /** Custom fs operations for testing */
  fsOps?: {
    readFileSync: typeof fs.readFileSync;
    writeFileSync: typeof fs.writeFileSync;
    mkdirSync: typeof fs.mkdirSync;
    existsSync: typeof fs.existsSync;
  };
}

export class ProgressiveDisclosureService {
  private readonly userStates: Map<string, UserDisclosureState> = new Map();
  private readonly storageDir: string;
  private readonly persistToDisk: boolean;
  private readonly fsOps: ProgressiveDisclosureOptions['fsOps'];

  constructor(options?: ProgressiveDisclosureOptions) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'progressive-disclosure');
    this.persistToDisk = options?.persistToDisk ?? true;
    this.fsOps = options?.fsOps || { readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, mkdirSync: fs.mkdirSync, existsSync: fs.existsSync };
  }

  /**
   * Gets or creates the disclosure state for a user.
   * Loads from disk if available and persistence is enabled.
   */
  getState(userId: string, profileId: ZavorthExperienceProfileId): UserDisclosureState {
    let state = this.userStates.get(userId);
    if (!state) {
      // Try loading from disk
      if (this.persistToDisk) {
        state = this.loadFromDisk(userId) ?? undefined;
      }

      if (!state) {
        state = {
          profileId,
          currentLevel: 'basic',
          milestonesAchieved: [],
          suggestionsShown: [],
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
      }

      this.userStates.set(userId, state);
    }
    return state;
  }

  /**
   * Records user activity and checks for new milestones.
   * Returns any new suggestions to show.
   */
  recordActivity(
    userId: string,
    activityType: 'conversation' | 'skill-use' | 'channel-use' | 'custom-skill',
    metadata?: Record<string, unknown>,
  ): string[] {
    const state = this.userStates.get(userId);
    if (!state) return [];

    state.lastActiveAt = new Date().toISOString();

    const newSuggestions: string[] = [];

    for (const milestone of DISCLOSURE_MILESTONES) {
      if (state.milestonesAchieved.includes(milestone.id)) continue;
      if (LEVEL_ORDER.indexOf(milestone.level) <= LEVEL_ORDER.indexOf(state.currentLevel)) continue;

      if (this.checkMilestone(milestone, state, activityType, metadata)) {
        state.milestonesAchieved.push(milestone.id);
        if (!state.suggestionsShown.includes(milestone.feature)) {
          state.suggestionsShown.push(milestone.feature);
          newSuggestions.push(milestone.suggestion);
        }
      }
    }

    // Update level based on achieved milestones
    const maxLevel = this.getMaxAchievedLevel(state);
    if (LEVEL_ORDER.indexOf(maxLevel) > LEVEL_ORDER.indexOf(state.currentLevel)) {
      state.currentLevel = maxLevel;
    }

    // Persist state to disk
    this.saveToDisk(userId, state);

    return newSuggestions;
  }

  /**
   * Returns the current disclosure level for a user.
   */
  getLevel(userId: string): DisclosureLevel {
    return this.userStates.get(userId)?.currentLevel ?? 'basic';
  }

  /**
   * Returns available features for the current level.
   */
  getAvailableFeatures(userId: string): string[] {
    const level = this.getLevel(userId);
    const levelIndex = LEVEL_ORDER.indexOf(level);

    return DISCLOSURE_MILESTONES
      .filter((m) => LEVEL_ORDER.indexOf(m.level) <= levelIndex)
      .map((m) => m.feature)
      .filter((f, i, arr) => arr.indexOf(f) === i); // deduplicate
  }

  /**
   * Returns pending suggestions not yet shown.
   */
  getPendingSuggestions(userId: string): string[] {
    const state = this.userStates.get(userId);
    if (!state) return [];

    return DISCLOSURE_MILESTONES
      .filter((m) => !state.suggestionsShown.includes(m.feature))
      .filter((m) => LEVEL_ORDER.indexOf(m.level) > LEVEL_ORDER.indexOf(state.currentLevel))
      .map((m) => m.suggestion);
  }

  /**
   * Manually promotes a user to the next level (opt-in).
   */
  promoteLevel(userId: string): DisclosureLevel {
    const state = this.userStates.get(userId);
    if (!state) return 'basic';

    const currentIndex = LEVEL_ORDER.indexOf(state.currentLevel);
    if (currentIndex < LEVEL_ORDER.length - 1) {
      state.currentLevel = LEVEL_ORDER[currentIndex + 1];
      this.saveToDisk(userId, state);
    }
    return state.currentLevel;
  }

  private checkMilestone(
    milestone: DisclosureMilestone,
    state: UserDisclosureState,
    activityType: string,
    metadata?: Record<string, unknown>,
  ): boolean {
    switch (milestone.id) {
      case 'first-week': {
        const daysSinceCreation = (Date.now() - new Date(state.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation >= 7;
      }
      case 'ten-conversations': {
        return activityType === 'conversation' && (metadata?.conversationCount as number ?? 0) >= 10;
      }
      case 'thirty-conversations': {
        return activityType === 'conversation' && (metadata?.conversationCount as number ?? 0) >= 30;
      }
      case 'first-skill-used': {
        return activityType === 'skill-use';
      }
      case 'month-active': {
        const daysSinceCreation = (Date.now() - new Date(state.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation >= 30;
      }
      case 'fifty-conversations': {
        return activityType === 'conversation' && (metadata?.conversationCount as number ?? 0) >= 50;
      }
      case 'multiple-channels': {
        return activityType === 'channel-use' && (metadata?.channelCount as number ?? 0) >= 3;
      }
      case 'custom-skills': {
        return activityType === 'custom-skill';
      }
      default:
        return false;
    }
  }

  private getMaxAchievedLevel(state: UserDisclosureState): DisclosureLevel {
    let maxLevel: DisclosureLevel = 'basic';
    for (const milestone of DISCLOSURE_MILESTONES) {
      if (state.milestonesAchieved.includes(milestone.id)) {
        if (LEVEL_ORDER.indexOf(milestone.level) > LEVEL_ORDER.indexOf(maxLevel)) {
          maxLevel = milestone.level;
        }
      }
    }
    return maxLevel;
  }

  /**
   * Saves user state to disk for persistence across sessions.
   */
  private sanitizeUserId(userId: string): string {
    // Remove path traversal characters, keep only safe chars
    return userId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  }

  private saveToDisk(userId: string, state: UserDisclosureState): void {
    if (!this.persistToDisk) return;

    try {
      if (!this.fsOps?.existsSync(this.storageDir)) {
        this.fsOps?.mkdirSync(this.storageDir, { recursive: true });
      }

      const safeId = this.sanitizeUserId(userId);
      const filePath = path.join(this.storageDir, `${safeId}.json`);
      this.fsOps?.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[ProgressiveDisclosure] Failed to persist state:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * Loads user state from disk.
   */
  private loadFromDisk(userId: string): UserDisclosureState | null {
    if (!this.persistToDisk) return null;

    try {
      const safeId = this.sanitizeUserId(userId);
      const filePath = path.join(this.storageDir, `${safeId}.json`);
      if (!this.fsOps?.existsSync(filePath)) return null;

      const data = this.fsOps?.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as UserDisclosureState;
    } catch {
      return null;
    }
  }
}
