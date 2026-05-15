import type { ZavorthExperienceProfileId } from './ZavorthExperienceProfileContract.js';
import type { ZavorthTrustPanelContract } from './ZavorthTrustPanelContract.js';

export const ZAVORTH_AUTONOMY_SLIDER_CONTRACT_VERSION = '2026-05-15.experience-layer.phase-7' as const;

export type ZavorthAutonomySliderLevel =
  | 'conservative'
  | 'balanced'
  | 'advanced'
  | 'business';

export type ZavorthAutonomySliderChangeRisk =
  | 'same'
  | 'stricter'
  | 'more_autonomous'
  | 'governed_business';

export type ZavorthAutonomySliderLevelCard = {
  id: ZavorthAutonomySliderLevel;
  label: string;
  position: 0 | 1 | 2 | 3;
  plainSummary: string;
  canDoAlone: string[];
  asksFirst: string[];
  alwaysBlocked: string[];
  bestFor: string[];
};

export type ZavorthAutonomySliderContract = {
  contractVersion: typeof ZAVORTH_AUTONOMY_SLIDER_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'autonomy-slider';
  selectedProfile: ZavorthExperienceProfileId;
  currentLevel: ZavorthAutonomySliderLevel;
  requestedLevel: ZavorthAutonomySliderLevel;
  changeRisk: ZavorthAutonomySliderChangeRisk;
  headline: string;
  slider: {
    min: 'conservative';
    max: 'business';
    selectedPosition: 0 | 1 | 2 | 3;
    levels: ZavorthAutonomySliderLevelCard[];
  };
  policyPreview: {
    canDoAlone: string[];
    asksFirst: string[];
    alwaysBlocked: string[];
    approvalStyle: string;
    receiptStyle: string;
  };
  applyPlan: {
    canApplyAutomatically: false;
    requiresUserConfirmation: boolean;
    requiresPolicyBroker: true;
    storesRawSecrets: false;
    reversible: true;
    commandPreview: string;
  };
  trustPanel: Pick<
    ZavorthTrustPanelContract,
    'surface' | 'selectedProfile' | 'autonomy' | 'summary' | 'advanced' | 'safety'
  >;
  naturalLanguageExamples: string[];
  invariants: string[];
};
