import { logger } from '../logger.js';
import {
  GATEWAY_SPINE_CONTRACT_VERSION,
  type GatewaySpineChannel,
  type GatewaySpineCommand,
  type GatewaySpinePlaneProjection,
  type GatewaySpineSessionProjection,
  type GatewaySpineSnapshot,
  type GatewaySpineStatus,
  type GatewaySpineSurfaceProjection,
} from '../contracts/GatewaySpineContract.js';

import type {
GatewayChannelRegistryEntry,
  GatewayChannelRegistryService,
  GatewayChannelRegistrySnapshot,
} from './GatewayChannelRegistryService.js';

type RuntimeSnapshotSource = {
  buildSnapshot?: () => unknown;
};

type GatewaySpineRuntime = {
  now?: () => Date;
  gatewayRuntime?: RuntimeSnapshotSource;
  channelRegistry?: Pick<GatewayChannelRegistryService, 'buildSnapshot'>;
};

export type GatewaySpinePlaneInput = {
  source?: string | null;
  total?: number | null;
  pending?: number | null;
  entries?: unknown[] | null;
  recent?: unknown[] | null;
};

export type GatewaySpineBuildInput = {
  gatewayRuntimeSnapshot?: unknown;
  channelRegistrySnapshot?: GatewayChannelRegistrySnapshot;
  sessions?: Partial<GatewaySpineSessionProjection> & {
    entries?: unknown[] | null;
  };
  approvals?: GatewaySpinePlaneInput | null;
  receipts?: GatewaySpinePlaneInput | null;
  artifacts?: GatewaySpinePlaneInput | null;
  surfaces?: GatewaySpineSurfaceProjection[];
};

const CANONICAL_COMMANDS: GatewaySpineCommand[] = [
  {
    id: 'gateway.status',
    cli: 'zavorth gateway status',
    slash: '/gateway status',
    apiPath: '/api/gateway/spine',
    description: 'Show the canonical Gateway Spine status.',
    surfaceConsistency: ['web', 'cli', 'telegram', 'api'],
  },
  {
    id: 'gateway.sessions',
    cli: 'zavorth gateway sessions',
    slash: '/sessions',
    apiPath: '/api/gateway/spine/sessions',
    description: 'List sessions from the Gateway-owned session projection.',
    surfaceConsistency: ['web', 'cli', 'telegram', 'api'],
  },
  {
    id: 'gateway.channels',
    cli: 'zavorth gateway channels',
    slash: '/channels',
    apiPath: '/api/gateway/spine/channels',
    description: 'List channels from the Channel Mesh registry.',
    surfaceConsistency: ['web', 'cli', 'telegram', 'api'],
  },
  {
    id: 'gateway.approvals',
    cli: 'zavorth gateway approvals',
    slash: '/approvals',
    apiPath: '/api/gateway/spine/approvals',
    description: 'Show pending approvals through the gateway projection.',
    surfaceConsistency: ['web', 'cli', 'telegram', 'api'],
  },
  {
    id: 'gateway.receipts',
    cli: 'zavorth gateway receipts',
    slash: '/receipts',
    apiPath: '/api/gateway/spine/receipts',
    description: 'Show operational receipts attached to the current gateway truth.',
    surfaceConsistency: ['web', 'cli', 'telegram', 'api'],
  },
  {
    id: 'gateway.artifacts',
    cli: 'zavorth gateway artifacts',
    slash: '/artifacts',
    apiPath: '/api/gateway/spine/artifacts',
    description: 'Show artifacts owned by the gateway projection.',
    surfaceConsistency: ['web', 'cli', 'telegram', 'api'],
  },
];

