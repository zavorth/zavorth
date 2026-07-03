import type { ZavorthSetupStudioPlan } from '../ZavorthSetupStudioService.js';
import type { ZavorthPremiumCliStep } from '../premium/index.js';

export type ZavorthSetupStudioMode = 'quickstart' | 'safe' | 'advanced' | 'blank-slate';

export type ZavorthSetupStudioConfigHandling = 'keep' | 'review' | 'reset';

export type ZavorthSetupStudioSection = 'all' | 'provider' | 'channels' | 'tools' | 'agent';

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

export type ZavorthSetupWizardStepType =
  | 'note'
  | 'select'
  | 'text'
  | 'confirm'
  | 'multiselect'
  | 'progress'
  | 'action';

export type ZavorthSetupWizardStep = {
  id: string;
  section: Exclude<ZavorthSetupStudioSection, 'all'>;
  type: ZavorthSetupWizardStepType;
  title: string;
  message?: string;
  options?: Array<{
    value: string;
    label: string;
    hint?: string;
  }>;
  initialValue?: string | boolean | string[] | null;
  placeholder?: string;
  sensitive?: boolean;
  command?: string;
};

export type ZavorthSetupWizardContract = {
  contractVersion: 'zavorth-setup-wizard-contract/1';
  generatedAt: string;
  locale: 'en';
  section: ZavorthSetupStudioSection;
  steps: ZavorthSetupWizardStep[];
};

export type ZavorthSetupStudioExistingConfig = {
  profileExists: boolean;
  envExists: boolean;
  configuredProvider: string | null;
  configuredModel: string | null;
  configuredChannels: string[];
  warnings: string[];
};

export type ZavorthSetupStudioHomeReadiness = {
  root: string;
  source: 'explicit' | 'env' | 'compat';
  isolated: boolean;
  statusCommand: string;
  switchCommand: string;
  migratePreviewCommand: string;
  migrateApplyCommand: string;
  rollbackCommand: string;
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

export type ZavorthSetupStudioCapabilityActionReadiness = {
  status: 'ready' | 'available' | 'attention';
  exposed: number;
  receipts: number;
  items: Array<{
    id: string;
    title: string;
    status: 'available';
    nextAction: string;
  }>;
  statusCommand: string;
};

export type ZavorthSetupStudioSnapshot = {
  contractVersion: 'zavorth-setup-studio-snapshot/1';
  generatedAt: string;
  projectRoot: string;
  mode: ZavorthSetupStudioMode;
  configHandling: ZavorthSetupStudioConfigHandling;
  setupSection: ZavorthSetupStudioSection;
  existingConfig: ZavorthSetupStudioExistingConfig;
  home: ZavorthSetupStudioHomeReadiness;
  plan: ZavorthSetupStudioPlan;
  channelGuide: ZavorthSetupStudioChannelGuide[];
  webSearch: ZavorthSetupStudioWebSearchReadiness;
  skills: ZavorthSetupStudioSkillReadiness;
  hooks: ZavorthSetupStudioHooksReadiness;
  gateway: ZavorthSetupStudioGatewayReadiness;
  controlUi: ZavorthSetupStudioControlUiReadiness;
  hatch: ZavorthSetupStudioHatchPlan;
  capabilityActions: ZavorthSetupStudioCapabilityActionReadiness;
  steps: ZavorthSetupStudioStep[];
  wizard: ZavorthSetupWizardContract;
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
