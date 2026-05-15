import type {
  ZavorthProductDailyMode,
  ZavorthProductDetailMode,
} from './ZavorthProductModeContract.js';

export const ZAVORTH_EXPERIENCE_PROFILE_IDS = [
  'personal',
  'creator',
  'developer',
  'business',
  'power',
] as const;

export type ZavorthExperienceProfileId = typeof ZAVORTH_EXPERIENCE_PROFILE_IDS[number];

export type ZavorthExperienceAutonomyLevel =
  | 'conservative'
  | 'balanced'
  | 'advanced'
  | 'business';

export type ZavorthExperienceExplanationLevel =
  | 'plain'
  | 'guided'
  | 'technical'
  | 'audit';

export type ZavorthExperienceProfile = {
  id: ZavorthExperienceProfileId;
  label: string;
  audience: string;
  summary: string;
  defaultDailyMode: ZavorthProductDailyMode;
  defaultDetailMode: ZavorthProductDetailMode;
  autonomy: ZavorthExperienceAutonomyLevel;
  explanation: ZavorthExperienceExplanationLevel;
  firstMissionIds: string[];
  suggestedChannels: string[];
  suggestedCapabilities: string[];
  approvalTone: string;
  riskBoundary: string;
  naturalAliases: string[];
};

export type ZavorthExperienceProfileResolution = {
  profileId: ZavorthExperienceProfileId;
  confidence: 'explicit' | 'high' | 'medium' | 'fallback';
  reason: string;
  matchedSignals: string[];
};

export type ZavorthExperienceProfileContract = {
  schemaVersion: 1;
  surface: 'experience-profile';
  selected: {
    profileId: ZavorthExperienceProfileId;
    dailyMode: ZavorthProductDailyMode;
    detailMode: ZavorthProductDetailMode;
    autonomy: ZavorthExperienceAutonomyLevel;
    explanation: ZavorthExperienceExplanationLevel;
  };
  resolution: ZavorthExperienceProfileResolution;
  profiles: ZavorthExperienceProfile[];
  naturalSwitchExamples: string[];
  invariants: string[];
};
