import { queryUniversalAgentRuns } from './RunObservatory.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRun,
  UniversalReplyPortStatus,
} from './UniversalAgentRuntimeTypes.js';

export const CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION = '2026-05-03.wave-41' as const;

export type CrossChannelContinuityStatus =
  | 'single-channel'
  | 'bridged'
  | 'handoff-ready'
  | 'blocked';

export type CrossChannelContinuityChannel = {
  id: string;
  label: string;
  kind: UniversalAgentChannel;
  status: UniversalReplyPortStatus;
  primary: boolean;
  source: 'reply-port' | 'channel-mesh' | 'node-mesh' | 'metadata' | 'fallback';
  canResume: boolean;
  canNotify: boolean;
  continuityKey: string;
  lastRunId: string | null;
  description: string;
};

export type CrossChannelContinuityHandoff = {
  id: string;
  fromChannel: UniversalAgentChannel;
  toChannel: UniversalAgentChannel;
  reason: string;
  status: 'available' | 'needs-approval' | 'blocked';
  requiresApproval: boolean;
  previewRequired: boolean;
  command: string;
  receiptIds: string[];
};

export type CrossChannelContinuityReceipt = {
  id: string;
  kind:
    | 'run-observatory'
    | 'reply-port'
    | 'channel-mesh'
    | 'node-mesh'
    | 'session'
    | 'handoff'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-approval' | 'missing';
};

export type CrossChannelContinuitySnapshot = {
  contractVersion: typeof CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION;
  source: 'CrossChannelContinuityService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
    userId: string;
  };
  status: CrossChannelContinuityStatus;
  session: {
    continuityKey: string;
    originChannel: UniversalAgentChannel;
    activeChannel: UniversalAgentChannel;
    primaryReplyPortId: string | null;
    ownerUserId: string;
    workspace: string | null;
  };
  summary: {
    channelCount: number;
    availableChannelCount: number;
    replyPortCount: number;
    handoffCount: number;
    bridgeDetected: boolean;
    nodeMeshLinked: boolean;
    runObservatoryLinked: boolean;
    continuityPromptPresent: boolean;
    sameGateway: true;
  };
  channels: CrossChannelContinuityChannel[];
  handoffs: CrossChannelContinuityHandoff[];
  receipts: CrossChannelContinuityReceipt[];
  policy: {
    noCrossChannelMessageSent: true;
    noSessionForkCreated: true;
    approvalRequiredForChannelSwitch: true;
    originalChannelPreserved: true;
    sameGatewayRequired: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    resumeHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type CrossChannelContinuityInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'channel'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}

function normalizeChannel(value: unknown): UniversalAgentChannel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'web' || raw === 'cli' || raw === 'telegram' || raw === 'discord' || raw === 'api') {
    return raw;
  }
  return 'unknown';
}

function normalizeStatus(value: unknown): UniversalReplyPortStatus {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'available' || raw === 'degraded' || raw === 'blocked' || raw === 'offline') {
    return raw;
  }
  return 'available';
}

