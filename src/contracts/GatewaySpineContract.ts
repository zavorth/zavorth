import type { PlatformReadiness } from './PlatformContract.js';

export const GATEWAY_SPINE_CONTRACT_VERSION = '2026-05-13.phase-1' as const;

export type GatewaySpineSurface =
  | 'web'
  | 'cli'
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'signal'
  | 'imessage'
  | 'api'
  | 'runtime';

export type GatewaySpineStatus = 'ready' | 'partial' | 'attention' | 'blocked';

export type GatewaySpinePlaneStatus = 'attached' | 'empty' | 'projected';

export type GatewaySpineCommandId =
  | 'gateway.status'
  | 'gateway.sessions'
  | 'gateway.channels'
  | 'gateway.approvals'
  | 'gateway.receipts'
  | 'gateway.artifacts';

export type GatewaySpineCommand = {
  id: GatewaySpineCommandId;
  cli: string;
  slash: string;
  apiPath: string;
  description: string;
  surfaceParity: GatewaySpineSurface[];
};

export type GatewaySpineChannel = {
  id: string;
  label: string;
  readiness: PlatformReadiness | 'unknown';
  configured: boolean;
  transport: string;
  notes: string[];
  features: Record<string, boolean>;
  source: 'GatewayChannelRegistryService' | 'GatewayRuntimeSnapshot' | 'manual';
};

export type GatewaySpineSessionProjection = {
  status: GatewaySpinePlaneStatus;
  source: 'GatewayRuntimeSnapshot' | 'GatewaySessionReadModelService' | 'provided';
  total: number;
  active: number;
  pinned: number;
  recent: Array<{
    sessionId: string;
    platform: string;
    label: string;
    updatedAt: string | null;
  }>;
};

export type GatewaySpinePlaneProjection = {
  status: GatewaySpinePlaneStatus;
  source: string;
  total: number;
  pending: number;
  recent: Array<{
    id: string;
    label: string;
    status: string;
    createdAt: string | null;
  }>;
};

export type GatewaySpineSurfaceProjection = {
  surface: GatewaySpineSurface;
  stateSource: 'GatewaySpineSnapshot';
  sameSourceOfTruth: true;
  canRenderActions: boolean;
  fallback: string;
};

export type GatewaySpineSnapshot = {
  contractVersion: typeof GATEWAY_SPINE_CONTRACT_VERSION;
  schemaVersion: 1;
  generatedAt: string;
  status: GatewaySpineStatus;
  source: 'gateway-spine';
  spine: {
    singleSourceOfTruth: true;
    ownsSessions: true;
    ownsChannels: true;
    ownsCommands: true;
    ownsApprovals: true;
    ownsReceipts: true;
    ownsArtifacts: true;
  };
  gatewayRuntime: {
    attached: boolean;
    lifecycleStatus: string;
    route: string;
  };
  channels: {
    summary: {
      total: number;
      ready: number;
      partial: number;
      planned: number;
      disabled: number;
      unknown: number;
    };
    entries: GatewaySpineChannel[];
  };
  sessions: GatewaySpineSessionProjection;
  commands: GatewaySpineCommand[];
  approvals: GatewaySpinePlaneProjection;
  receipts: GatewaySpinePlaneProjection;
  artifacts: GatewaySpinePlaneProjection;
  surfaces: GatewaySpineSurfaceProjection[];
  invariants: Array<{
    id: string;
    status: 'passed' | 'attention';
    detail: string;
  }>;
  nextActions: string[];
};