const DEFAULT_SURFACES: GatewaySpineSurfaceProjection[] = [
  {
    surface: 'web',
    stateSource: 'GatewaySpineSnapshot',
    sameSourceOfTruth: true,
    canRenderActions: true,
    fallback: 'Render the same snapshot as cards/tables in ZavorthControl.',
  },
  {
    surface: 'cli',
    stateSource: 'GatewaySpineSnapshot',
    sameSourceOfTruth: true,
    canRenderActions: true,
    fallback: 'Render the same snapshot as compact tables.',
  },
  {
    surface: 'telegram',
    stateSource: 'GatewaySpineSnapshot',
    sameSourceOfTruth: true,
    canRenderActions: true,
    fallback: 'Render the same snapshot with inline buttons when supported.',
  },
  {
    surface: 'api',
    stateSource: 'GatewaySpineSnapshot',
    sameSourceOfTruth: true,
    canRenderActions: true,
    fallback: 'Expose the same snapshot as JSON for adapters.',
  },
];

export class GatewaySpineService {
  private readonly now: () => Date;

  constructor(private readonly runtime: GatewaySpineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: GatewaySpineBuildInput = {}): GatewaySpineSnapshot {
    const generatedAt = this.now().toISOString();
    const runtimeSnapshot = input.gatewayRuntimeSnapshot || readRuntimeSnapshot(this.runtime.gatewayRuntime);
    const channelRegistrySnapshot =
      input.channelRegistrySnapshot || readChannelRegistrySnapshot(this.runtime.channelRegistry);
    const channels = normalizeChannels({ runtimeSnapshot, channelRegistrySnapshot });
    const sessions = normalizeSessions(input.sessions, runtimeSnapshot);
    const approvals = normalizePlane('GatewayApprovalPlane', input.approvals);
    const receipts = normalizePlane('GatewayReceiptPlane', input.receipts);
    const artifacts = normalizePlane('GatewayArtifactPlane', input.artifacts);
    const gatewayRuntime = normalizeGatewayRuntime(runtimeSnapshot);
    const surfaces = input.surfaces && input.surfaces.length > 0 ? input.surfaces : DEFAULT_SURFACES;
    const status = resolveStatus({
      channels: channels.entries,
      approvals,
      receipts,
      artifacts,
      runtimeAttached: gatewayRuntime.attached,
    });
    const invariants = [
      {
        id: 'single-gateway-truth',
        status: 'passed' as const,
        detail: 'Gateway Spine is the canonical source for sessions, channels, commands, approvals, receipts and artifacts.',
      },
      {
        id: 'surface-state-consistency',
        status: surfaces.every((surface) => surface.sameSourceOfTruth) ? 'passed' as const : 'attention' as const,
        detail: 'Web, CLI and channel adapters consume GatewaySpineSnapshot instead of owning separate state.',
      },
      {
        id: 'telegram-not-special',
        status: CANONICAL_COMMANDS.every((command) => command.surfaceConsistency.includes('telegram') && command.surfaceConsistency.includes('cli'))
          ? 'passed' as const
          : 'attention' as const,
        detail: 'Telegram is a first-class renderer, not a privileged command plane.',
      },
    ];

    return {
      contractVersion: GATEWAY_SPINE_CONTRACT_VERSION,
      schemaVersion: 1,
      generatedAt,
      status,
      source: 'gateway-spine',
      spine: {
        singleSourceOfTruth: true,
        ownsSessions: true,
        ownsChannels: true,
        ownsCommands: true,
        ownsApprovals: true,
        ownsReceipts: true,
        ownsArtifacts: true,
      },
      gatewayRuntime,
      channels,
      sessions,
      commands: CANONICAL_COMMANDS,
      approvals,
      receipts,
      artifacts,
      surfaces,
      invariants,
      nextActions: buildNextActions(status),
    };
  }

