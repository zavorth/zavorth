import type {
  ChannelLongTailAdapterFamily,
  ChannelLongTailSendReceipt,
} from '../../adapters/channels/ChannelLongTailLiveClients.js';
import type { LiveReadinessStatus } from '../LiveReadinessContract.js';

export const ZAVORTH_CHANNEL_LONG_TAIL_ACTIVATION_CONTRACT_VERSION = '2026-05-04.live-gate-3' as const;

export type ChannelLongTailActivationId =
  | 'bluebubbles'
  | 'clickclack'
  | 'feishu'
  | 'googlechat'
  | 'imessage'
  | 'irc'
  | 'line'
  | 'matrix'
  | 'mattermost'
  | 'nextcloud-talk'
  | 'nostr'
  | 'qqbot'
  | 'synology-chat'
  | 'tlon'
  | 'twitch'
  | 'webhooks'
  | 'wecom'
  | 'weixin'
  | 'zalo'
  | 'zalouser'
  | 'yuanbao'
  | 'sms'
  | 'home-assistant'
  | 'voice-call'
  | 'google-meet';

export type ChannelLongTailActivationGateKind =
  | 'family-adapter'
  | 'config-schema'
  | 'configured-doctor'
  | 'inbound-local'
  | 'outbound-local'
  | 'staging-live-smoke'
  | 'allowlist-policy'
  | 'redacted-receipt';

export type ChannelLongTailActivationGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type ChannelLongTailActivationConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  allowlistEnv: string[];
  secretEnv: string[];
  secretValuesSerialized: false;
};

export type ChannelLongTailActivationGate = {
  kind: ChannelLongTailActivationGateKind;
  status: ChannelLongTailActivationGateStatus;
  evidence: string;
  command: string | null;
};

export type ChannelLongTailActivationReceipt = {
  id: string;
  channelId: ChannelLongTailActivationId;
  status: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  family: ChannelLongTailAdapterFamily;
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  secretValuesSerialized: false;
};

export type ChannelLongTailConfiguredDoctorReceipt = {
  id: string;
  channelId: ChannelLongTailActivationId;
  family: ChannelLongTailAdapterFamily;
  status: 'configured' | 'missing-config';
  configured: boolean;
  missingRequiredEnv: string[];
  missingRuntimeConfig: string[];
  allowlistConfigured: boolean;
  requiredEnvChecked: string[];
  optionalEnvChecked: string[];
  secretEnvChecked: string[];
  liveIoPerformed: false;
  secretValuesSerialized: false;
};

export type ChannelLongTailStagingLiveReceipt = {
  id: string;
  channelId: ChannelLongTailActivationId;
  family: ChannelLongTailAdapterFamily;
  status: 'sent' | 'blocked';
  confirmed: boolean;
  blockedReason: string | null;
  doctor: ChannelLongTailConfiguredDoctorReceipt;
  sendReceipt: ChannelLongTailSendReceipt | null;
  liveIoPerformed: boolean;
  secretValuesSerialized: false;
};

export type ChannelLongTailActivationEntry = {
  channelId: ChannelLongTailActivationId;
  family: ChannelLongTailAdapterFamily;
  status: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  previousStatus: LiveReadinessStatus;
  runtimeTarget: string;
  adapterTarget: string;
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  configSchema: ChannelLongTailActivationConfigSchema;
  capabilities: {
    inbound: boolean;
    outbound: boolean;
    replies: boolean;
    attachments: boolean;
    threads: boolean;
    webhookValidation: boolean;
    localProcess: boolean;
  };
  gates: ChannelLongTailActivationGate[];
  gaps: string[];
  receipt: ChannelLongTailActivationReceipt;
};

export type ChannelLongTailActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CHANNEL_LONG_TAIL_ACTIVATION_CONTRACT_VERSION;
  gate: 'channel-live-activation-long-tail';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    channels: number;
    partialLive: number;
    configuredOnly: number;
    blocked: number;
    templateOnlyRemaining: false;
    plannedRemaining: false;
    webhookFamily: number;
    botHttpFamily: number;
    relayHttpFamily: number;
    localBridgeFamily: number;
    appleBridgeFamily: number;
    configSchemas: number;
    configuredDoctors: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    liveIoRequiredByStage3Check: false;
    secretValuesSerialized: false;
  };
  entries: ChannelLongTailActivationEntry[];
  receipts: ChannelLongTailActivationReceipt[];
  policy: {
    noLiveIoDuringStage3Check: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    familyAdaptersPreferredOverOneOffCopies: true;
    allowlistsRequiredBeforeLiveSend: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run channel-long-tail-activation:check --silent';
    doctor: 'npm run channel-long-tail-activation -- --profile configured';
    stagingLiveSmoke: 'npm run channel-long-tail-activation -- --profile staging-live --channel <channel> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextAction: 'Connector registry - Provider Runtime Activation';
  };
};
