import type { ZavorthCapabilityStoreCard } from './ZavorthCapabilityStoreContract.js';
import type { ZavorthGuidedMissionCard } from './ZavorthGuidedMissionsContract.js';

export const ZAVORTH_DO_IT_WITH_ME_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-5' as const;

export type ZavorthDoItWithMeMode =
  | 'setup_capability'
  | 'start_mission'
  | 'diagnose_readiness'
  | 'explain_safety';

export type ZavorthDoItWithMeStepActor = 'user' | 'zavorth' | 'policy-broker';

export type ZavorthDoItWithMeStepKind =
  | 'explain'
  | 'physical_action'
  | 'safe_check'
  | 'secretref'
  | 'preview'
  | 'approval'
  | 'receipt';

export type ZavorthDoItWithMeStep = {
  id: string;
  actor: ZavorthDoItWithMeStepActor;
  kind: ZavorthDoItWithMeStepKind;
  title: string;
  instruction: string;
  whyItMatters: string;
  command: string | null;
  canRunAutomatically: boolean;
  requiresApproval: boolean;
  mutatesState: boolean;
};

export type ZavorthDoItWithMeTarget = {
  kind: 'capability' | 'mission' | 'general';
  id: string;
  title: string;
  readiness: string;
  risk: string;
};

export type ZavorthDoItWithMeContract = {
  contractVersion: typeof ZAVORTH_DO_IT_WITH_ME_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'do-it-with-me';
  mode: ZavorthDoItWithMeMode;
  request: string;
  target: ZavorthDoItWithMeTarget;
  headline: string;
  explanation: string;
  steps: ZavorthDoItWithMeStep[];
  questions: string[];
  nextSafeAction: string;
  projections: {
    capability: ZavorthCapabilityStoreCard | null;
    mission: ZavorthGuidedMissionCard | null;
    dashboardRoute: '/dashboard';
    commandCenterCanExecute: false;
  };
  safety: {
    projectionOnly: true;
    rawSecretsSerialized: false;
    asksBeforeSensitiveAction: true;
    liveActionRequiresPolicyBroker: true;
    userCanStopAnytime: true;
  };
  invariants: string[];
};
