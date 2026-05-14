export const ZAVORTH_SOURCE_CHANNEL_MESH_EXPANSION_CONTRACT_VERSION = '2026-05-05.phase-4' as const;

export const SOURCE_CHANNEL_MESH_PACKAGES = [
  '@slack/web-api',
  '@slack/bolt',
  'discord.js',
  'grammy',
  '@whiskeysockets/baileys',
  'qrcode',
  'signal-utils',
  '@matrix-org/matrix-sdk-crypto-nodejs',
] as const;

export type SourceChannelMeshPackageName = typeof SOURCE_CHANNEL_MESH_PACKAGES[number];

export type ChannelRuntimeId =
  | 'slack'
  | 'whatsapp-cloud'
  | 'whatsapp-baileys'
  | 'discord'
  | 'telegram'
  | 'signal'
  | 'matrix'
  | 'msteams';

export type ChannelRuntimeAction =
  | 'send'
  | 'receive'
  | 'thread'
  | 'edit'
  | 'delete'
  | 'reaction'
  | 'attachment';

export type ChannelRuntimeFamily =
  | 'slack-web-api'
  | 'whatsapp-cloud-api'
  | 'whatsapp-baileys-owner-gated'
  | 'discord-native'
  | 'telegram-native'
  | 'signal-bridge'
  | 'matrix-relay'
  | 'teams-graph';

export type ChannelPackStatus =
  | 'ready'
  | 'configured'
  | 'owner_decision_required'
  | 'replaced-by-existing-channel'
  | 'blocked'
  | 'missing';

export type ChannelPackDecision =
  | 'implemented'
  | 'implemented-owner-gated'
  | 'replaced-by-existing-zavorth-channel'
  | 'rejected-by-default';

export type ChannelRuntimeContract = {
  channelId: ChannelRuntimeId;
  family: ChannelRuntimeFamily;
  actions: ChannelRuntimeAction[];
  liveIoByDefault: false;
  explicitLiveCommandRequired: true;
  secretRefOnlyAuth: true;
  allowlistRequired: true;
  secretValuesSerialized: false;
};

export type ChannelRuntimeMessage = {
  id: string;
  channelId: ChannelRuntimeId;
  threadId: string | null;
  senderId: string;
  recipientId: string;
  text: string;
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    bytes: number;
  }>;
  reactions: Array<{
    name: string;
    senderId: string;
  }>;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChannelRuntimeReceipt = {
  id: string;
  channelId: ChannelRuntimeId;
  action: ChannelRuntimeAction;
  status: 'applied' | 'blocked' | 'simulated';
  messageId: string | null;
  threadId: string | null;
  liveIoPerformed: boolean;
  secretValuesSerialized: false;
  reason: string;
};

export type ChannelSimulatorSnapshot = {
  generatedAt: string;
  status: 'passed' | 'failed';
  channelId: ChannelRuntimeId;
  actionsCovered: ChannelRuntimeAction[];
  messages: ChannelRuntimeMessage[];
  receipts: ChannelRuntimeReceipt[];
  summary: {
    messages: number;
    receipts: number;
    send: number;
    receive: number;
    thread: number;
    edit: number;
    delete: number;
    reaction: number;
    attachment: number;
    liveIoPerformed: false;
    secretValuesSerialized: false;
  };
};

export type ChannelSecretPolicyReceipt = {
  channelId: ChannelRuntimeId;
  status: 'passed' | 'failed';
  requiredSecretRefs: string[];
  optionalSecretRefs: string[];
  allowlistRefs: string[];
  rawSecretValuesAccepted: false;
  missingRequiredSecretRefs: string[];
  missingAllowlistRefs: string[];
  secretValuesSerialized: false;
};

export type ChannelPatchRiskReceipt = {
  channelId: ChannelRuntimeId;
  status: 'owner_decision_required' | 'waived' | 'blocked';
  packageName: SourceChannelMeshPackageName;
  patchEvidencePath: string | null;
  patchPresentInSource: boolean;
  packageInstalledInZavorth: boolean;
  ownerDecisionRequired: true;
  reason: string;
};

export type ChannelPackageEvidence = {
  packageName: SourceChannelMeshPackageName;
  presentInSource: boolean;
  presentInZavorthPackageJson: boolean;
  presentInZavorthLockfile: boolean;
  sourceReferenceFiles: string[];
  zavorthReferenceFiles: string[];
  decision: 'implemented' | 'replaced' | 'owner-gated' | 'not-needed';
};

export type ChannelPackEntry = {
  channelId: ChannelRuntimeId;
  family: ChannelRuntimeFamily;
  status: ChannelPackStatus;
  decision: ChannelPackDecision;
  contract: ChannelRuntimeContract;
  adapterPath: string;
  packageNames: SourceChannelMeshPackageName[];
  configured: boolean;
  ownerApprovalRequired: boolean;
  liveIoPerformed: false;
  enabledByDefault: false;
  secretPolicy: ChannelSecretPolicyReceipt;
  patchRiskReceipt?: ChannelPatchRiskReceipt;
  liveSmokeCommand: string;
  notes: string[];
};

export type SourceChannelMeshExpansionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_CHANNEL_MESH_EXPANSION_CONTRACT_VERSION;
  status: 'passed' | 'failed';
  phase: 4;
  statement: 'Source channel behavior is absorbed as optional Zavorth Channel Mesh packs, offline simulator coverage, secret policy and live-smoke receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  packageEvidence: ChannelPackageEvidence[];
  packs: ChannelPackEntry[];
  simulator: ChannelSimulatorSnapshot;
  summary: {
    packagesTracked: number;
    packagesPresentInSource: number;
    packagesImplementedInZavorth: number;
    packs: number;
    packsReadyOrReplaced: number;
    ownerGatedPacks: number;
    simulatorReceipts: number;
    actionsCovered: number;
    liveIoPerformed: false;
    enabledByDefault: false;
    secretValuesSerialized: false;
  };
  policy: {
    noSourceSourceCopy: true;
    optionalPacksOnly: true;
    noLiveIoDuringPhase4Check: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    secretRefOnlyChannelAuth: true;
    allowlistRequiredBeforeLiveSend: true;
    whatsappBaileysRequiresPatchRiskOwnerDecision: true;
    artifactFirstReceipts: true;
  };
  commands: {
    inspect: 'npm run source-channel-mesh-expansion --silent';
    inspectJson: 'npm run source-channel-mesh-expansion:json --silent';
    check: 'npm run source-channel-mesh-expansion:check --silent';
    qa: 'npm run qa:source-channel-mesh-expansion --silent';
    liveSmoke: 'npm run source-channel-mesh-expansion -- --channel <channel> --confirm-live-io';
    nextPhase: 'Phase 5 - Memory, Document, Search And Terminal Pack';
  };
};
