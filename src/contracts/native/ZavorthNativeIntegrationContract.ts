export const ZAVORTH_NATIVE_INTEGRATION_CONTRACT_VERSION = 'zavorth-native-integration/1' as const;

export type ZavorthNativeIntegrationKind = 'provider' | 'channel' | 'capability';

export type ZavorthNativeIntegrationStatus =
  | 'ready-for-configuration'
  | 'configured-proof-required'
  | 'needs-native-adapter';

export type ZavorthNativeIntegrationEntry = {
  id: string;
  kind: ZavorthNativeIntegrationKind;
  source: 'zavorth-native-catalog';
  status: ZavorthNativeIntegrationStatus;
  nativeSurface: string;
  configRefs: string[];
  doctorCommand: string;
  liveProofCommand: string;
  safety: {
    zavorthNative: true;
    noSecretsSerialized: true;
    liveUseRequiresExplicitConfiguration: true;
    liveProofRequiresOperatorConfirmation: true;
  };
  evidence: string[];
};

export type ZavorthNativeIntegrationSnapshot = {
  contractVersion: typeof ZAVORTH_NATIVE_INTEGRATION_CONTRACT_VERSION;
  generatedAt: string;
  catalogId: 'zavorth-native';
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    providers: number;
    channels: number;
    capabilities: number;
    nativeReady: number;
    needsAdapter: number;
    missingConfigurationOnly: boolean;
  };
  entries: ZavorthNativeIntegrationEntry[];
  safety: {
    inventoryOnly: true;
    noRuntimeAdapterCodeExecuted: true;
    noSecretsRead: true;
    noLiveNetworkCalls: true;
    zavorthNativeActivationRequiresConfigAndProof: true;
  };
  nextActions: string[];
};
