export type ChannelMode = 'native' | 'bridge' | 'unknown' | 'stub' | 'cloud-api' | 'baileys' | 'signal-cli' | 'mac-bridge' | 'graph-bot' | 'smtp-imap';
export type TransportMode = 'native' | 'local' | 'stub' | 'bridge' | 'webhook' | 'remote';
export type DoctorStatus = 'passed' | 'failed' | 'running' | 'skipped' | 'missing';
export type TriggerSource = 'automation' | 'manual' | 'priority';
export type SecuritySource = 'env' | 'runtime-file' | 'missing';
export type LeaseStatus = 'active' | 'expired' | 'closed' | 'missing';

export interface DiscordBridgeSnapshot {
  mode: ChannelMode;
  enabled: boolean;
  started: boolean;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  pendingInbox: number;
  pendingOutbox: number;
  lastError: string | null;
  updatedAt: string | null;
}

export interface WhatsAppChannelSnapshot {
  mode: 'stub' | 'cloud-api' | 'baileys' | ChannelMode;
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedChatIds: string[];
  provider: 'cloud-api' | 'baileys' | 'stub';
  providerConfigured: boolean;
  providerDecision: string;
  sessionDir: string | null;
  sessionDirConfigured: boolean;
  phoneNumberId: string | null;
  webhookConfigured: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export interface SlackChannelSnapshot {
  mode: 'native' | 'stub' | ChannelMode;
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedChannelIds: string[];
  transport: TransportMode;
  nativeConfigured: boolean;
  apiBaseUrl: string | null;
  workspaceId: string | null;
  workspaceConfigured: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export interface PlannedChannelSnapshot {
  mode: ChannelMode;
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedRecipients: string[];
  providerConfigured: boolean;
  transport: TransportMode;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
  platform: string | null;
  readOnly: boolean;
  accountNumber: string | null;
  bridgeTarget: string | null;
  tenantId: string | null;
  appId: string | null;
  smtpConfigured: boolean;
  imapConfigured: boolean;
  webhookConfigured: boolean;
}

export interface ChannelsSnapshot {
  discordBridge: DiscordBridgeSnapshot;
  whatsapp: WhatsAppChannelSnapshot;
  slack: SlackChannelSnapshot;
  signal: PlannedChannelSnapshot;
  imessage: PlannedChannelSnapshot;
  teams: PlannedChannelSnapshot;
  email: PlannedChannelSnapshot;
}

export interface NodeMeshSmokeSnapshot {
  available: boolean;
  status: DoctorStatus;
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  nodeId: string | null;
  finalNodeStatus: string | null;
  recentCapabilityId: string | null;
  error: string | null;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  recommendedAction: string | null;
}

export interface DoctorItem {
  channelId: string;
  mode: ChannelMode;
  status: 'passed' | 'failed' | 'skipped';
  configured: boolean;
  summary: string;
  error: string | null;
}

export interface ChannelProviderDoctorSnapshot {
  available: boolean;
  status: DoctorStatus;
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  recommendedAction: string | null;
  items: DoctorItem[];
}

export interface TransportDoctorItem {
  transportId: string;
  mode: TransportMode;
  status: 'passed' | 'failed' | 'running' | 'skipped';
  configured: boolean;
  summary: string;
  error: string | null;
}

export interface RemoteTransportDoctorSnapshot {
  available: boolean;
  status: DoctorStatus;
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  recommendedAction: string | null;
  items: TransportDoctorItem[];
}

export interface MaintenanceSnapshot {
  available: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  stepCount: number;
  completedSteps: number;
  dryRun: boolean;
  withSoak: boolean;
  withPublish: boolean;
}

export interface HotspotEntry {
  id: string;
  label: string;
  path: string;
  bytes: number;
}

export interface StorageSnapshot {
  rootPath: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freePercent: number;
  hotspots: HotspotEntry[];
}

export interface MappedLog {
  timestamp: string | null;
  level: string;
  category: string;
  message: string;
}

export interface RecentErrorsSnapshot {
  lastError: MappedLog | null;
  recent: MappedLog[];
}

export interface SecurityCheckSnapshot {
  available: boolean;
  generatedAt: string | null;
  ok: boolean | null;
  summary: string | null;
}

export interface SecuritySnapshot {
  zavorthControlAuth: {
    enabled: boolean;
    source: SecuritySource;
    tokenFile: string;
    tokenFileExists: boolean;
    note: string;
  };
  mailboxSecret: {
    source: SecuritySource;
    filePath: string;
    fileExists: boolean;
  };
  dbEncryption: {
    enabled: boolean;
    source: SecuritySource;
    filePath: string;
    fileExists: boolean;
  };
  hostIdentity: {
    filePath: string;
    exists: boolean;
  };
  lastAudit: SecurityCheckSnapshot & {
    trailAvailable: boolean;
    trailDir: string;
    eventsFile: string;
    ledgerFile: string;
    totalEvents: number;
    latestEventId: string | null;
    latestEventType: string | null;
    latestTaskId: string | null;
    latestTimestamp: string | null;
    latestChainHash: string | null;
    recentChain: unknown[];
  };
  lastPreflight: SecurityCheckSnapshot;
  needsAttention: boolean;
}

export interface PublishHistoryEntry {
  publishedAt: string | null;
  branch: string | null;
  commit: string | null;
  docsUrl: string | null;
  remoteConsoleUrl: string | null;
  archiveId: string | null;
  sourceArchiveId: string | null;
}

export interface PublishSnapshot {
  available: boolean;
  publishedAt: string | null;
  branch: string | null;
  commit: string | null;
  sourceArchiveId: string | null;
  docsUrl: string | null;
  remoteConsoleUrl: string | null;
  gitPush: string | null;
  smokeTest: string | null;
  history: PublishHistoryEntry[];
}

export interface MaintenanceAutomationSnapshot {
  enabled: boolean;
  running: boolean;
  lastTriggeredAt: string | null;
  lastTriggerSource: TriggerSource | null;
  lastPriorityReason: string | null;
  nextPlannedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  note: string | null;
  lastActionId: string | null;
  lastActionLogFile: string | null;
  lastReportFinishedAt: string | null;
  lastReportStepCount: number;
}

export interface ZavorthBridgeMobileAccessSnapshot {
  available: boolean;
  status: LeaseStatus;
  checkedAt: string | null;
  leaseId: string | null;
  mode: string;
  accessUrl: string | null;
  expiresAt: string | null;
  remainingMs: number | null;
  requiresPassword: boolean;
  startedSidecar: boolean;
  activatedRemoteMode: boolean;
  summary: string;
  recommendedAction: string;
}
