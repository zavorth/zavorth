import type {
  MessageChannel,
  PlatformImplementationState,
  PlatformReadiness,
  PlatformTransport,
} from './PlatformContract.js';

export type ChannelMeshId = MessageChannel | 'slack' | 'teams' | 'signal';

export type ChannelFeatureSet = {
  inbound: boolean;
  outbound: boolean;
  sessionList: boolean;
  sessionHistory: boolean;
  sessionSend: boolean;
  sessionSpawn: boolean;
  attachments: boolean;
  threads: boolean;
  groupPolicy: boolean;
  identityHints: boolean;
  approvals?: boolean;
  rateLimit?: boolean;
  webhook?: boolean;
  localBridge?: boolean;
  doctor?: boolean;
  interactiveControls?: boolean;
  slashCommands?: boolean;
  richReplies?: boolean;
  qrLogin?: boolean;
};

export type ChannelInteractiveSurface = {
  statusCard: boolean;
  inlineButtons: boolean;
  slashCommands: boolean;
  richReplies: boolean;
  modelMenus: boolean;
  qrLogin: boolean;
};

export type ChannelConnectionSnapshot = {
  running: boolean;
  linked: boolean;
  connected: boolean;
  mode: string | null;
  provider: string | null;
  lastStartAt: string | null;
  lastConnectedAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  authAgeMs: number | null;
};

export type ChannelLoginQrState =
  | 'unsupported'
  | 'not_requested'
  | 'pending'
  | 'ready'
  | 'expired'
  | 'connected'
  | 'error';

export type ChannelLoginQrSnapshot = {
  supported: boolean;
  state: ChannelLoginQrState;
  source: string | null;
  dataUrl: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  nextStep: string;
};

export type ChannelStatusRowTone = 'neutral' | 'success' | 'warning' | 'danger';

export type ChannelStatusRow = {
  label: string;
  value: string;
  tone?: ChannelStatusRowTone;
};

export type ChannelPolicyState = 'open' | 'allowlist' | 'mixed' | 'blocked-only' | 'closed';

export type ChannelPolicySummary = {
  channelId: string;
  state: ChannelPolicyState;
  isOpenAccess: boolean;
  allowedCount: number;
  blockedCount: number;
  summary: string;
};

export type ChannelPolicySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    open: number;
    allowlist: number;
    mixed: number;
    blockedOnly: number;
    closed: number;
  };
  entries: ChannelPolicySummary[];
};

export type ChannelReadinessProof =
  | 'none'
  | 'catalog'
  | 'configuration'
  | 'health'
  | 'live_event'
  | 'bridge'
  | 'blocked';

export interface ChannelPolicyReloadReceipt {
  actor: string;
  reason: string;
  reloadedAt: string;
  source: string;
  cacheWindowMs: number;
  previousUpdatedAt: string | null;
  nextUpdatedAt: string;
  previousPolicyCount: number;
  nextPolicyCount: number;
  changedChannels: string[];
}

export type ChannelMeshActionKind =
  | 'inspect'
  | 'status'
  | 'policy'
  | 'policy-reload'
  | 'broadcast-test'
  | 'prepare'
  | 'doctor'
  | 'repair'
  | 'send-test'
  | 'login-qr'
  | 'relink'
  | 'logout';

export type ChannelMeshActionDescriptor = {
  id: string;
  label: string;
  kind: ChannelMeshActionKind;
  command: string;
};

export type ChannelAdapterStatus = {
  id: ChannelMeshId | string;
  label: string;
  readiness: PlatformReadiness;
  implementationState: PlatformImplementationState;
  configured: boolean;
  transport: PlatformTransport;
  notes: string[];
  features: ChannelFeatureSet;
  riskLevel?: 'low' | 'medium' | 'high' | 'experimental';
  setupMode?: string | null;
  provider?: string | null;
  webhookPath?: string | null;
  doctorCommand?: string | null;
  lastHealth?: 'passed' | 'failed' | 'skipped' | 'unknown' | null;
  lastEventAt?: string | null;
  operatorNextStep?: string | null;
  connection?: ChannelConnectionSnapshot | null;
  statusRows?: ChannelStatusRow[];
  loginQr?: ChannelLoginQrSnapshot | null;
  interactiveSurface?: ChannelInteractiveSurface | null;
};

export interface ChannelAdapterContract {
  readonly id: ChannelMeshId | string;
  describe(): ChannelAdapterStatus;
}

export type RuntimeChannelDescriptor = {
  id: ChannelMeshId | string;
  label?: string;
  readiness?: PlatformReadiness;
  implementationState?: PlatformImplementationState;
  configured?: boolean;
  transport?: PlatformTransport | 'bridge' | 'virtual' | 'planned';
  notes?: string[];
  features?: Partial<ChannelFeatureSet>;
  riskLevel?: ChannelAdapterStatus['riskLevel'];
  setupMode?: string | null;
  provider?: string | null;
  webhookPath?: string | null;
  doctorCommand?: string | null;
  lastHealth?: ChannelAdapterStatus['lastHealth'];
  lastEventAt?: string | null;
  operatorNextStep?: string | null;
};

export interface RuntimeChannelDescriptorContract {
  readonly id: ChannelMeshId | string;
  describeRuntimeChannel(): RuntimeChannelDescriptor;
}

export const CHANNEL_MESH_ROUTE_PATHS = {
  collection: '/api/web/channels',
  actions: '/api/web/channels/actions',
  detail: (channelId: string) => `/api/web/channels/${encodeURIComponent(String(channelId || '').trim().toLowerCase())}`,
  send: (channelId: string) => `/api/web/channels/${encodeURIComponent(String(channelId || '').trim().toLowerCase())}/send`,
  spawn: (channelId: string) => `/api/web/channels/${encodeURIComponent(String(channelId || '').trim().toLowerCase())}/spawn`,
} as const;

export type ChannelMeshSnapshotEntry = ChannelAdapterStatus & {
  source: 'runtime' | 'roadmap';
  summary: string;
  operatorSummary: string;
  actionHint: string;
  tags: string[];
  actions: ChannelMeshActionDescriptor[];
  policy?: ChannelPolicySummary | null;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ChannelReadinessProof;
  defaultBlockReason: string | null;
};

export type ChannelMeshSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
    configured: number;
    sessionSendReady: number;
    attachments: number;
    groupPolicy: number;
    liveReady: number;
    catalogReadyButNotLive: number;
    defaultRouteAllowed: number;
  };
  entries: ChannelMeshSnapshotEntry[];
  selected: ChannelMeshSnapshotEntry | null;
  featuredIds: string[];
  liveCompletion: {
    channelSelectionRequiresLiveProof: true;
    catalogSupportIsNotLiveProof: true;
    sensitiveActionsRequireLiveProof: true;
    liveBridgeRequiresExplicitOperatorAction: true;
    rawSecretsSerialized: false;
    publicApiChannelActionEndpoint: '/api/v1/channels/:id/action';
    defaultRoutingPolicy: 'ready-and-live-proof';
    counts: {
      catalogReady: number;
      liveReady: number;
      catalogReadyButNotLive: number;
      defaultRouteAllowed: number;
    };
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ChannelMeshActionExecution = {
  generatedAt: string;
  channelId: string;
  actionId: ChannelMeshActionKind;
  status: 'applied' | 'manual' | 'noop';
  ok: boolean;
  summary: string;
  details: string[];
  selected: ChannelMeshSnapshotEntry | null;
  snapshot: ChannelMeshSnapshot;
  policyReloadReceipt?: ChannelPolicyReloadReceipt | null;
  loginQr?: ChannelLoginQrSnapshot | null;
};
