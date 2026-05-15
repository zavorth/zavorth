import type {
  ZavorthFirstRunProductJourneyContract,
  ZavorthGuidedMissionTemplate,
} from './ZavorthFirstRunProductJourneyContract.js';
import type { ZavorthProductModeContract } from './ZavorthProductModeContract.js';
import type { ZavorthSandboxReadinessContract } from './ZavorthSandboxReadinessContract.js';
import type { ZavorthConversationalSetupLanguage } from './ZavorthConversationalSetupContract.js';
import type { ZavorthExperienceProfileId } from './ZavorthExperienceProfileContract.js';

export const ZAVORTH_UNIFIED_ONBOARDING_CONTRACT_VERSION = '2026-05-13.phase-2' as const;

export type ZavorthUnifiedOnboardingStatus = 'ready' | 'needs_setup' | 'attention';

export type ZavorthUnifiedOnboardingStepId =
  | 'mode'
  | 'provider'
  | 'workspace'
  | 'sandbox'
  | 'channels'
  | 'template'
  | 'first-mission';

export type ZavorthUnifiedOnboardingStepStatus = 'done' | 'ready' | 'needs_input' | 'recommended' | 'optional';

export type ZavorthUnifiedOnboardingCommandId =
  | 'onboard'
  | 'conversation'
  | 'go'
  | 'doctor-simple'
  | 'doctor-advanced'
  | 'templates'
  | 'missions'
  | 'receipts'
  | 'gateway-status';

export type ZavorthUnifiedOnboardingStep = {
  id: ZavorthUnifiedOnboardingStepId;
  label: string;
  status: ZavorthUnifiedOnboardingStepStatus;
  summary: string;
  command: string;
  userAction: string;
  safeDefault: string;
};

export type ZavorthUnifiedOnboardingProviderSummary = {
  status: 'ready' | 'missing_auth' | 'needs_probe' | 'attention';
  activeProvider: string;
  activeModel: string;
  ready: number;
  missingAuth: number;
  needsProbe: number;
  nextAction: string;
};

export type ZavorthUnifiedOnboardingCommand = {
  id: ZavorthUnifiedOnboardingCommandId;
  command: string;
  summary: string;
  appliesMutation: boolean;
};

export type ZavorthUnifiedOnboardingSnapshot = {
  contractVersion: typeof ZAVORTH_UNIFIED_ONBOARDING_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'unified-onboarding';
  generatedAt: string;
  status: ZavorthUnifiedOnboardingStatus;
  productMode: ZavorthProductModeContract;
  firstRun: ZavorthFirstRunProductJourneyContract;
  sandbox: ZavorthSandboxReadinessContract;
  provider: ZavorthUnifiedOnboardingProviderSummary;
  templates: ZavorthGuidedMissionTemplate[];
  steps: ZavorthUnifiedOnboardingStep[];
  commands: ZavorthUnifiedOnboardingCommand[];
  conversationalSetup: {
    command: 'zavorth onboard conversation';
    status: 'ready' | 'needs_input' | 'blocked';
    uiLanguage: ZavorthConversationalSetupLanguage;
    selectedProfile: ZavorthExperienceProfileId;
    writesOnlyWithConfirmation: true;
  };
  safeDemo: {
    command: string;
    templateId: string;
    readOnly: true;
    summary: string;
  };
  commandCenterProjection: {
    route: '/dashboard';
    executionAuthority: false;
    visualBlocksRequireOwnerApproval: true;
    endpoint: '/api/onboarding/unified';
  };
  invariants: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
  nextAction: string;
};