function redactText(value: unknown, fallback = '', maxLength = 180): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function uniqueChannels(channels: CrossChannelContinuityChannel[]): CrossChannelContinuityChannel[] {
  const seen = new Set<string>();
  return channels.filter((channel) => {
    const key = `${channel.kind}:${channel.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export class CrossChannelContinuityService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: CrossChannelContinuityInput): CrossChannelContinuitySnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const observatory = queryUniversalAgentRuns({
      runs: [run],
      query: {
        sessionId: run.sessionId,
        limit: 5,
      },
      generatedAt,
    });
    const bridge = recordOrNull(run.metadata.channelMeshBridge);
    const nodeMesh = recordOrNull(run.metadata.nodeMesh)
      || recordOrNull(run.metadata.nodeMeshSnapshot)
      || recordOrNull(run.metadata.nodeMeshSmoke);
    const channels = this.buildChannels(run, bridge, nodeMesh);
    const handoffs = this.buildHandoffs(run, channels);
    const status = this.resolveStatus(channels, handoffs, Boolean(bridge), Boolean(nodeMesh));
    const continuityKey = this.resolveContinuityKey(run);
    const primary = channels.find((channel) => channel.primary) || channels[0] || null;
    const receipts = this.buildReceipts({
      run,
      bridge,
      nodeMesh,
      channels,
      handoffs,
      observatoryReceiptCount: observatory.receipts.length,
    });

    return {
      contractVersion: CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION,
      source: 'CrossChannelContinuityService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
        userId: run.userId,
      },
      status,
      session: {
        continuityKey,
        originChannel: normalizeChannel(recordOrNull(run.metadata.channelMeshBridge)?.originChannel) || run.channel,
        activeChannel: run.channel,
        primaryReplyPortId: primary?.id || null,
        ownerUserId: run.userId,
        workspace: run.workspace ?? null,
      },
      summary: {
        channelCount: channels.length,
        availableChannelCount: channels.filter((channel) => channel.status === 'available').length,
        replyPortCount: run.replyPorts.length,
        handoffCount: handoffs.length,
        bridgeDetected: Boolean(bridge),
        nodeMeshLinked: Boolean(nodeMesh),
        runObservatoryLinked: observatory.receipts.length > 0,
        continuityPromptPresent: this.hasContinuityPrompt(run),
        sameGateway: true,
      },
      channels,
      handoffs,
      receipts,
      policy: {
        noCrossChannelMessageSent: true,
        noSessionForkCreated: true,
        approvalRequiredForChannelSwitch: true,
        originalChannelPreserved: true,
        sameGatewayRequired: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth continuity "${redactText(run.input, 'pedido', 80)}"`,
        commandCenterPath: '/control?sector=channels',
        resumeHint: 'Retomar em outro canal usa o mesmo sessionId e gateway universal.',
        approvalHint: 'Enviar notificacao ou mudar canal primario exige approval explicito.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, channels, handoffs),
    };
  }

  private buildChannels(
    run: UniversalAgentRun,
    bridge: LooseRecord | null,
    nodeMesh: LooseRecord | null,
  ): CrossChannelContinuityChannel[] {
    const continuityKey = this.resolveContinuityKey(run);
    const replyPortChannels = run.replyPorts.map((port) => ({
      id: normalizeText(port.id, `${port.kind}:primary`),
      label: normalizeText(port.label, this.labelForChannel(port.kind)),
      kind: normalizeChannel(port.kind),
      status: normalizeStatus(port.status),
      primary: port.primary === true,
      source: 'reply-port' as const,
      canResume: port.status === 'available' || port.status === 'degraded',
      canNotify: false,
      continuityKey,
      lastRunId: run.id,
      description: redactText(port.description, 'Porta de resposta do gateway universal.'),
    }));
    const metadataChannels = [
      ...listRecords(bridge?.channels),
      ...listRecords(run.metadata.channels),
      ...listRecords(recordOrNull(run.metadata.crossChannelContinuity)?.channels),
    ].map((entry, index) => {
      const kind = normalizeChannel(entry.kind ?? entry.channel ?? entry.type);
      return {
        id: normalizeText(entry.id, `${kind}:metadata-${index + 1}`),
        label: normalizeText(entry.label ?? entry.name, this.labelForChannel(kind)),
        kind,
        status: normalizeStatus(entry.status),
        primary: entry.primary === true,
        source: 'metadata' as const,
        canResume: entry.canResume !== false,
        canNotify: entry.canNotify === true,
        continuityKey,
        lastRunId: normalizeText(entry.lastRunId) || run.id,
        description: redactText(entry.description ?? entry.detail, 'Canal declarado em metadata.'),
      };
    });
    const bridgeChannel = bridge
      ? [{
        id: `channel-mesh:${normalizeKey(bridge.source, 'bridge')}`,
        label: 'Channel Mesh',
        kind: normalizeChannel(bridge.channel ?? bridge.originChannel ?? run.channel),
        status: 'available' as UniversalReplyPortStatus,
        primary: false,
        source: 'channel-mesh' as const,
        canResume: true,
        canNotify: false,
        continuityKey,
        lastRunId: run.id,
        description: redactText(bridge.source, 'Bridge recebido pelo Channel Mesh.'),
      }]
      : [];
    const nodeMeshChannel = nodeMesh
      ? [{
        id: `node-mesh:${normalizeKey(nodeMesh.nodeId ?? nodeMesh.id, 'node')}`,
        label: 'Node Mesh',
        kind: 'api' as UniversalAgentChannel,
        status: normalizeStatus(nodeMesh.status),
        primary: false,
        source: 'node-mesh' as const,
        canResume: true,
        canNotify: false,
        continuityKey,
        lastRunId: run.id,
        description: redactText(nodeMesh.summary ?? nodeMesh.detail, 'Node Mesh anexado ao mesmo gateway.'),
      }]
      : [];
    const fallback = replyPortChannels.length === 0
      ? [{
        id: `${run.channel}:primary`,
        label: this.labelForChannel(run.channel),
        kind: run.channel,
        status: 'available' as UniversalReplyPortStatus,
        primary: true,
        source: 'fallback' as const,
        canResume: true,
        canNotify: false,
        continuityKey,
        lastRunId: run.id,
        description: 'Canal de origem preservado pelo runtime.',
      }]
      : [];
    const channels = uniqueChannels([
      ...replyPortChannels,
      ...metadataChannels,
      ...bridgeChannel,
      ...nodeMeshChannel,
      ...fallback,
    ]);
    if (!channels.some((channel) => channel.primary) && channels[0]) {
      return channels.map((channel, index) => ({
        ...channel,
        primary: index === 0,
      }));
    }
    return channels.slice(0, 12);
  }

  private buildHandoffs(
    run: UniversalAgentRun,
    channels: CrossChannelContinuityChannel[],
  ): CrossChannelContinuityHandoff[] {
    const origin = normalizeChannel(run.channel);
    const explicitHandoffs = [
      ...listRecords(run.metadata.crossChannelHandoffs),
      ...listRecords(recordOrNull(run.metadata.crossChannelContinuity)?.handoffs),
    ].map((entry, index) => {
      const toChannel = normalizeChannel(entry.toChannel ?? entry.to ?? entry.channel);
      const fromChannel = normalizeChannel(entry.fromChannel ?? entry.from) || origin;
      const status: CrossChannelContinuityHandoff['status'] = normalizeText(entry.status).toLowerCase() === 'blocked'
        ? 'blocked'
        : entry.requiresApproval === false
          ? 'available'
          : 'needs-approval';
      return {
        id: normalizeText(entry.id, `handoff:${index + 1}`),
        fromChannel,
        toChannel,
        reason: redactText(entry.reason ?? entry.detail, 'Handoff declarado para continuidade.'),
        status,
        requiresApproval: entry.requiresApproval !== false,
        previewRequired: entry.previewRequired !== false,
        command: normalizeText(entry.command, `zavorth continuity handoff ${toChannel}`),
        receiptIds: [],
      };
    });
    const inferredHandoffs = channels
      .filter((channel) => channel.kind !== origin && channel.status !== 'offline')
      .slice(0, 6)
      .map((channel) => ({
        id: `handoff:${origin}:to:${channel.kind}`,
        fromChannel: origin,
        toChannel: channel.kind,
        reason: `Retomar a sessao ${run.sessionId} em ${channel.label}.`,
        status: channel.status === 'blocked' ? 'blocked' as const : 'needs-approval' as const,
        requiresApproval: true,
        previewRequired: true,
        command: `zavorth continuity handoff ${channel.kind} --session ${run.sessionId}`,
        receiptIds: [],
      }));
    return [...explicitHandoffs, ...inferredHandoffs].slice(0, 10);
  }

  private buildReceipts(input: {
    run: UniversalAgentRun;
    bridge: LooseRecord | null;
    nodeMesh: LooseRecord | null;
    channels: CrossChannelContinuityChannel[];
    handoffs: CrossChannelContinuityHandoff[];
    observatoryReceiptCount: number;
  }): CrossChannelContinuityReceipt[] {
    return [
      {
        id: `continuity-receipt:${input.run.id}:observatory`,
        kind: 'run-observatory',
        source: 'RunObservatory',
        detail: input.observatoryReceiptCount > 0
          ? `${input.observatoryReceiptCount} receipt(s) da sessao encontrados.`
          : 'Sem receipts adicionais da sessao no observatory local.',
        status: input.observatoryReceiptCount > 0 ? 'ready' : 'missing',
      },
      {
        id: `continuity-receipt:${input.run.id}:reply-ports`,
        kind: 'reply-port',
        source: 'UniversalReplyPort',
        detail: `${input.run.replyPorts.length} reply port(s) preservados no run.`,
        status: input.run.replyPorts.length > 0 ? 'ready' : 'missing',
      },
      {
        id: `continuity-receipt:${input.run.id}:channel-mesh`,
        kind: 'channel-mesh',
        source: 'ZavorthAgentGateway',
        detail: input.bridge ? 'Channel Mesh anexado ao gateway universal.' : 'Sem bridge Channel Mesh neste run.',
        status: input.bridge ? 'ready' : 'missing',
      },
      {
        id: `continuity-receipt:${input.run.id}:node-mesh`,
        kind: 'node-mesh',
        source: 'NodeMesh',
        detail: input.nodeMesh ? 'Node Mesh aparece como superficie conectada.' : 'Node Mesh nao informado.',
        status: input.nodeMesh ? 'ready' : 'missing',
      },
      {
        id: `continuity-receipt:${input.run.id}:session`,
        kind: 'session',
        source: 'AgentRunService',
        detail: `Session ${input.run.sessionId} permanece como chave de continuidade.`,
        status: 'ready',
      },
      {
        id: `continuity-receipt:${input.run.id}:handoff`,
        kind: 'handoff',
        source: 'CrossChannelContinuityService',
        detail: `${input.handoffs.length} handoff(s) preparados sem enviar mensagem.`,
        status: input.handoffs.length > 0 ? 'needs-approval' : 'missing',
      },
      {
        id: `continuity-receipt:${input.run.id}:policy`,
        kind: 'policy',
        source: 'CrossChannelContinuityService',
        detail: 'Snapshot e read-only: nenhuma mensagem cross-channel foi enviada.',
        status: 'ready',
      },
      {
        id: `continuity-receipt:${input.run.id}:surface`,
        kind: 'surface',
        source: 'CLI/CommandCenter',
        detail: 'Continuidade exposta por CLI read-only e Command Center.',
        status: 'ready',
      },
    ];
  }

  private resolveStatus(
    channels: CrossChannelContinuityChannel[],
    handoffs: CrossChannelContinuityHandoff[],
    bridgeDetected: boolean,
    nodeMeshLinked: boolean,
  ): CrossChannelContinuityStatus {
    if (channels.length === 0 || channels.every((channel) => channel.status === 'blocked' || channel.status === 'offline')) {
      return 'blocked';
    }
    if (handoffs.length > 0) {
      return 'handoff-ready';
    }
    if (bridgeDetected || nodeMeshLinked || channels.length > 1) {
      return 'bridged';
    }
    return 'single-channel';
  }

  private resolveNextSafeAction(
    status: CrossChannelContinuityStatus,
    channels: CrossChannelContinuityChannel[],
    handoffs: CrossChannelContinuityHandoff[],
  ): string {
    if (status === 'blocked') {
      return 'Revisar reply ports e bridge antes de retomar em outro canal.';
    }
    if (status === 'handoff-ready') {
      return 'Revisar preview e approval antes de enviar qualquer handoff cross-channel.';
    }
    if (status === 'bridged') {
      return 'Manter o mesmo sessionId e usar o gateway universal para continuidade entre superficies.';
    }
    return channels.length > 0
      ? 'Continuar no canal primario atual; nenhum handoff e necessario.'
      : 'Criar reply port antes de responder.';
  }

  private resolveContinuityKey(run: UniversalAgentRun): string {
    const crossChannel = recordOrNull(run.metadata.crossChannelContinuity);
    const canonicalContext = recordOrNull(run.metadata.canonicalContextSummary);
    return normalizeText(crossChannel?.continuityKey)
      || normalizeText(canonicalContext?.continuityKey)
      || `${run.userId}:${run.sessionId}`;
  }

  private hasContinuityPrompt(run: UniversalAgentRun): boolean {
    const context = recordOrNull(run.metadata.canonicalContextSummary);
    const canonical = recordOrNull(run.metadata.canonicalContext);
    return Boolean(
      normalizeText(context?.continuityPrompt)
      || normalizeText(canonical?.continuityPrompt)
      || normalizeText(run.metadata.continuityPrompt),
    );
  }

  private labelForChannel(channel: UniversalAgentChannel): string {
    if (channel === 'web') {
      return 'Command Center';
    }
    if (channel === 'cli') {
      return 'Terminal';
    }
    if (channel === 'telegram') {
      return 'Telegram';
    }
    if (channel === 'discord') {
      return 'Discord';
    }
    if (channel === 'api') {
      return 'API';
    }
    return 'Canal de origem';
  }
}
