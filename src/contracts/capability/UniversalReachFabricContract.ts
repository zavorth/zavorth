/**
 * Universal Reach Fabric
 *
 * Honest channel tiers + expandable protocol packs + node mesh product surface.
 * Catalog support is never live readiness. Brand-agnostic.
 */

export const UNIVERSAL_REACH_FABRIC_CONTRACT_VERSION =
  'zavorth-universal-reach-fabric/v1' as const;

/** Tier A = native deep, B = protocol pack, C = synthesized draft */
export type ReachChannelTier = 'A' | 'B' | 'C';

export type ReachChannelReadiness =
  | 'live-ready'
  | 'configured'
  | 'needs-setup'
  | 'catalogued'
  | 'synthesized'
  | 'blocked'
  | 'unsupported';

export type ReachReadinessProof =
  | 'none'
  | 'catalog'
  | 'configuration'
  | 'doctor'
  | 'health'
  | 'live_event'
  | 'bridge'
  | 'synthesis'
  | 'blocked';

export type ReachChannelFamily =
  | 'local-surface'
  | 'bot-api'
  | 'webhook'
  | 'local-bridge'
  | 'graph-api'
  | 'relay'
  | 'mail'
  | 'synthesized'
  | 'unknown';

export type ReachChannelEntry = {
  id: string;
  label: string;
  tier: ReachChannelTier;
  family: ReachChannelFamily;
  readiness: ReachChannelReadiness;
  proof: ReachReadinessProof;
  configured: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  defaultBlockReason: string | null;
  doctorCommand: string;
  setupHint: string;
  features: {
    inbound: boolean;
    outbound: boolean;
    pairing: boolean;
    allowlist: boolean;
    doctor: boolean;
    media: boolean;
  };
  requiredEnvKeys: string[];
  missingEnvKeys: string[];
};

export type ReachChannelSynthesisDraft = {
  id: string;
  channelId: string;
  label: string;
  family: ReachChannelFamily;
  trustState: 'draft' | 'quarantined' | 'previewed' | 'approved' | 'enabled' | 'denied';
  sourceNotes: string;
  packDir: string;
  files: string[];
  requiredEnvKeys: string[];
  webhookPath: string;
  doctorSteps: string[];
  liveReady: false;
  createdAt: string;
};

export type ReachNodeCapabilityFamily =
  | 'files'
  | 'shell'
  | 'camera'
  | 'screen'
  | 'location'
  | 'notify'
  | 'voice'
  | 'canvas'
  | 'clipboard'
  | 'device'
  | 'browser'
  | 'maintenance';

export type ReachNodeCapability = {
  id: string;
  family: ReachNodeCapabilityFamily;
  label: string;
  risk: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  description: string;
};

export type ReachNodeStatus =
  | 'empty'
  | 'draft'
  | 'paired'
  | 'online'
  | 'ready'
  | 'offline'
  | 'blocked';

export type ReachNodeEntry = {
  nodeId: string;
  label: string;
  status: ReachNodeStatus;
  profileId: string | null;
  paired: boolean;
  declaredCapabilities: string[];
  approvedCapabilities: string[];
  needsCapabilityReapproval: boolean;
  canInvoke: boolean;
  lastSeenAt: string | null;
  nextSafeAction: string;
};

export type ReachNodePairingDraft = {
  nodeId: string;
  pairingCode: string;
  profileId: string;
  capabilityIds: string[];
  expiresAt: string | null;
  bootstrapCommand: string;
  companionCommand: string;
  createdAt: string;
};

export type ReachNodeInvokePreview = {
  nodeId: string;
  capabilityId: string;
  action: string;
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  risk: 'low' | 'medium' | 'high';
};

export type ReachFabricReceipt = {
  id: string;
  kind:
    | 'channel-inventory'
    | 'channel-doctor'
    | 'channel-synthesis-preview'
    | 'channel-synthesis-materialize'
    | 'node-pairing-draft'
    | 'node-invoke-preview'
    | 'node-invoke'
    | 'deny';
  status: 'pass' | 'deny' | 'hold' | 'preview';
  summary: string;
  subjectId: string | null;
  createdAt: string;
  rawSecretsSerialized: false;
};

export type ReachFabricPolicy = {
  catalogIsNotLive: true;
  tierCNeverLiveWithoutProof: true;
  secretRefsOnly: true;
  rawSecretsSerialized: false;
  brandAgnostic: true;
  nodeCapabilityReapprovalRequired: true;
  previewBeforeMutate: true;
};

export type ReachFabricSnapshot = {
  contractVersion: typeof UNIVERSAL_REACH_FABRIC_CONTRACT_VERSION;
  generatedAt: string;
  status: 'ok' | 'attention' | 'blocked';
  channels: ReachChannelEntry[];
  nodes: ReachNodeEntry[];
  nodeCapabilities: ReachNodeCapability[];
  synthesisDrafts: ReachChannelSynthesisDraft[];
  receipts: ReachFabricReceipt[];
  summary: {
    channelsTotal: number;
    tierA: number;
    tierB: number;
    tierC: number;
    liveReady: number;
    configuredOnly: number;
    catalogued: number;
    synthesized: number;
    nodesTotal: number;
    nodesReady: number;
    nodesNeedReapproval: number;
  };
  policy: ReachFabricPolicy;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextSafeAction: string;
  };
};