  public renderText(snapshot: GatewaySpineSnapshot): string {
    const lines = [
      '[gateway-spine]',
      `status=${snapshot.status}`,
      `contract=${snapshot.contractVersion}`,
      `runtime=${snapshot.gatewayRuntime.lifecycleStatus}`,
      `channels=${snapshot.channels.summary.total} ready=${snapshot.channels.summary.ready} partial=${snapshot.channels.summary.partial}`,
      `sessions=${snapshot.sessions.total} active=${snapshot.sessions.active}`,
      `approvals=${snapshot.approvals.pending}/${snapshot.approvals.total}`,
      `receipts=${snapshot.receipts.total}`,
      `artifacts=${snapshot.artifacts.total}`,
      '',
      '[commands]',
      ...snapshot.commands.map((command) => `- ${command.cli} | ${command.slash}`),
      '',
      '[surfaces]',
      ...snapshot.surfaces.map((surface) => `- ${surface.surface}: ${surface.stateSource}`),
      '',
    ];

    return `${lines.join('\n')}\n`;
  }
}

function readRuntimeSnapshot(source?: RuntimeSnapshotSource): unknown {
  try {
    return source && typeof source.buildSnapshot === 'function' ? source.buildSnapshot() : null;
  } catch (error: unknown) {logger.warn('[way Spine] creation failed', error); return null; }
}

function readChannelRegistrySnapshot(
  source?: Pick<GatewayChannelRegistryService, 'buildSnapshot'>,
): GatewayChannelRegistrySnapshot | null {
  try {
    return source && typeof source.buildSnapshot === 'function' ? source.buildSnapshot() : null;
  } catch (error: unknown) {logger.warn('[way Spine] creation failed', error); return null; }
}

function normalizeGatewayRuntime(runtimeSnapshot: unknown): GatewaySpineSnapshot['gatewayRuntime'] {
  const snapshot = asRecord(runtimeSnapshot);
  const lifecycle = asRecord(snapshot.lifecycle);
  return {
    attached: Boolean(runtimeSnapshot),
    lifecycleStatus: text(lifecycle.status, runtimeSnapshot ? 'attached' : 'not-attached'),
    route: text(snapshot.route, 'gateway-runtime'),
  };
}

function normalizeChannels(input: {
  runtimeSnapshot: unknown;
  channelRegistrySnapshot?: GatewayChannelRegistrySnapshot | null;
}): GatewaySpineSnapshot['channels'] {
  const registryChannels = input.channelRegistrySnapshot?.channels || [];
  const runtimeChannels = readRuntimeChannels(input.runtimeSnapshot);
  const entries = (registryChannels.length > 0 ? registryChannels.map(fromRegistryChannel) : runtimeChannels);
  const summary = {
    total: entries.length,
    ready: entries.filter((entry) => entry.readiness === 'ready').length,
    partial: entries.filter((entry) => entry.readiness === 'partial').length,
    planned: entries.filter((entry) => entry.readiness === 'planned').length,
    disabled: entries.filter((entry) => entry.readiness === 'disabled').length,
    unknown: entries.filter((entry) => entry.readiness === 'unknown').length,
  };
  return { summary, entries };
}

function fromRegistryChannel(entry: GatewayChannelRegistryEntry): GatewaySpineChannel {
  return {
    id: text(entry.id, 'unknown'),
    label: text(entry.label, entry.id),
    readiness: entry.readiness,
    configured: Boolean(entry.configured),
    transport: text(entry.transport, 'unknown'),
    notes: Array.isArray(entry.notes) ? entry.notes.map((note) => text(note, '')).filter(Boolean) : [],
    features: normalizeFeatureMap(entry.features),
    source: 'GatewayChannelRegistryService',
  };
}

function readRuntimeChannels(runtimeSnapshot: unknown): GatewaySpineChannel[] {
  const snapshot = asRecord(runtimeSnapshot);
  const channels = Array.isArray(snapshot.channels) ? snapshot.channels : [];
  return channels.map((raw) => {
    const entry = asRecord(raw);
    return {
      id: text(entry.id, 'unknown'),
      label: text(entry.name ?? entry.label, text(entry.id, 'unknown')),
      readiness: 'unknown',
      configured: true,
      transport: text(entry.transport, 'runtime'),
      notes: [],
      features: {},
      source: 'GatewayRuntimeSnapshot',
    };
  });
}

