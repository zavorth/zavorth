export const REACH_CHANNEL_SPINE_CONTRACT_VERSION = 'zavorth-reach-channel-spine/v1' as const;

/** Stable ring channels — first-class selective spine members. Long-tail stays outside this set. */
export type ReachChannelSpineMemberId =
  | 'web'
  | 'cli'
  | 'telegram'
  | 'discord'
  | 'slack';

export type ReachChannelSpineMembership =
  | 'stable-ring'
  | 'long-tail'
  | 'out-of-ring';

export type ReachChannelSpineReadiness =
  | 'live-ready'
  | 'partial-live'
  | 'configured-only'
  | 'needs-setup'
  | 'catalogued'
  | 'blocked';

export type ReachChannelSpineCapabilityFlags = {
  inbound: boolean;
  outbound: boolean;
  allowlist: boolean;
  doctor: boolean;
  installScaffold: boolean;
  outboxFallback: boolean;
  mockIo: boolean;
  continuity: boolean;
  liveReadiness: boolean;
};

export type ReachChannelSpineMember = {
  id: ReachChannelSpineMemberId;
  label: string;
  membership: 'stable-ring';
  preferredOrder: number;
  readiness: ReachChannelSpineReadiness;
  configured: boolean;
  liveReady: boolean;
  gatewayTarget: string;
  doctorCommand: string;
  installCommand: string;
  liveActivationCommand: string;
  smokeCommand: string;
  requiredEnvKeys: string[];
  allowlistEnvKeys: string[];
  missingEnvKeys: string[];
  capabilities: ReachChannelSpineCapabilityFlags;
  notes: string[];
};

export type ReachChannelSpineHandoffPreview = {
  id: string;
  fromChannel: ReachChannelSpineMemberId | string;
  toChannel: ReachChannelSpineMemberId | string;
  continuityKey: string;
  status: 'needs-approval' | 'available' | 'blocked';
  requiresApproval: true;
  previewRequired: true;
  command: string;
  reason: string;
};

export type ReachChannelSpineReceipt = {
  id: string;
  kind: 'membership' | 'doctor' | 'install' | 'local-io' | 'continuity' | 'long-tail-boundary';
  status: 'ready' | 'partial' | 'missing';
  detail: string;
  secretValuesSerialized: false;
};

export type ReachChannelSpineSnapshot = {
  contractVersion: typeof REACH_CHANNEL_SPINE_CONTRACT_VERSION;
  source: 'ReachChannelSpineService';
  generatedAt: string;
  status: 'ready' | 'partial' | 'attention' | 'blocked';
  stableRing: {
    ids: ReachChannelSpineMemberId[];
    preferredThird: 'slack';
    description: string;
  };
  longTailPolicy: {
    activationService: 'ChannelLongTailActivationService';
    separateFromSpine: true;
    telegramParityRequired: false;
    note: string;
  };
  summary: {
    memberCount: number;
    configuredCount: number;
    liveReadyCount: number;
    needsSetupCount: number;
    doctorCovered: number;
    installCovered: number;
    mockIoCovered: number;
    continuityHandoffs: number;
    longTailChannelsExcluded: true;
  };
  members: ReachChannelSpineMember[];
  continuity: {
    sessionKeyScheme: 'userId:sessionId';
    approvalRequiredForChannelSwitch: true;
    handoffs: ReachChannelSpineHandoffPreview[];
    bridgedPairs: Array<{ from: string; to: string }>;
  };
  receipts: ReachChannelSpineReceipt[];
  policy: {
    catalogIsNotLive: true;
    longTailActivationSeparate: true;
    noTelegramParityOnLongTail: true;
    approvalRequiredForChannelSwitch: true;
    noLiveNetworkRequiredForSpineSmoke: true;
    secretValuesSerialized: false;
  };
  commands: {
    inventory: string;
    doctor: string;
    install: string;
    continuity: string;
    focusedTests: string[];
  };
  nextSafeAction: string;
};
