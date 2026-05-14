import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_CHANNEL_LIVE_ACTIVATION_CONTRACT_VERSION = '2026-05-04.live-phase-2' as const;

export type ChannelLiveActivationP0Id =
  | 'signal'
  | 'msteams'
  | 'slack'
  | 'whatsapp'
  | 'discord'
  | 'telegram';

export type ChannelLiveActivationGateKind =
  | 'config-schema'
  | 'setup-doctor'
  | 'inbound-mock'
  | 'outbound-mock'
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
  channelId: ChannelLiveActivationP0Id;
  status: LiveReadinessStatus;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  secretValuesSerialized: false;
};

export type ChannelLiveActivationEntry = {
  channelId: ChannelLiveActivationP0Id;
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
  phase: 'Phase 2 - Channel Live Activation P0';
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
    inboundMockTests: number;
    outboundMockTests: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    liveIoRequiredByPhase2Check: false;
    secretValuesSerialized: false;
  };
  entries: ChannelLiveActivationEntry[];
  receipts: ChannelLiveActivationReceipt[];
  policy: {
    noLiveIoDuringPhase2Check: true;
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
    nextPhase: 'Phase 4 - Provider Runtime Activation P0';
  };
};
