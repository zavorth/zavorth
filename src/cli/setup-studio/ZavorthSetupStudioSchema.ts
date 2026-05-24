import type { ZavorthSetupStudioPlan } from '../ZavorthSetupStudioService.js';
import type { ZavorthPremiumCliStep } from '../premium/index.js';

export type ZavorthSetupStudioMode = 'quickstart' | 'safe' | 'advanced';

export type ZavorthSetupStudioConfigHandling = 'keep' | 'review' | 'reset';

export type ZavorthSetupStudioStepId =
  | 'security'
  | 'existing-config'
  | 'setup-mode'
  | 'provider'
  | 'channels'
  | 'web-search'
  | 'skills'
  | 'hooks'
  | 'gateway'
  | 'control-ui'
  | 'memory'
  | 'trust'
  | 'doctor'
  | 'hatch';

export type ZavorthSetupStudioStep = ZavorthPremiumCliStep & {
  id: ZavorthSetupStudioStepId;
};

export type ZavorthSetupStudioExistingConfig = {
  profileExists: boolean;
  envExists: boolean;
  configuredProvider: string | null;
  configuredModel: string | null;
  configuredChannels: string[];
  warnings: string[];
};

export type ZavorthSetupStudioChannelGuide = {
  id: string;
  label: string;
  status: 'ready' | 'recommended' | 'available' | 'missing-config';
  setupCommand: string;
  detail: string;
};

export type ZavorthSetupStudioWebSearchReadiness = {
  status: 'ready' | 'recommended' | 'available';
  provider: string;
  options: Array<{
    id: string;
    label: string;
    detail: string;
    requiresSecret: boolean;
  }>;
};

export type ZavorthSetupStudioSkillReadiness = {
  eligible: number;
  missingRequirements: number;
  unsupportedOnThisOs: number;
  blockedByPolicy: number;
  recommendedSetupCommand: string;
  highlights: string[];
};

export type ZavorthSetupStudioHooksReadiness = {
  configured: boolean;
  available: boolean;
  examples: string[];
  setupCommand: string;
};

export type ZavorthSetupStudioGatewayReadiness = {
  installed: boolean;
  recommendedRuntime: 'node';
  startCommand: string;
  foregroundCommand: string;
  detail: string;
};

export type ZavorthSetupStudioControlUiReadiness = {
  url: string;
  tokenStatus: 'configured' | 'generated-at-runtime' | 'missing';
  openCommand: string;
  docsCommand: string;
};

export type ZavorthSetupStudioHatchPlan = {
  recommendedMode: 'terminal' | 'browser' | 'later';
  bootstrapPrompt: string;
  commands: string[];
};

export type ZavorthSetupStudioSnapshot = {
  contractVersion: 'zavorth-setup-studio-snapshot/1';
  generatedAt: string;
  projectRoot: string;
  mode: ZavorthSetupStudioMode;
  configHandling: ZavorthSetupStudioConfigHandling;
  existingConfig: ZavorthSetupStudioExistingConfig;
  plan: ZavorthSetupStudioPlan;
  channelGuide: ZavorthSetupStudioChannelGuide[];
  webSearch: ZavorthSetupStudioWebSearchReadiness;
  skills: ZavorthSetupStudioSkillReadiness;
  hooks: ZavorthSetupStudioHooksReadiness;
  gateway: ZavorthSetupStudioGatewayReadiness;
  controlUi: ZavorthSetupStudioControlUiReadiness;
  hatch: ZavorthSetupStudioHatchPlan;
  steps: ZavorthSetupStudioStep[];
  nextActions: Array<{
    label: string;
    command: string;
    detail?: string;
  }>;
  safety: {
    dryRun: boolean;
    writesRequireConfirmation: true;
    noSecretInOutput: true;
    noRuntimeStart: true;
    liveProviderProbeRequiresConsent: true;
  };
};
