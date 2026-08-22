export function scanZavorthControlSnapshotForSourceIdentityLeaks(
  value: unknown,
  terms: string[] = [],
): { checked: boolean; passed: boolean; leakCount: number; leaks: Array<{ path: string; value: string; term: string }> } {
  const cleanTerms = terms.map((term) => String(term ?? '').trim()).filter(Boolean);
  const leaks: Array<{ path: string; value: string; term: string }> = [];

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      cleanTerms.forEach((term) => {
        if (node.includes(term)) {
          leaks.push({ path, value: node, term });
        }
      });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      Object.entries(node as Record<string, unknown>).forEach(([key, entry]) => visit(entry, `${path}.${key}`));
    }
  };

  visit(value, '$');
  return {
    checked: true,
    passed: leaks.length === 0,
    leakCount: leaks.length,
    leaks,
  };
}

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function array<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeStatus(value: unknown): string {
  const status = text(value, 'unknown');
  if (status === 'available') return 'available';
  if (status === 'degraded') return 'degraded';
  if (status === 'blocked') return 'blocked';
  if (status === 'ready') return 'ready';
  return status;
}

function toChannelStatus(value: unknown): string {
  const status = text(value, 'unknown');
  return status === 'available' ? 'ready' : status;
}

function capabilityStatus(item: AnyRecord): string {
  if (item.policy?.exposure === 'blocked') return 'blocked';
  if (item.requiresApproval === true) return 'degraded';
  if (item.status === 'available') return 'available';
  return normalizeStatus(item.status);
}

function prefixed(prefix: string, value: unknown, fallback: string): string {
  const id = text(value, fallback);
  return id.startsWith(`${prefix}:`) ? id : `${prefix}:${id}`;
}

export function buildZavorthControlAssimilationSnapshot(input: {
  projection: AnyRecord;
  capabilityInventory?: AnyRecord | null;
  channelHealth?: AnyRecord | null;
  deliveryReceipts?: AnyRecord[];
  sessionReadModels?: AnyRecord[];
  identityLeakTerms?: string[];
  now?: () => Date;
}): AnyRecord {
  const now = input.now || (() => new Date());
  const projection = record(input.projection);
  const sessionReadModels = array<AnyRecord>(input.sessionReadModels);
  const deliveryReceipts = array<AnyRecord>(input.deliveryReceipts);
  const capabilityInventory = record(input.capabilityInventory);
  const channelHealth = record(input.channelHealth);
  const activeSessionId = sessionReadModels[0]?.id || projection.activeSessionId || projection.effectiveSessionId || null;
  const artifacts = [
    ...array(projection.artifacts),
    ...sessionReadModels.flatMap((session) => session.handoff?.artifact ? [session.handoff.artifact] : []),
  ];
  const memorySignals = [
    ...array(projection.memorySignals),
    ...sessionReadModels.flatMap((session) => array(session.memorySignals)),
  ];
  const projectedTimelines = sessionReadModels.length > 0
    ? sessionReadModels.map((session) => ({
      id: session.id,
      status: 'active',
      title: session.title,
      replayId: session.replay?.id,
      handoffId: session.handoff?.id,
      entries: array(session.entries).map((entry) => ({
        id: entry.id,
        role: entry.role,
        text: entry.text,
        createdAt: entry.createdAt,
      })),
    }))
    : array<AnyRecord>(projection.sessions).map((session) => ({
      id: session.id || session.sessionId,
      status: session.status || 'active',
      title: session.title,
      entries: array(projection.messages).filter((message) => (
        !message.sessionId || message.sessionId === session.id || message.sessionId === session.sessionId
      )),
    }));
  const snapshot: AnyRecord = {
    contractVersion: 'zavorth-control-assimilation/v1',
    generatedAt: now().toISOString(),
    runtime: {
      id: 'zavorth-control-runtime',
      status: projection.runtimeStatus || 'ready',
      transportStatus: projection.wsStatus === 'disconnected' ? 'disconnected' : 'connected',
      activeSessionId,
      viewModelSource: 'zavorth-control-projection',
    },
    uiState: {
      empty: false,
      loading: false,
      offline: false,
      degraded: projection.runtimeStatus === 'degraded',
      error: null,
    },
    sessionTimelines: projectedTimelines,
    channelActivity: array<AnyRecord>(channelHealth.channels).map((channel) => {
      const directReceipts = deliveryReceipts.filter((receipt) => receipt.channelId === channel.id);
      const receipts = directReceipts.length > 0 ? directReceipts : deliveryReceipts;
      return {
        id: channel.id,
        status: toChannelStatus(channel.status),
        outbound: channel.outbound,
        deliveryCount: receipts.length,
        latestDeliveryStatus: receipts.at(-1)?.status || 'none',
      };
    }),
    capabilities: array<AnyRecord>(capabilityInventory.items).map((item) => ({
      id: prefixed('external-capability', item.id, 'capability'),
      kind: item.kind,
      label: item.label,
      status: capabilityStatus(item),
      requiresApproval: item.requiresApproval,
    })),
    artifacts,
    memorySignals,
    workflows: [
      { id: 'sessions.resume', enabled: true, status: 'ready' },
      { id: 'channels.review', enabled: true, status: 'ready' },
      { id: 'capabilities.review', enabled: true, status: capabilityInventory.summary?.blocked ? 'attention' : 'ready' },
    ],
  };
  const scan = scanZavorthControlSnapshotForSourceIdentityLeaks(snapshot, input.identityLeakTerms || []);
  snapshot.identityLeakScan = {
    checked: scan.checked,
    passed: scan.passed,
    leakCount: scan.leakCount,
  };
  return snapshot;
}

