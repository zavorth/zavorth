import type { RuntimeAccessManifestService } from '../../runtime/access/RuntimeAccessManifestService.js';
import type { ChannelMeshSnapshot } from '../../contracts/ChannelMeshContract.js';
import type { NodeMeshSnapshot } from '../../contracts/NodeMeshContract.js';
import type { ZavorthRemoteTransportSnapshot, ZavorthRemoteTransportService } from '../ZavorthRemoteTransportService.js';
import type { RuntimeAccessManifest } from '../../domain/gateway/infrastructure/runtime-access/RuntimeAccessManifestService.js';
import type { ZavorthChannelMeshService } from '../ZavorthChannelMeshService.js';
import type { ZavorthNodeMeshService } from '../ZavorthNodeMeshService.js';

export type { ChannelMeshSnapshot, NodeMeshSnapshot, ZavorthRemoteTransportSnapshot, RuntimeAccessManifest };

export type ZavorthDistributedRuntimePosture = 'healthy' | 'attention' | 'critical';
export type ZavorthDistributedRuntimeActionSeverity = 'info' | 'warn' | 'critical';

export type AsyncSnapshotLike = {
  buildSnapshot: (input?: Record<string, unknown>) => unknown | Promise<unknown>;
};

export type RuntimeAccessManifestLike = Pick<RuntimeAccessManifestService, 'buildManifest'>;

export type DistributedRuntimeDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  channelMeshService?: Pick<ZavorthChannelMeshService, 'buildSnapshot'> | null;
  nodeMeshService?: Pick<ZavorthNodeMeshService, 'buildSnapshot'> | null;
  remoteTransportService?: Pick<ZavorthRemoteTransportService, 'buildSnapshot'> | null;
  runtimeAccessManifestService?: RuntimeAccessManifestLike | null;
};

export type ZavorthDistributedRuntimeCard = {
  id: 'channels' | 'fleet' | 'transports' | 'surfaces';
  label: string;
  posture: ZavorthDistributedRuntimePosture;
  summary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthDistributedRuntimeFocus = {
  kind: 'channel' | 'node' | 'transport' | 'surface' | null;
  id: string | null;
  label: string | null;
  summary: string | null;
  nextAction: string | null;
};

export type ZavorthDistributedRuntimeCapabilityCoverage = {
  id: string;
  label: string;
  category: string;
  risky: boolean;
  supportedNodes: number;
  actionHint: string | null;
};

export type ZavorthDistributedRuntimeSurfaceEntry = {
  id: string;
  label: string;
  primary: boolean;
  ready: boolean;
  surface: string;
  entry: string;
  remoteEntry: string | null;
  description: string;
};

export type ZavorthDistributedRuntimeSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  selectedId: string | null;
  query: string | null;
  focus: ZavorthDistributedRuntimeFocus;
  summary: {
    posture: ZavorthDistributedRuntimePosture;
    totalChannels: number;
    readyChannels: number;
    advancedChannels: number;
    readyAdvancedChannels: number;
    channelsWithAttachments: number;
    channelsWithThreads: number;
    totalNodes: number;
    pairedNodes: number;
    onlineNodes: number;
    queuedInvocations: number;
    staleQueued: number;
    maintenanceNodes: number;
    advancedCapabilityCoverage: number;
    advancedCapabilityTargets: number;
    totalTransports: number;
    readyTransports: number;
    liveTransports: number;
    transportAttention: number;
    totalSurfaces: number;
    readySurfaces: number;
    primarySurfaceReady: boolean;
    remoteReady: boolean;
    warnings: number;
    implementationReady: boolean;
    infrastructureState: 'mesh_online' | 'offline' | 'dormant';
    infrastructureOfflineReason: string | null;
  };
  cards: ZavorthDistributedRuntimeCard[];
  actions: Array<{
    id: string;
    label: string;
    severity: ZavorthDistributedRuntimeActionSeverity;
    command: string | null;
    reason: string;
  }>;
  advancedChannels: ChannelMeshSnapshot['entries'];
  fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[];
  surfaces: ZavorthDistributedRuntimeSurfaceEntry[];
  sourceSnapshots: {
    channels: ChannelMeshSnapshot;
    nodes: NodeMeshSnapshot;
    transports: ZavorthRemoteTransportSnapshot;
    manifest: RuntimeAccessManifest;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export const ADVANCED_CHANNEL_IDS = new Set(['slack', 'whatsapp', 'signal', 'imessage', 'teams', 'email']);

export const ADVANCED_CHANNEL_PRIORITY: Record<string, number> = {
  slack: 0,
  whatsapp: 1,
  signal: 2,
  teams: 3,
  email: 4,
  imessage: 5,
};

export const ADVANCED_CAPABILITY_IDS = [
  'browser.proxy',
  'files.watch',
  'clipboard.read',
  'clipboard.write',
  'notifications.send',
  'screen.capture',
  'camera.capture',
  'location.read',
] as const;

