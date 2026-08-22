import fs from 'fs';
import { config } from '../config/index.js';
import { buildCapabilityManifests } from './capability-lifecycle/CapabilityLifecycleManifests.js';
import type { ZavorthProfile } from '../config/configHelpers.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import { SidecarStatusService, type SidecarStatusCard } from './SidecarStatusService.js';
import { logger } from '../logger.js';

type BridgeMode = 'bridge' | 'native' | 'unknown';

type DiscordBridgeSnapshot = {
  mode: BridgeMode;
  enabled: boolean;
  started: boolean;
  pendingInbox: number;
  pendingOutbox: number;
  lastError: string | null;
  updatedAt: string | null;
};

type SidecarStatusLike = Pick<SidecarStatusService, 'readSummary'>;
type NodeMeshLike = Pick<ZavorthNodeMeshService, 'buildSnapshot'>;

type ZavorthRemoteTransportRuntime = {
  now?: () => Date;
  sidecarStatusService?: SidecarStatusLike;
  nodeMeshService?: NodeMeshLike;
  bridgeStatusFilePath?: string;
  capabilityLifecycleStateFile?: string;
  discordRequiredOnBoot?: boolean;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export type ZavorthRemoteTransportReadiness = 'ready' | 'partial' | 'planned' | 'disabled';

export type ZavorthRemoteTransportTelemetry = {
  updatedAt: string | null;
  pendingWork: number;
  lastError: string | null;
  statusLine: string;
};

type CapabilityLifecycleHint = {
  dormant: boolean;
  notes: string | null;
};

const capabilityManifestMap = new Map(
  buildCapabilityManifests().map((manifest) => [manifest.id, manifest]),
);

export type ZavorthRemoteTransportEntry = {
  id: string;
  label: string;
  kind: 'bridge' | 'sidecar' | 'node-host';
  transport: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  readiness: ZavorthRemoteTransportReadiness;
  available: boolean;
  endpoint: string | null;
  operatorSummary: string;
  actionHint: string | null;
  telemetry: ZavorthRemoteTransportTelemetry;
  details: string[];
  actions: Array<{
    id: string;
    label: string;
    command: string;
    kind: 'inspect' | 'prepare' | 'smoke' | 'repair';
  }>;
};

export type ZavorthRemoteTransportSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
    live: number;
    reachable: number;
    attentionRequired: number;
    pendingWork: number;
  };
  entries: ZavorthRemoteTransportEntry[];
  selected: ZavorthRemoteTransportEntry | null;
  suggestedActions: Array<{
    id: string;
    label: string;
    command: string;
    severity: 'info' | 'warn';
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthRemoteTransportService {
  private readonly now: () => Date;
  private readonly sidecars: SidecarStatusLike;
  private readonly nodeMesh: NodeMeshLike;
  private readonly bridgeStatusFilePath: string;
  private readonly capabilityLifecycleStateFile: string;
  private readonly discordRequiredOnBoot: boolean;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: ZavorthRemoteTransportRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sidecars = runtime.sidecarStatusService || new SidecarStatusService();
    this.nodeMesh = runtime.nodeMeshService || new ZavorthNodeMeshService();
    this.bridgeStatusFilePath = runtime.bridgeStatusFilePath || config.discordBridgeStatusFile;
    this.capabilityLifecycleStateFile = runtime.capabilityLifecycleStateFile || config.capabilityLifecycleStateFile;
    this.discordRequiredOnBoot = runtime.discordRequiredOnBoot ?? config.discordRequiredOnBoot;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public buildSnapshot(input: { selectedId?: string | null } = {}): ZavorthRemoteTransportSnapshot {
    const sidecars = this.sidecars.readSummary();
    const nodeMesh = this.nodeMesh.buildSnapshot();
    const entries: ZavorthRemoteTransportEntry[] = [
      this.buildDiscordTransportEntry(),
      this.buildSidecarEntry(sidecars.AIGateway),
      this.buildSidecarEntry(sidecars.ZavorthTerminal),
      this.buildNodeHostEntry(nodeMesh),
    ];
    const selected = this.selectEntry(entries, input.selectedId);
    const summary = {
      total: entries.length,
      ready: entries.filter((entry) => entry.readiness === 'ready').length,
      partial: entries.filter((entry) => entry.readiness === 'partial').length,
      planned: entries.filter((entry) => entry.readiness === 'planned').length,
      disabled: entries.filter((entry) => entry.readiness === 'disabled').length,
      live: entries.filter((entry) => entry.available).length,
      reachable: entries.filter((entry) => entry.available && entry.endpoint).length,
      attentionRequired: entries.filter((entry) =>
        entry.readiness === 'partial'
        || Boolean(entry.telemetry.lastError)
        || entry.telemetry.pendingWork > 0,
      ).length,
      pendingWork: entries.reduce((total, entry) => total + entry.telemetry.pendingWork, 0),
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      entries,
      selected,
      suggestedActions: this.buildSuggestedActions(entries, nodeMesh),
      narrative: {
        headline: `Zavorth exposes ${summary.total} remote transport(s) in the current plan.`,
        operatorSummary: `${summary.ready} ready, ${summary.partial} preparing, ${summary.attentionRequired} requiring attention and ${summary.pendingWork} pending item(s) in the remote plane.`,
      },
    };
  }

  private buildDiscordTransportEntry(): ZavorthRemoteTransportEntry {
    const bridge = this.readDiscordBridgeSnapshot();
    const lifecycle = this.readCapabilityLifecycleHint('discord');
    const transport = bridge.mode === 'native'
      ? 'discord-native-gateway'
      : bridge.mode === 'bridge'
        ? 'discord-file-bridge'
        : 'discord-transport';
    const dormant = bridge.mode === 'native' && lifecycle.dormant && !this.discordRequiredOnBoot && !bridge.started;
    const readiness: ZavorthRemoteTransportReadiness = bridge.started
      ? 'ready'
      : dormant
        ? 'disabled'
        : bridge.enabled
        ? 'partial'
        : 'disabled';

    return {
      id: 'discord-transport',
      label: 'Discord transport',
      kind: 'bridge',
      transport,
      direction: 'bidirectional',
      readiness,
      available: bridge.started,
      endpoint: null,
      operatorSummary: bridge.started
        ? (bridge.mode === 'native'
            ? 'Native Discord is ready for Gateway input and output.'
            : 'Discord bridge ready to sync inbox and outbox.')
        : dormant
          ? 'Discord is configured, but dormant in the current profile to keep the core lightweight.'
        : bridge.enabled
          ? 'Discord is configured, but the bridge has not confirmed readiness yet.'
          : 'Discord transport is not enabled in this runtime yet.',
      actionHint: bridge.started ? '/channels discord' : dormant ? '/enable discord' : '/status',
      telemetry: {
        updatedAt: bridge.updatedAt,
        pendingWork: bridge.pendingInbox + bridge.pendingOutbox,
        lastError: bridge.lastError,
        statusLine: bridge.started
          ? 'Bridge visible in the remote plane.'
          : dormant
            ? 'Bridge dormant per the current profile lifecycle.'
          : (bridge.enabled ? 'Bridge waiting for readiness.' : 'Bridge disabled.'),
      },
      details: [
        `Mode: ${bridge.mode}.`,
        `Pending inbox: ${bridge.pendingInbox}.`,
        `Pending outbox: ${bridge.pendingOutbox}.`,
        bridge.updatedAt ? `Updated at: ${bridge.updatedAt}.` : 'No recent bridge snapshot.',
        dormant
          ? (lifecycle.notes || 'Lifecycle marked Discord as dormant in this profile.')
          : 'Discord lifecycle has no additional observation.',
        bridge.lastError ? `Last error: ${bridge.lastError}` : 'No recent bridge error.',
      ],
      actions: this.buildActions('discord-transport', readiness, {
        pendingWork: bridge.pendingInbox + bridge.pendingOutbox,
        hasError: Boolean(bridge.lastError),
      }),
    };
  }

  private buildSidecarEntry(card: SidecarStatusCard): ZavorthRemoteTransportEntry {
    const lifecycle = card.id === 'AIGateway'
      ? this.readCapabilityLifecycleHint('remote')
      : card.id === 'zavorth-terminal'
        ? this.readCapabilityLifecycleHint('zavorth-bridge-remote', ['remote'])
        : { dormant: false, notes: null };
    const dormant = lifecycle.dormant
      && !card.ready
      && (card.id === 'AIGateway' || !card.running);
    const readiness: ZavorthRemoteTransportReadiness = card.ready
      ? 'ready'
      : dormant
        ? 'disabled'
      : card.enabled
        ? 'partial'
        : 'disabled';
    const advertisedEndpoint = card.baseUrl || card.localUrl || null;
    const probeEndpoint = this.buildSidecarProbeEndpoint(card);

    return {
      id: card.id,
      label: card.name,
      kind: 'sidecar',
      transport: 'http-sidecar',
      direction: 'bidirectional',
      readiness,
      available: card.ready,
      endpoint: probeEndpoint,
      operatorSummary: card.ready
        ? `${card.name} ready to expand Zavorth remote routing.`
        : dormant
          ? `${card.name} is dormant in the current profile to keep the core lightweight.`
        : card.enabled
          ? `${card.name} exists locally, but has not confirmed healthy readiness yet.`
          : `${card.name} is disabled on this host.`,
      actionHint: card.id === 'AIGateway'
        ? '/connect AIGateway'
        : dormant
          ? '/enable zavorth-bridge-remote'
          : 'npm run sidecars:status',
      telemetry: {
        updatedAt: card.checkedAt,
        pendingWork: 0,
        lastError: dormant ? null : (!card.ready && card.enabled ? (card.message || null) : null),
        statusLine: card.ready
          ? 'Health confirmed by sidecar.'
          : dormant
            ? 'Sidecar dormant per the current profile lifecycle.'
          : (card.enabled ? 'Sidecar still without healthy readiness.' : 'Sidecar disabled.'),
      },
      details: [
        advertisedEndpoint
          ? `Endpoint: ${advertisedEndpoint}.`
          : 'No published endpoint.',
        probeEndpoint && probeEndpoint !== advertisedEndpoint
          ? `Canonical probe: ${probeEndpoint}.`
          : 'Canonical probe aligned with the published endpoint.',
        card.pid ? `PID: ${card.pid}.` : 'No active PID.',
        dormant
          ? (lifecycle.notes || 'Lifecycle marked the sidecar as dormant in this profile.')
          : (card.message || 'No additional sidecar observation.'),
      ],
      actions: this.buildActions(card.id, readiness, {
        pendingWork: 0,
        hasError: !dormant && !card.ready && Boolean(card.enabled && card.message),
      }),
    };
  }

  private buildSidecarProbeEndpoint(card: SidecarStatusCard): string | null {
    const rawBase = card.baseUrl || card.localUrl || null;
    if (!rawBase) {
      return null;
    }

    try {
      const normalized = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
      if (card.id === 'AIGateway') {
        return new URL('models', normalized).toString().replace(/\/+$/u, '');
      }
      return new URL('health', normalized).toString().replace(/\/+$/u, '');
    } catch (error: unknown) {logger.warn('[Zavorth Remote Transport] health check failed', error); return rawBase; }
  }

  private buildNodeHostEntry(nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>): ZavorthRemoteTransportEntry {
    const selected = nodeMesh.selected || null;
    const queued = Number(nodeMesh.summary.queued || 0);
    const maintenance = selected?.maintenance || null;
    const maintenanceRepairQueued = maintenance?.recoverKind === 'queue-node-host-maintenance';
    const maintenanceInFlight = Boolean((maintenance?.pending || 0) > 0 || (maintenance?.claimed || 0) > 0);
    const readiness: ZavorthRemoteTransportReadiness =
      nodeMesh.summary.online > 0 && nodeMesh.summary.invokable > 0
        ? 'ready'
        : nodeMesh.summary.paired > 0
          ? 'partial'
          : 'planned';
    const transport = selected?.transport || 'node-mesh-heartbeat';

    return {
      id: 'node-host',
      label: 'Node host transport',
      kind: 'node-host',
      transport,
      direction: 'bidirectional',
      readiness,
      available: readiness === 'ready',
      endpoint: null,
      operatorSummary: readiness === 'ready'
        ? (maintenanceInFlight
            ? `${nodeMesh.summary.online} node(s) online and ${nodeMesh.summary.invokable} invokable now. Host maintenance in progress.`
            : `${nodeMesh.summary.online} node(s) online and ${nodeMesh.summary.invokable} invokable now.`)
        : readiness === 'partial'
          ? `${nodeMesh.summary.paired} paired node(s), but transport still requires a live heartbeat.`
          : 'No paired node host exists yet to expand the remote runtime.',
      actionHint: maintenanceRepairQueued
        ? '/transports repair node-host'
        : (selected?.id ? `/nodeinvoke ${selected.id} system.run` : '/nodepair headless'),
      telemetry: {
        updatedAt: selected?.lastSeenAt || selected?.updatedAt || null,
        pendingWork: queued,
        lastError: selected?.status === 'blocked'
          ? (selected.operatorSummary || selected.nextAction || 'Node host blocked in the mesh.')
          : maintenance?.latestStatus === 'failed'
            ? (maintenance.latestResultSummary || 'Last maintenance cycle failed.')
          : null,
        statusLine: selected
          ? (maintenanceInFlight
              ? `Node ${selected.status} with maintenance ${maintenance?.latestAction || 'repair'} in progress and ${selected.pendingInvocations || 0} local pending item(s).`
              : maintenance?.latestStatus === 'completed'
                ? `Node ${selected.status}; last ${maintenance.latestAction || 'repair'} completed successfully.`
                : `Node ${selected.status} with ${selected.pendingInvocations || 0} local pending item(s).`)
          : 'No node selected in the remote plane.',
      },
      details: [
        `Nodes visible: ${nodeMesh.summary.total}.`,
        `Paired: ${nodeMesh.summary.paired}.`,
        `Pending: ${nodeMesh.summary.pending}.`,
        `Online: ${nodeMesh.summary.online}.`,
        maintenance?.supported
          ? `Maintenance: ${maintenance.latestAction || 'doctor/repair'} / ${maintenance.latestStatus || 'idle'}${maintenance.recoverKind ? ` / recover ${maintenance.recoverKind}` : ''}.`
          : 'Maintenance: unavailable on this node host.',
        selected?.nextAction || 'Generate a pairing draft to connect the first node host.',
      ],
      actions: this.buildActions('node-host', readiness, {
        pendingWork: queued + (maintenanceRepairQueued ? 1 : 0),
        hasError: selected?.status === 'blocked' || maintenance?.latestStatus === 'failed',
      }),
    };
  }

  private buildSuggestedActions(
    entries: ZavorthRemoteTransportEntry[],
    nodeMesh: ReturnType<ZavorthNodeMeshService['buildSnapshot']>,
  ): ZavorthRemoteTransportSnapshot['suggestedActions'] {
    const actions: ZavorthRemoteTransportSnapshot['suggestedActions'] = [];
    const nodeHost = entries.find((entry) => entry.id === 'node-host');
    const AIGateway = entries.find((entry) => entry.id === 'AIGateway');
    const discord = entries.find((entry) => entry.id === 'discord-transport');

    if (nodeHost && nodeHost.readiness !== 'ready') {
      actions.push({
        id: 'node-host-pair',
        label: 'Prepare node host',
        command: nodeHost.actionHint || '/nodepair headless',
        severity: nodeMesh.summary.paired > 0 ? 'warn' : 'info',
        reason: nodeHost.operatorSummary,
      });
    }
    if (nodeHost && (nodeHost.telemetry.pendingWork > 0 || nodeHost.telemetry.lastError)) {
      actions.push({
        id: 'node-host-repair',
        label: 'Repair node host',
        command: '/transports repair node-host',
        severity: 'warn',
        reason: nodeHost.telemetry.lastError || nodeHost.telemetry.statusLine || nodeHost.operatorSummary,
      });
    }

    if (AIGateway && AIGateway.readiness !== 'ready') {
      actions.push({
        id: 'AIGateway-prepare',
        label: 'Prepare AIGateway',
        command: AIGateway.actionHint || '/connect AIGateway',
        severity: AIGateway.readiness === 'partial' ? 'warn' : 'info',
        reason: AIGateway.operatorSummary,
      });
    }
    if (AIGateway && AIGateway.telemetry.lastError) {
      actions.push({
        id: 'AIGateway-repair',
        label: 'Repair AIGateway',
        command: '/transports repair AIGateway',
        severity: 'warn',
        reason: AIGateway.telemetry.lastError,
      });
    }

    if (discord && discord.readiness !== 'ready') {
      actions.push({
        id: 'discord-check',
        label: 'Check Discord',
        command: discord.actionHint || '/status',
        severity: discord.readiness === 'partial' ? 'warn' : 'info',
        reason: discord.operatorSummary,
      });
    }
    if (discord && (discord.telemetry.pendingWork > 0 || discord.telemetry.lastError)) {
      actions.push({
        id: 'discord-repair',
        label: 'Repair Discord',
        command: '/transports repair discord-transport',
        severity: 'warn',
        reason: discord.telemetry.lastError || discord.operatorSummary,
      });
    }

    return actions.slice(0, 4);
  }

  private selectEntry(
    entries: ZavorthRemoteTransportEntry[],
    selectedId?: string | null,
  ): ZavorthRemoteTransportEntry | null {
    const normalized = String(selectedId || '').trim().toLowerCase();
    if (normalized) {
      const direct = entries.find((entry) => entry.id.toLowerCase() === normalized);
      if (direct) {
        return direct;
      }
    }

    return entries.find((entry) => entry.readiness === 'partial')
      || entries.find((entry) => entry.readiness === 'ready')
      || entries[0]
      || null;
  }

  private readDiscordBridgeSnapshot(): DiscordBridgeSnapshot {
    const fallbackMode: BridgeMode = config.discordBotToken
      ? 'native'
      : config.discordBridgeEnabled
        ? 'bridge'
        : 'unknown';
    const fallback: DiscordBridgeSnapshot = {
      mode: fallbackMode,
      enabled: Boolean(config.discordBotToken || config.discordBridgeEnabled),
      started: false,
      pendingInbox: 0,
      pendingOutbox: 0,
      lastError: null,
      updatedAt: null,
    };

    try {
      if (!this.existsSync(this.bridgeStatusFilePath)) {
        return fallback;
      }
      const raw = JSON.parse(this.readFileSync(this.bridgeStatusFilePath, 'utf8')) as Record<string, unknown>;
      const mode = raw.mode === 'native' || raw.mode === 'bridge'
        ? raw.mode
        : fallbackMode;

      return {
        mode,
        enabled: raw.enabled === true || fallback.enabled,
        started: raw.started === true,
        pendingInbox: Number(raw.pendingInbox || 0) || 0,
        pendingOutbox: Number(raw.pendingOutbox || 0) || 0,
        lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Remote Transport] lifecycle operation failed', error); return fallback; }
  }

  private readCapabilityLifecycleHint(capabilityId: string, fallbackCapabilityIds: string[] = []): CapabilityLifecycleHint {
    try {
      if (!this.capabilityLifecycleStateFile || !this.existsSync(this.capabilityLifecycleStateFile)) {
        return { dormant: false, notes: null };
      }

      const state = JSON.parse(this.readFileSync(this.capabilityLifecycleStateFile, 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const capabilityIds = [capabilityId, ...fallbackCapabilityIds];
      const capability = capabilityIds
        .map((id) => state?.capabilities?.[id])
        .find((entry) => entry && typeof entry === 'object');
      if (!capability || typeof capability !== 'object') {
        const profile = String(state?.profile || '').trim().toLowerCase();
        if (!profile) {
          return { dormant: false, notes: null };
        }

        const manifest = capabilityIds
          .map((id) => capabilityManifestMap.get(id))
          .find((entry) => entry && typeof entry === 'object');
        if (!manifest) {
          return { dormant: false, notes: null };
        }

        const enabledByDefault = manifest.enabledByDefaultProfiles.includes(profile as ZavorthProfile);
        return {
          dormant: !enabledByDefault,
          notes: enabledByDefault
            ? null
            : `Profile ${profile} leaves ${manifest.label} dormant by default.`,
        };
      }

      if (capability.enabledByUser === true) {
        return {
          dormant: false,
          notes: typeof capability.notes === 'string' ? capability.notes : null,
        };
      }

      return {
        dormant: capability.state === 'dormant',
        notes: typeof capability.notes === 'string' ? capability.notes : null,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Remote Transport] filesystem check failed', error);
    return { dormant: false, notes: null };
  }
  }

  private buildActions(
    transportId: 'discord-transport' | SidecarStatusCard['id'] | 'node-host',
    readiness: ZavorthRemoteTransportReadiness,
    telemetry: {
      pendingWork: number;
      hasError: boolean;
    },
  ): ZavorthRemoteTransportEntry['actions'] {
    const actions: ZavorthRemoteTransportEntry['actions'] = [
      {
        id: `${transportId}:inspect`,
        label: 'Inspect',
        command: `/transports inspect ${transportId}`,
        kind: 'inspect',
      },
    ];
    if (readiness !== 'ready' || telemetry.pendingWork > 0 || telemetry.hasError) {
      actions.push({
        id: `${transportId}:repair`,
        label: 'Repair',
        command: `/transports repair ${transportId}`,
        kind: 'repair',
      });
    }
    actions.push({
      id: `${transportId}:prepare`,
      label: 'Prepare',
      command: `/transports prepare ${transportId}`,
      kind: 'prepare',
    });
    if (readiness !== 'disabled') {
      actions.push({
        id: `${transportId}:smoke`,
        label: 'Smoke',
        command: `/transports smoke ${transportId}`,
        kind: 'smoke',
      });
    }
    return actions;
  }
}
