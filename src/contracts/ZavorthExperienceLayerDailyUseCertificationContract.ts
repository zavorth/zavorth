export const ZAVORTH_EXPERIENCE_LAYER_DAILY_USE_CERTIFICATION_VERSION =
  '2026-05-15.experience-layer.checkpoint-14' as const;

export type ZavorthExperienceLayerDailyUsePhaseStatus =
  | 'contract_passed'
  | 'projection_passed'
  | 'blocked';

export type ZavorthExperienceLayerDailyUsePhase = {
  id: string;
  title: string;
  command: string;
  surface: 'onboarding' | 'dashboard' | 'cli' | 'satellite' | 'runtime';
  status: ZavorthExperienceLayerDailyUsePhaseStatus;
  evidence: string[];
  riskBoundary: string;
};

export type ZavorthExperienceLayerDailyUseCertificationSnapshot = {
  contractVersion: typeof ZAVORTH_EXPERIENCE_LAYER_DAILY_USE_CERTIFICATION_VERSION;
  schemaVersion: 1;
  surface: 'experience-layer-daily-use-certification';
  generatedAt: string;
  result: 'passed' | 'blocked';
  coveredPhases: number;
  phases: ZavorthExperienceLayerDailyUsePhase[];
  dailyUseFlow: string[];
  safety: {
    projectionsOnly: true;
    hiddenExecutionAuthority: false;
    policyBrokerRequiredForSensitiveActions: true;
    rawSecretsSerialized: false;
  };
  invariants: string[];
};
