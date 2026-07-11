export const ZAVORTH_CAPABILITY_ABSORPTION_CONTRACT_VERSION =
  '2026-05-24.phase-1-capability-absorption-map' as const;

export type ZavorthCapabilityAbsorptionStatus =
  | 'native'
  | 'partial'
  | 'cataloged'
  | 'missing'
  | 'requires_credentials'
  | 'requires_app';

export type ZavorthCapabilityAbsorptionSource =
  | 'zavorth'
  | 'catalog-seed'
  | 'zavorth-native'
  | 'ecosystem-signal';

export type ZavorthCapabilityAbsorptionCategory =
  | 'governance'
  | 'onboarding'
  | 'channel'
  | 'provider'
  | 'learning'
  | 'skill'
  | 'zavorthControl'
  | 'cli'
  | 'browser'
  | 'computer-use'
  | 'scheduler'
  | 'execution-backend'
  | 'native-app'
  | 'plugin'
  | 'voice'
  | 'memory'
  | 'qa';

export type ZavorthCapabilityAbsorptionItem = {
  id: string;
  label: string;
  category: ZavorthCapabilityAbsorptionCategory;
  source: ZavorthCapabilityAbsorptionSource;
  desiredOutcome: string;
  status: ZavorthCapabilityAbsorptionStatus;
  zavorthNativeSurface: string;
  currentEvidence: string[];
  missingForFullNative: string[];
  risks: string[];
  nextPhase:
    | 'phase-2-channel-deepening'
    | 'phase-3-learning-loop'
    | 'phase-4-zavorthControl'
    | 'phase-5-browser-computer-use'
    | 'phase-6-execution-backends'
    | 'phase-7-satellite-apps'
    | 'phase-8-plugin-sdk'
    | 'phase-9-live-product-qa'
    | 'already-native';
};

export type ZavorthCapabilityAbsorptionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CAPABILITY_ABSORPTION_CONTRACT_VERSION;
  source: 'ZavorthCapabilityAbsorptionService';
  status: 'passed' | 'attention' | 'blocked';
  items: ZavorthCapabilityAbsorptionItem[];
  summary: {
    total: number;
    native: number;
    partial: number;
    cataloged: number;
    missing: number;
    requiresCredentials: number;
    requiresApp: number;
    catalogSeeded: number;
    zavorthNativeSeeded: number;
    ecosystemSignals: number;
    nextPhases: Record<ZavorthCapabilityAbsorptionItem['nextPhase'], number>;
    liveProofStillRequired: number;
    rawSecretsSerialized: false;
    externalIoPerformed: false;
    workspaceMutationPerformed: false;
  };
  policy: {
    catalogIsNotLiveProof: true;
    everyLiveAdapterNeedsCredentialProof: true;
    securityPolicyCannotBeLearnedAway: true;
    channelsRequirePairingOrAllowlist: true;
    appsRequireSeparateSignedArtifacts: true;
    rawSecretsSerialized: false;
  };
  commands: {
    inspect: 'npm run zavorth:capability-absorption';
    inspectJson: 'npm run zavorth:capability-absorption:json';
    check: 'npm run zavorth:capability-absorption:check --silent';
    next: 'Channel Deepening';
  };
};
