export const ZAVORTH_CHANNEL_DEEPENING_CONTRACT_VERSION =
  '2026-05-24.phase-2-channel-deepening' as const;

export type ZavorthChannelDeepeningStatus =
  | 'live_ready'
  | 'native_ready'
  | 'outbox_ready'
  | 'setup_ready'
  | 'requires_credentials'
  | 'requires_bridge'
  | 'cataloged'
  | 'blocked';

export type ZavorthChannelDeepeningFamily =
  | 'internal'
  | 'bot-api'
  | 'webhook'
  | 'local-bridge'
  | 'apple-bridge'
  | 'relay'
  | 'email'
  | 'social'
  | 'device'
  | 'outbox-only';

export type ZavorthChannelDeepeningRisk = 'low' | 'medium' | 'high' | 'experimental';

export type ZavorthChannelDeepeningCapabilities = {
  setup: true;
  doctor: true;
  pairing: boolean;
  allowlist: boolean;
  read: boolean;
  send: boolean;
  liveProof: true;
  safeOutbox: boolean;
  receipts: true;
  policy: true;
  rateLimit: boolean;
  attachments: boolean;
  threads: boolean;
  qr: boolean;
};

export type ZavorthChannelDeepeningCommands = {
  setup: string;
  doctor: string;
  pairing: string;
  liveProof: string;
  safeOutbox: string | null;
  inspect: string;
};

export type ZavorthChannelDeepeningConfiguration = {
  requiredEnvKeys: string[];
  optionalEnvKeys: string[];
  allowlistEnvKeys: string[];
  secretEnvKeys: string[];
  configuredRequiredEnvKeys: string[];
  missingRequiredEnvKeys: string[];
  allowlistConfigured: boolean;
  rawSecretsSerialized: false;
};

export type ZavorthChannelDeepeningItem = {
  id: string;
  label: string;
  aliases: string[];
  family: ZavorthChannelDeepeningFamily;
  status: ZavorthChannelDeepeningStatus;
  risk: ZavorthChannelDeepeningRisk;
  source: 'zavorth-native' | 'channel-mesh' | 'long-tail' | 'companion' | 'catalog';
  adapterTarget: string;
  runtimeTarget: string;
  capabilities: ZavorthChannelDeepeningCapabilities;
  commands: ZavorthChannelDeepeningCommands;
  configuration: ZavorthChannelDeepeningConfiguration;
  liveProofSignals: string[];
  safeDefaultRoute: boolean;
  defaultBlockReason: string | null;
  missingForFullNative: string[];
  nextAction: string;
};

export type ZavorthChannelDeepeningSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CHANNEL_DEEPENING_CONTRACT_VERSION;
  source: 'ZavorthChannelDeepeningService';
  phase: 'Phase 2 - Channel Deepening';
  status: 'passed' | 'attention' | 'blocked';
  summary: {
    total: number;
    liveReady: number;
    nativeReady: number;
    outboxReady: number;
    setupReady: number;
    requiresCredentials: number;
    requiresBridge: number;
    cataloged: number;
    blocked: number;
    readCapable: number;
    sendCapable: number;
    pairingCapable: number;
    outboxCapable: number;
    liveProofCommands: number;
    allChannelsHaveSetupDoctorPairingProof: boolean;
    allExternalChannelsHavePolicyAndReceipts: boolean;
    nonLiveSendersUseOutboxOrBlock: boolean;
    rawSecretsSerialized: false;
    externalIoPerformed: false;
    workspaceMutationPerformed: false;
  };
  guarantees: {
    catalogIsNotLiveProof: true;
    liveProofRequiresCredentialsAndAllowlist: true;
    remoteChannelsRequirePairingOrAllowlist: true;
    nonLiveOutboundUsesSafeOutbox: true;
    callbacksAndReceiptsNeverSerializeSecrets: true;
    noExternalIoDuringCheck: true;
  };
  items: ZavorthChannelDeepeningItem[];
  commands: {
    inspect: 'npm run zavorth:channel-deepening';
    inspectJson: 'npm run zavorth:channel-deepening:json';
    check: 'npm run zavorth:channel-deepening:check --silent';
    next: 'Phase 3 - Learning Loop';
  };
};