function normalizeSessions(
  input: GatewaySpineBuildInput['sessions'],
  runtimeSnapshot: unknown,
): GatewaySpineSessionProjection {
  const records = Array.isArray(input?.recent)
    ? input?.recent
    : Array.isArray(input?.entries)
      ? input?.entries
      : readRuntimeSessions(runtimeSnapshot);
  const recent = records.slice(0, 10).map((raw) => {
    const entry = asRecord(raw);
    return {
      sessionId: text(entry.sessionId ?? entry.id, 'unknown'),
      platform: text(entry.platform ?? entry.surface, 'unknown'),
      label: text(entry.label ?? entry.title, text(entry.sessionId ?? entry.id, 'session')),
      updatedAt: nullableText(entry.updatedAt ?? entry.lastSeenAt ?? entry.createdAt),
    };
  });

  return {
    status: input?.status || (recent.length > 0 ? 'attached' : 'projected'),
    source: input?.source || 'GatewayRuntimeSnapshot',
    total: number(input?.total, recent.length),
    active: number(input?.active, recent.length > 0 ? recent.length : 0),
    pinned: number(input?.pinned, 0),
    recent,
  };
}

function readRuntimeSessions(runtimeSnapshot: unknown): unknown[] {
  const snapshot = asRecord(runtimeSnapshot);
  if (Array.isArray(snapshot.sessions)) return snapshot.sessions;
  const sessions = asRecord(snapshot.sessionStore);
  if (Array.isArray(sessions.entries)) return sessions.entries;
  return [];
}

function normalizePlane(defaultSource: string, input?: GatewaySpinePlaneInput | null): GatewaySpinePlaneProjection {
  const records = Array.isArray(input?.recent)
    ? input?.recent || []
    : Array.isArray(input?.entries)
      ? input?.entries || []
      : [];
  const recent = records.slice(0, 10).map((raw) => {
    const entry = asRecord(raw);
    return {
      id: text(entry.id ?? entry.approval_id ?? entry.receiptId ?? entry.key, 'unknown'),
      label: text(entry.label ?? entry.kind ?? entry.reason ?? entry.name, 'entry'),
      status: text(entry.status ?? entry.readiness ?? entry.result, 'unknown'),
      createdAt: nullableText(entry.createdAt ?? entry.created_at ?? entry.generatedAt),
    };
  });
  const pending = number(
    input?.pending,
    recent.filter((entry) => entry.status === 'pending' || entry.status === 'needs_approval').length,
  );
  const total = number(input?.total, recent.length);

  return {
    status: total > 0 || pending > 0 ? 'attached' : 'projected',
    source: text(input?.source, defaultSource),
    total,
    pending,
    recent,
  };
}

function resolveStatus(input: {
  channels: GatewaySpineChannel[];
  approvals: GatewaySpinePlaneProjection;
  receipts: GatewaySpinePlaneProjection;
  artifacts: GatewaySpinePlaneProjection;
  runtimeAttached: boolean;
}): GatewaySpineStatus {
  if (input.channels.length === 0) return 'blocked';
  if (!input.runtimeAttached) return 'partial';
  if (input.channels.some((channel) => channel.readiness === 'ready')) return 'ready';
  return 'attention';
}

function buildNextActions(status: GatewaySpineStatus): string[] {
  if (status === 'ready') {
    return [
      'Render this snapshot in ZavorthControl after visual approval.',
      'Use the same commands in CLI and channel adapters.',
    ];
  }
  if (status === 'blocked') {
    return ['Attach GatewayRuntime or GatewayChannelRegistryService before exposing channel operations.'];
  }
  return ['Run zavorth gateway status and inspect channel readiness before enabling live actions.'];
}

function normalizeFeatureMap(input: unknown): Record<string, boolean> {
  const record = asRecord(input);
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, Boolean(value)]));
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function text(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim();
  return raw || fallback;
}

function nullableText(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return raw || null;
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
