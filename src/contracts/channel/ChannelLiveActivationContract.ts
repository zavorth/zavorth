import type { LiveReadinessStatus } from '../LiveReadinessContract.js';

export const ZAVORTH_CHANNEL_LIVE_ACTIVATION_CONTRACT_VERSION = '2026-05-04.live-gate-2' as const;

export type ChannelLiveActivationPriorityId =
  | 'signal'
  | 'msteams'
  | 'slack'
  | 'whatsapp'
  | 'discord'
  | 'telegram';

export type ChannelLiveActivationGateKind =
  | 'config-schema'
  | 'setup-doctor'
  | 'local-inbound-envelope'
  | 'local-outbound-delivery'
  | 'staging-live-smoke'
  | 'real-send-path'
  | 'inbound-validation'
  | 'fallback-policy'
  | 'redacted-receipt';

export type ChannelLiveActivationGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type ChannelLiveActivationGate = {
  kind: ChannelLiveActivationGateKind;
  status: ChannelLiveActivationGateStatus;
  evidence: string;
  command: string | null;
};

export type ChannelLiveActivationConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  allowlistEnv: string[];
  secretEnv: string[];
  secretValuesSerialized: false;
};

export type ChannelLiveActivationReceipt = {
  id: string;
  channelId: ChannelLiveActivationPriorityId;
  status: LiveReadinessStatus;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  secretValuesSerialized: false;
};

export type ChannelLiveActivationEntry = {
  channelId: ChannelLiveActivationPriorityId;
  platformId: string;
  status: Extract<LiveReadinessStatus, 'live-ready' | 'partial-live' | 'configured-only' | 'blocked'>;
  previousStatus: LiveReadinessStatus;
  runtimeTarget: string;
  gatewayTarget: string;
  adapterTarget: string;
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  configSchema: ChannelLiveActivationConfigSchema;
  capabilities: {
    inbound: boolean;
    outbound: boolean;
    replies: boolean;
    edits: boolean;
    attachments: boolean;
    threads: boolean;
    webhookValidation: boolean;
    fallbackOutbox: boolean;
  };
  gates: ChannelLiveActivationGate[];
  gaps: string[];
  receipt: ChannelLiveActivationReceipt;
};

export type ChannelLiveActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CHANNEL_LIVE_ACTIVATION_CONTRACT_VERSION;
  gate: 'channel-live-activation-priority';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    channels: 6;
    liveReady: number;
    partialLive: number;
    configuredOnly: number;
    blocked: number;
    signalAndTeamsOutboxOnly: false;
    configSchemas: number;
    setupDoctors: number;
    localInboundEnvelopeTests: number;
    localOutboundDeliveryTests: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    liveIoRequiredByCertificationCheck: false;
    secretValuesSerialized: false;
  };
  entries: ChannelLiveActivationEntry[];
  receipts: ChannelLiveActivationReceipt[];
  policy: {
    noLiveIoDuringCertificationCheck: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    outboxAllowedOnlyAsFallback: true;
    signalUsesJsonRpcOrSignalCli: true;
    teamsUsesMicrosoftGraph: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run channel-live-activation:check --silent';
    doctor: 'npm run channel-live-activation -- --profile configured';
    stagingLiveSmoke: 'npm run channel-live-activation -- --profile staging-live --channel <channel> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextGate: 'Connector registry - Provider Runtime Activation';
  };
};
