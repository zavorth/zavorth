export const ZAVORTH_CHANNEL_CAPABILITY_ATLAS_CONTRACT_VERSION =
  '2026-06-03.channel-capability-atlas.v1' as const;

export type ZavorthChannelCapabilityAtlasStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthChannelCapabilityAtlasLevel =
  | 'core-native'
  | 'native-configurable';

export type ZavorthChannelCapabilityAtlasState =
  | 'active'
  | 'configured'
  | 'needs-config';

export type ZavorthChannelCapabilityAtlasZavorthControlAction =
  | 'open'
  | 'connect'
  | 'details';

export type ZavorthChannelCapabilityAtlasProof = {
  available: boolean;
  command: string;
  liveIoUsedByDefault: boolean;
  requiresExplicitConfirmation?: boolean;
};

export type ZavorthChannelCapabilityAtlasEntry = {
  id: string;
  label: string;
  level: ZavorthChannelCapabilityAtlasLevel;
  state: ZavorthChannelCapabilityAtlasState;
  adapterFamily: string;
  transport: string;
  envRefs: string[];
  requiredEnv: string[];
  optionalEnv: string[];
  capabilities: {
    inbound: boolean;
    outbound: boolean;
    replies: boolean;
    attachments: boolean;
    threads: boolean;
    webhookValidation: boolean;
    localProcess: boolean;
  };
  doctor: ZavorthChannelCapabilityAtlasProof;
  liveSmoke: ZavorthChannelCapabilityAtlasProof;
  zavorthControlAction: ZavorthChannelCapabilityAtlasZavorthControlAction;
  statusReason: string;
};

export type ZavorthChannelCapabilityAtlasSnapshot = {
  contractVersion: typeof ZAVORTH_CHANNEL_CAPABILITY_ATLAS_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'channel-capability-atlas';
  status: ZavorthChannelCapabilityAtlasStatus;
  summary: {
    total: number;
    coreNative: number;
    nativeConfigurable: number;
    active: number;
    configured: number;
    needsConfig: number;
    doctorAvailable: number;
    liveSmokeAvailable: number;
  };
  channels: ZavorthChannelCapabilityAtlasEntry[];
  llmContextBlock: string;
  commands: {
    status: string;
    json: string;
    lookup: string;
    doctor: string;
    liveSmoke: string;
  };
  safety: {
    readOnlyInventory: true;
    noSecretsSerialized: true;
    inboundBecomesIntentNotExecution: true;
    outboundRequiresPolicyOrApproval: true;
  };
};