export class ZavorthControlRealtimeStore {
  private snapshot: AnyRecord;
  private readonly now: () => Date;
  private readonly identityLeakTerms: string[];

  constructor(options: { now?: () => Date; identityLeakTerms?: string[] } = {}) {
    this.now = options.now || (() => new Date());
    this.identityLeakTerms = options.identityLeakTerms || [];
    this.snapshot = this.emptySnapshot();
  }

  public getSnapshot(): AnyRecord {
    return this.snapshot;
  }

  public apply(event: AnyRecord): AnyRecord {
    if (event.type === 'projection.snapshot') {
      this.snapshot = buildZavorthControlAssimilationSnapshot({
        projection: event.projection,
        identityLeakTerms: this.identityLeakTerms,
        now: this.now,
      });
      return this.snapshot;
    }
    if (event.type === 'transport.reconnecting') {
      this.snapshot = this.withRuntime('degraded', 'reconnecting', { degraded: true, offline: false, error: null });
      return this.snapshot;
    }
    if (event.type === 'transport.connected') {
      this.snapshot = this.withRuntime('ready', 'connected', { degraded: false, offline: false, error: null });
      return this.snapshot;
    }
    if (event.type === 'transport.disconnected') {
      this.snapshot = this.withRuntime('offline', 'disconnected', { degraded: false, offline: true, error: null });
      return this.snapshot;
    }
    if (event.type === 'runtime.failure') {
      this.snapshot = this.withRuntime('blocked', 'connected', {
        degraded: false,
        offline: false,
        error: text(event.error, 'runtime failure'),
      });
      return this.snapshot;
    }
    if (event.type === 'reset.empty') {
      this.snapshot = this.emptySnapshot();
      return this.snapshot;
    }
    return this.snapshot;
  }

  private emptySnapshot(): AnyRecord {
    const snapshot = {
      contractVersion: 'zavorth-control-assimilation/v1',
      generatedAt: this.now().toISOString(),
      runtime: {
        id: 'zavorth-control-runtime',
        status: 'idle',
        transportStatus: 'connected',
        activeSessionId: null,
        viewModelSource: 'zavorth-control-projection',
      },
      uiState: {
        empty: true,
        loading: false,
        offline: false,
        degraded: false,
        error: null,
      },
      sessionTimelines: [],
      channelActivity: [],
      capabilities: [],
      artifacts: [],
      memorySignals: [],
      workflows: [],
      identityLeakScan: {
        checked: true,
        passed: true,
        leakCount: 0,
      },
    };
    return snapshot;
  }

  private withRuntime(status: string, transportStatus: string, uiState: Partial<AnyRecord>): AnyRecord {
    const next: AnyRecord = {
      ...this.snapshot,
      runtime: {
        ...this.snapshot.runtime,
        status,
        transportStatus,
      },
      uiState: {
        ...this.snapshot.uiState,
        ...uiState,
      },
    };
    next.identityLeakScan = {
      checked: true,
      passed: scanZavorthControlSnapshotForSourceIdentityLeaks(next, this.identityLeakTerms).passed,
      leakCount: scanZavorthControlSnapshotForSourceIdentityLeaks(next, this.identityLeakTerms).leakCount,
    };
    this.snapshot = next;
    return next;
  }
}
