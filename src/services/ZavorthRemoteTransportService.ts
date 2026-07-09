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
        headline: `Zavorth expõe ${summary.total} transporte(s) remoto(s) no plano atual.`,
        operatorSummary: `${summary.ready} pronto(s), ${summary.partial} em preparo, ${summary.attentionRequired} pedindo atencao e ${summary.pendingWork} item(ns) pendente(s) no plano remoto.`,
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
            ? 'Discord nativo pronto para entrada e saida no Gateway.'
            : 'Discord bridge pronto para sincronizar inbox e outbox.')
        : dormant
          ? 'Discord esta configurado, mas dormente no perfil atual para manter o core leve.'
        : bridge.enabled
          ? 'Discord ja esta configurado, mas o bridge ainda nao confirmou prontidao.'
          : 'Discord transport ainda nao esta habilitado neste runtime.',
      actionHint: bridge.started ? '/channels discord' : dormant ? '/enable discord' : '/status',
      telemetry: {
        updatedAt: bridge.updatedAt,
        pendingWork: bridge.pendingInbox + bridge.pendingOutbox,
        lastError: bridge.lastError,
        statusLine: bridge.started
          ? 'Bridge visivel no plano remoto.'
          : dormant
            ? 'Bridge dormente pelo lifecycle do perfil atual.'
          : (bridge.enabled ? 'Bridge aguardando prontidao.' : 'Bridge desativado.'),
      },
      details: [
        `Mode: ${bridge.mode}.`,
        `Inbox pendente: ${bridge.pendingInbox}.`,
        `Outbox pendente: ${bridge.pendingOutbox}.`,
        bridge.updatedAt ? `Atualizado em: ${bridge.updatedAt}.` : 'Sem snapshot recente do bridge.',
        dormant
          ? (lifecycle.notes || 'Lifecycle marcou Discord como dormant neste perfil.')
          : 'Lifecycle do Discord sem observacao adicional.',
        bridge.lastError ? `Ultimo erro: ${bridge.lastError}` : 'Sem erro recente do bridge.',
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
        ? `${card.name} pronto para ampliar o roteamento remoto do Zavorth.`
        : dormant
          ? `${card.name} esta dormente no perfil atual para manter o core leve.`
        : card.enabled
          ? `${card.name} existe localmente, mas ainda nao confirmou health pronto.`
          : `${card.name} esta desativado neste host.`,
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
          ? 'Health confirmado pelo sidecar.'
          : dormant
            ? 'Sidecar dormente pelo lifecycle do perfil atual.'
          : (card.enabled ? 'Sidecar ainda sem health pronto.' : 'Sidecar desativado.'),
      },
      details: [
        advertisedEndpoint
          ? `Endpoint: ${advertisedEndpoint}.`
          : 'Sem endpoint publicado.',
        probeEndpoint && probeEndpoint !== advertisedEndpoint
          ? `Probe canonico: ${probeEndpoint}.`
          : 'Probe canonico alinhado ao endpoint publicado.',
        card.pid ? `PID: ${card.pid}.` : 'Sem PID ativo.',
        dormant
          ? (lifecycle.notes || 'Lifecycle marcou o sidecar como dormant neste perfil.')
          : (card.message || 'Sem observacao adicional do sidecar.'),
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
            ? `${nodeMesh.summary.online} node(s) online e ${nodeMesh.summary.invokable} invocavel(is) agora. Maintenance do host em andamento.`
            : `${nodeMesh.summary.online} node(s) online e ${nodeMesh.summary.invokable} invocavel(is) agora.`)
        : readiness === 'partial'
          ? `${nodeMesh.summary.paired} node(s) pareado(s), mas o transporte ainda pede heartbeat vivo.`
          : 'Ainda nao ha node host pareado para ampliar o runtime remoto.',
      actionHint: maintenanceRepairQueued
        ? '/transports repair node-host'
        : (selected?.id ? `/nodeinvoke ${selected.id} system.run` : '/nodepair headless'),
      telemetry: {
        updatedAt: selected?.lastSeenAt || selected?.updatedAt || null,
        pendingWork: queued,
        lastError: selected?.status === 'blocked'
          ? (selected.operatorSummary || selected.nextAction || 'Node host bloqueado no mesh.')
          : maintenance?.latestStatus === 'failed'
            ? (maintenance.latestResultSummary || 'Ultimo ciclo de maintenance falhou.')
          : null,
        statusLine: selected
          ? (maintenanceInFlight
              ? `Node ${selected.status} com maintenance ${maintenance?.latestAction || 'repair'} em andamento e ${selected.pendingInvocations || 0} pendencia(s) local(is).`
              : maintenance?.latestStatus === 'completed'
                ? `Node ${selected.status}; ultimo ${maintenance.latestAction || 'repair'} concluiu com sucesso.`
                : `Node ${selected.status} com ${selected.pendingInvocations || 0} pendencia(s) local(is).`)
          : 'Nenhum node selecionado no plano remoto.',
      },
      details: [
        `Nodes visiveis: ${nodeMesh.summary.total}.`,
        `Pareados: ${nodeMesh.summary.paired}.`,
        `Pendentes: ${nodeMesh.summary.pending}.`,
        `Online: ${nodeMesh.summary.online}.`,
        maintenance?.supported
          ? `Maintenance: ${maintenance.latestAction || 'doctor/repair'} / ${maintenance.latestStatus || 'idle'}${maintenance.recoverKind ? ` / recover ${maintenance.recoverKind}` : ''}.`
          : 'Maintenance: indisponivel neste node host.',
        selected?.nextAction || 'Gere um pairing draft para ligar o primeiro node host.',
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
        label: 'Preparar node host',
        command: nodeHost.actionHint || '/nodepair headless',
        severity: nodeMesh.summary.paired > 0 ? 'warn' : 'info',
        reason: nodeHost.operatorSummary,
      });
    }
    if (nodeHost && (nodeHost.telemetry.pendingWork > 0 || nodeHost.telemetry.lastError)) {
      actions.push({
        id: 'node-host-repair',
        label: 'Reparar node host',
        command: '/transports repair node-host',
        severity: 'warn',
        reason: nodeHost.telemetry.lastError || nodeHost.telemetry.statusLine || nodeHost.operatorSummary,
      });
    }

    if (AIGateway && AIGateway.readiness !== 'ready') {
      actions.push({
        id: 'AIGateway-prepare',
        label: 'Preparar AIGateway',
        command: AIGateway.actionHint || '/connect AIGateway',
        severity: AIGateway.readiness === 'partial' ? 'warn' : 'info',
        reason: AIGateway.operatorSummary,
      });
    }
    if (AIGateway && AIGateway.telemetry.lastError) {
      actions.push({
        id: 'AIGateway-repair',
        label: 'Reparar AIGateway',
        command: '/transports repair AIGateway',
        severity: 'warn',
        reason: AIGateway.telemetry.lastError,
      });
    }

    if (discord && discord.readiness !== 'ready') {
      actions.push({
        id: 'discord-check',
        label: 'Verificar Discord',
        command: discord.actionHint || '/status',
        severity: discord.readiness === 'partial' ? 'warn' : 'info',
        reason: discord.operatorSummary,
      });
    }
    if (discord && (discord.telemetry.pendingWork > 0 || discord.telemetry.lastError)) {
      actions.push({
        id: 'discord-repair',
        label: 'Reparar Discord',
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

      const state = JSON.parse(this.readFileSync(this.capabilityLifecycleStateFile, 'utf8')) as Record<string, any>;
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
            : `Perfil ${profile} deixa ${manifest.label} dormente por padrao.`,
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
        label: 'Inspecionar',
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
      label: 'Preparar',
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
