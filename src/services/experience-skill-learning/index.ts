/**
 * Isolated entry for the experience skill learning loop.
 * Keep this surface small so the feature can iterate without dragging the full monorepo.
 *
 * Public surface:
 * - ExperienceSkillLearningLoopService
 * - isExperienceSkillLearningLoopEnabled
 * - types for turn/result/draft summary
 *
 * Not re-exported: NativeLearningLoop spine, skill marketplace, or agent runtime.
 */

export {
  ExperienceSkillLearningLoopService,
  isExperienceSkillLearningLoopEnabled,
  computeReuseScore,
  computeSuccessRate,
  getIsoWeekKey,
  goalSimilarity,
  tokenizeSearchQuery,
  type ExperienceSkillDraftSearchHit,
  type ExperienceSkillDraftSummary,
  type ExperienceSkillLearningResult,
  type ExperienceSkillLearningStatusSnapshot,
  type ExperienceSkillLearningTurnInput,
  type ExperienceSkillPromotePreview,
  type ExperienceSkillPromoteResult,
  type ExperienceSkillWeeklyMetrics,
  type UserLearningProfile,
} from '../ExperienceSkillLearningLoopService.js';
