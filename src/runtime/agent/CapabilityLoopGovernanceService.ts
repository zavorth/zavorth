import type {
  TrustSliderLevel,
  TrustSliderPolicyDecision,
  TrustSliderSandboxTier,
} from '../uni/UniversalIntentContracts.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalToolExposure,
  UniversalToolExposureMode,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export type StrongCapabilityId =
  | 'mnemos.memory'
  | 'echo.hands'
  | 'nexus.surface'
  | 'swarm.escalation'
  | 'selfmod.supervised'
  | 'watchmode.computer-use'
  | 'skills.snapshot'
  | 'mcp.snapshot'
  | 'channel-mesh.bridge'
  | 'node-mesh.gateway'
  | 'session.ownership'
  | 'timing.canonical'
  | 'policy.hot-reload';

export type StrongCapabilityStatus =
  | 'ready'
  | 'requested'
  | 'active'
  | 'waiting_approval'
  | 'blocked'
  | 'degraded'
  | 'unavailable';

export type StrongCapabilityPolicyMode =
  | 'memory-plane'
  | 'governed-tool'
  | 'surface'
  | 'escalation'
  | 'supervised-mutation'
  | 'visual-control'
  | 'snapshot-quarantine'
  | 'gateway-bridge'
  | 'runtime-invariant'
  | 'policy-reload';

export type StrongCapabilityLoopReceipt = {
  id: string;
  kind: 'policy' | 'request' | 'approval' | 'block' | 'fallback' | 'status';
  source: 'CapabilityLoopGovernanceService';
  status: StrongCapabilityStatus;
  detail: string;
};

export type StrongCapabilityLoopExposureProfile = {
  mode: UniversalToolExposureMode;
  toolIds: string[];
  exposedToolIds: string[];
  blockedToolIds: string[];
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
};

export type StrongCapabilityLoopEntry = {
  capabilityId: StrongCapabilityId;
  label: string;
  status: StrongCapabilityStatus;
  requested: boolean;
  policy: {
    mode: StrongCapabilityPolicyMode;
    trustModes: TrustSliderLevel[];
    permission: 'none' | 'preview' | 'approval' | 'operator';
    description: string;
  };
  exposureProfile: StrongCapabilityLoopExposureProfile;
  receipts: StrongCapabilityLoopReceipt[];
  observability: {
    eventTitles: string[];
    metadataKeys: string[];
    receiptCount: number;
  };
  fallback: {
    honest: boolean;
    summary: string;
  };
  controlSurface: {
    statusPath: string;
    command: string;
  };
};

export type StrongCapabilityLoopSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  source: 'CapabilityLoopGovernanceService';
  trustMode: TrustSliderLevel;
  sandboxTier: TrustSliderSandboxTier;
  summary: string;
  requestedCapabilityIds: StrongCapabilityId[];
  blockedCapabilityIds: StrongCapabilityId[];
  degradedCapabilityIds: StrongCapabilityId[];
  capabilities: StrongCapabilityLoopEntry[];
};

export type CapabilityLoopGovernanceInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
  trustSlider?: TrustSliderPolicyDecision | null;
  generatedAt?: string | null;
};

type CapabilityCatalogEntry = {
  capabilityId: StrongCapabilityId;
  label: string;
  policyMode: StrongCapabilityPolicyMode;
  trustModes: TrustSliderLevel[];
  permission: StrongCapabilityLoopEntry['policy']['permission'];
  description: string;
  toolIds: string[];
  metadataKeys: string[];
  statusPath: string;
  command: string;
  fallback: string;
  alwaysReady?: boolean;
};

type CapabilitySignals = {
  requestedTools: string[];
  exposedTools: UniversalToolExposure[];
  blockedToolIds: string[];
  metadata: Record<string, unknown>;
  trustMode: TrustSliderLevel;
  sandboxTier: TrustSliderSandboxTier;
};

const CAPABILITY_CATALOG: CapabilityCatalogEntry[] = [
  {
    capabilityId: 'mnemos.memory',
    label: 'Mnemos Memory Plane',
    policyMode: 'memory-plane',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'Memoria entra como cold/hot context e memory signals, sem criar cerebro paralelo.',
    toolIds: ['memory.read'],
    metadataKeys: ['canonicalContextSummary', 'memorySignals'],
    statusPath: '/dashboard/runs/:runId#memory',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem Mnemos disponivel, o run continua com memoria vazia e contexto declarado.',
  },
  {
    capabilityId: 'echo.hands',
    label: 'Echo Hands',
    policyMode: 'governed-tool',
    trustModes: ['collaborator', 'overlord'],
    permission: 'approval',
    description: 'Echo fica exposto como tool governada por policy e approval.',
    toolIds: ['echo_hands'],
    metadataKeys: ['echoHands'],
    statusPath: '/dashboard/runs/:runId#tools',
    command: 'zavorth status --run <runId>',
    fallback: 'Se Echo nao existir no tool runtime, o run registra fallback honesto sem executar.',
  },
  {
    capabilityId: 'nexus.surface',
    label: 'Nexus Surface',
    policyMode: 'surface',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'Nexus e surface nobre, mas entrega pedidos ao gateway universal.',
    toolIds: [],
    metadataKeys: ['nexusSurface', 'responseDecision'],
    statusPath: '/dashboard/runs/:runId#reply',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem gateway anexado, Nexus deve responder indisponibilidade em vez de simular execucao.',
  },
  {
    capabilityId: 'swarm.escalation',
    label: 'Swarm Escalation',
    policyMode: 'escalation',
    trustModes: ['collaborator', 'overlord'],
    permission: 'approval',
    description: 'Swarm/subagentes sao escalacao estruturada dentro do loop.',
    toolIds: ['swarm.run'],
    metadataKeys: ['executionEscalation', 'swarmEscalationProposal'],
    statusPath: '/dashboard/runs/:runId#swarm',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem launch service, o runtime mantem proposta/approval e nao inventa subagentes.',
  },
  {
    capabilityId: 'selfmod.supervised',
    label: 'Selfmod Supervisionado',
    policyMode: 'supervised-mutation',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'preview',
    description: 'Selfmod e preview/apply/rollback supervisionado, com apply e rollback atras de approval.',
    toolIds: ['selfmod.preview', 'selfmod.apply', 'selfmod.rollback'],
    metadataKeys: ['selfModificationPreview', 'selfModificationActionProposal'],
    statusPath: '/dashboard/runs/:runId#selfmod',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem alvo ou servico, o run registra proposta/missing target sem aplicar mudancas.',
  },
  {
    capabilityId: 'watchmode.computer-use',
    label: 'Watch Mode / Computer Use',
    policyMode: 'visual-control',
    trustModes: ['collaborator', 'overlord'],
    permission: 'operator',
    description: 'Executor visual governado por allowlist, escopo e approval.',
    toolIds: ['watchmode.control'],
    metadataKeys: ['watchModeVisualProposal'],
    statusPath: '/dashboard/runs/:runId#watch-mode',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem allowlist ou service, nenhuma acao visual e executada.',
  },
  {
    capabilityId: 'skills.snapshot',
    label: 'Skills Snapshot',
    policyMode: 'snapshot-quarantine',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'Skills entram no snapshot frio com trust/quarentena antes da exposicao de tools.',
    toolIds: [],
    metadataKeys: ['importedCapabilityTrust', 'coldContext', 'canonicalContextSummary'],
    statusPath: '/dashboard/runs/:runId#skills',
    command: 'zavorth status --run <runId>',
    fallback: 'Skills em quarentena removem tools expostas e aparecem como degradadas.',
  },
  {
    capabilityId: 'mcp.snapshot',
    label: 'MCP Snapshot',
    policyMode: 'snapshot-quarantine',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'MCP entra no snapshot do run com trust/quarentena e exposicao filtrada.',
    toolIds: [],
    metadataKeys: ['importedCapabilityTrust', 'coldContext', 'canonicalContextSummary'],
    statusPath: '/dashboard/runs/:runId#mcp',
    command: 'zavorth status --run <runId>',
    fallback: 'MCP indisponivel ou falho vira contexto honesto, nao capability prometida.',
  },
  {
    capabilityId: 'channel-mesh.bridge',
    label: 'Channel Mesh',
    policyMode: 'gateway-bridge',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'Eventos multi-canal entram pelo mesmo gateway universal.',
    toolIds: [],
    metadataKeys: ['channelMeshBridge'],
    statusPath: '/dashboard/runs/:runId#channels',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem bridge, o canal original continua como reply port primario.',
  },
  {
    capabilityId: 'node-mesh.gateway',
    label: 'Node Mesh',
    policyMode: 'gateway-bridge',
    trustModes: ['collaborator', 'overlord'],
    permission: 'approval',
    description: 'Node Mesh e gateway/snapshot, nao executor paralelo invisivel.',
    toolIds: ['node.invoke', 'node_mesh.invoke'],
    metadataKeys: ['nodeMesh', 'nodeMeshSnapshot', 'nodeMeshSmoke'],
    statusPath: '/dashboard/runs/:runId#node-mesh',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem node selecionado ou smoke valido, o status deve apontar indisponibilidade.',
  },
  {
    capabilityId: 'session.ownership',
    label: 'Session Ownership',
    policyMode: 'runtime-invariant',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'Cada run carrega sessionId, ownership e base para garbage collection.',
    toolIds: ['sessions.history', 'sessions.list'],
    metadataKeys: ['canonicalContext', 'sessionOwnership', 'workflowJob'],
    statusPath: '/dashboard/runs/:runId#session',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem sessao explicita, o runtime cria uma sessao canonica por canal/request.',
    alwaysReady: true,
  },
  {
    capabilityId: 'timing.canonical',
    label: 'Timing Canonico',
    policyMode: 'runtime-invariant',
    trustModes: ['protected', 'collaborator', 'overlord'],
    permission: 'none',
    description: 'createdAt/updatedAt/eventos sao a fonte canonica de timing do run.',
    toolIds: [],
    metadataKeys: ['runBudget', 'lifecycleDefense'],
    statusPath: '/dashboard/runs/:runId#events',
    command: 'zavorth status --run <runId>',
    fallback: 'Se nao houver executor, o run ainda registra timing e status final.',
    alwaysReady: true,
  },
  {
    capabilityId: 'policy.hot-reload',
    label: 'Policy Hot Reload',
    policyMode: 'policy-reload',
    trustModes: ['collaborator', 'overlord'],
    permission: 'approval',
    description: 'Reload de policies aparece como capability governada/status, nao mutacao silenciosa.',
    toolIds: ['policy.reload', 'policies.reload'],
    metadataKeys: ['policyHotReload', 'policyReload', 'policyLedger'],
    statusPath: '/dashboard/runs/:runId#policies',
    command: 'zavorth status --run <runId>',
    fallback: 'Sem reload service, policies atuais seguem ativas e o run registra a ausencia.',
  },
];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeRisk(risk: UniversalToolRiskLevel | undefined): number {
  if (risk === 'danger') {
    return 3;
  }
  if (risk === 'attention') {
    return 2;
  }
  if (risk === 'unknown') {
    return 1;
  }
  return 0;
}

function riskFromScore(score: number): UniversalToolRiskLevel {
  if (score >= 3) {
    return 'danger';
  }
  if (score === 2) {
    return 'attention';
  }
  if (score === 1) {
    return 'unknown';
  }
  return 'safe';
}

function metadataHas(metadata: Record<string, unknown>, key: string): boolean {
  const value = metadata[key];
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return normalizeText(value) !== '';
}

export class CapabilityLoopGovernanceService {
  public buildSnapshot(input: CapabilityLoopGovernanceInput): StrongCapabilityLoopSnapshot {
    const generatedAt = normalizeText(input.generatedAt, new Date().toISOString());
    const trustMode = input.trustSlider?.level || this.resolveTrustMode(input.run.metadata);
    const sandboxTier = input.trustSlider?.sandboxTier || this.resolveSandboxTier(input.run.metadata);
    const signals = this.buildSignals(input, trustMode, sandboxTier);
    const capabilities = CAPABILITY_CATALOG.map((entry) => this.buildEntry(entry, input.run, signals));
    const requestedCapabilityIds = capabilities
      .filter((entry) => entry.requested)
      .map((entry) => entry.capabilityId);
    const blockedCapabilityIds = capabilities
      .filter((entry) => entry.status === 'blocked')
      .map((entry) => entry.capabilityId);
    const degradedCapabilityIds = capabilities
      .filter((entry) => entry.status === 'degraded' || entry.status === 'unavailable')
      .map((entry) => entry.capabilityId);

    return {
      schemaVersion: 1,
      generatedAt,
      source: 'CapabilityLoopGovernanceService',
      trustMode,
      sandboxTier,
      summary: this.buildSummary(requestedCapabilityIds, blockedCapabilityIds, degradedCapabilityIds),
      requestedCapabilityIds,
      blockedCapabilityIds,
      degradedCapabilityIds,
      capabilities,
    };
  }

  public listCatalog(): CapabilityCatalogEntry[] {
    return CAPABILITY_CATALOG.map((entry) => ({
      ...entry,
      trustModes: [...entry.trustModes],
      toolIds: [...entry.toolIds],
      metadataKeys: [...entry.metadataKeys],
    }));
  }

  private buildSignals(
    input: CapabilityLoopGovernanceInput,
    trustMode: TrustSliderLevel,
    sandboxTier: TrustSliderSandboxTier,
  ): CapabilitySignals {
    const responseDecision = recordOrNull(input.request.metadata?.responseDecision);
    const requestedTools = Array.from(new Set([
      ...normalizeList(input.request.requestedTools),
      ...normalizeList(responseDecision?.requestedTools),
      ...input.run.toolExposure.tools.map((tool) => tool.id),
      ...normalizeList(input.run.metadata.toolExposureHint && recordOrNull(input.run.metadata.toolExposureHint)?.recommendedToolNames),
    ]));
    return {
      requestedTools,
      exposedTools: input.run.toolExposure.tools,
      blockedToolIds: normalizeList(input.run.toolExposure.blockedTools?.map((tool) => tool.id)),
      metadata: input.run.metadata,
      trustMode,
      sandboxTier,
    };
  }

  private buildEntry(
    catalog: CapabilityCatalogEntry,
    run: UniversalAgentRun,
    signals: CapabilitySignals,
  ): StrongCapabilityLoopEntry {
    const exposedTools = signals.exposedTools.filter((tool) => catalog.toolIds.includes(tool.id));
    const exposedToolIds = exposedTools.map((tool) => tool.id);
    const blockedToolIds = signals.blockedToolIds.filter((toolId) => catalog.toolIds.includes(toolId));
    const requestedByTool = catalog.toolIds.some((toolId) => signals.requestedTools.includes(toolId));
    const requestedByMetadata = catalog.metadataKeys
      .filter((key) => key !== 'canonicalContextSummary')
      .some((key) => metadataHas(signals.metadata, key));
    const requested = requestedByTool || requestedByMetadata || this.isImplicitlyRequested(catalog, run, signals);
    const status = this.resolveStatus(catalog, run, signals, {
      requested,
      exposedTools,
      blockedToolIds,
    });
    const exposureProfile = this.buildExposureProfile(run.toolExposure.mode, catalog.toolIds, exposedTools, blockedToolIds);
    const receipts = this.buildReceipts(catalog, status, requested, exposureProfile, signals);
    const eventTitles = this.resolveEventTitles(catalog, run);
    const metadataKeys = catalog.metadataKeys.filter((key) => metadataHas(signals.metadata, key));

    return {
      capabilityId: catalog.capabilityId,
      label: catalog.label,
      status,
      requested,
      policy: {
        mode: catalog.policyMode,
        trustModes: [...catalog.trustModes],
        permission: catalog.permission,
        description: catalog.description,
      },
      exposureProfile,
      receipts,
      observability: {
        eventTitles,
        metadataKeys,
        receiptCount: receipts.length,
      },
      fallback: {
        honest: true,
        summary: catalog.fallback,
      },
      controlSurface: {
        statusPath: catalog.statusPath.replace(':runId', run.id),
        command: catalog.command.replace('<runId>', run.id),
      },
    };
  }

  private resolveStatus(
    catalog: CapabilityCatalogEntry,
    run: UniversalAgentRun,
    signals: CapabilitySignals,
    input: {
      requested: boolean;
      exposedTools: UniversalToolExposure[];
      blockedToolIds: string[];
    },
  ): StrongCapabilityStatus {
    if (!catalog.trustModes.includes(signals.trustMode)) {
      return input.requested ? 'blocked' : 'unavailable';
    }
    if (input.blockedToolIds.length > 0) {
      return 'blocked';
    }
    if (this.isCapabilityBlockedByMetadata(catalog, signals.metadata)) {
      return 'blocked';
    }
    if (this.isCapabilityDegradedByMetadata(catalog, signals.metadata)) {
      return 'degraded';
    }
    if (input.requested && run.status === 'waiting_approval' && input.exposedTools.some((tool) => tool.requiresApproval)) {
      return 'waiting_approval';
    }
    if (input.requested && this.hasCompletionMetadata(catalog, signals.metadata)) {
      return 'active';
    }
    if (input.requested) {
      return 'requested';
    }
    if (catalog.alwaysReady) {
      return 'ready';
    }
    return this.hasContextAvailability(catalog, run, signals.metadata) ? 'ready' : 'unavailable';
  }

  private buildExposureProfile(
    mode: UniversalToolExposureMode,
    toolIds: string[],
    exposedTools: UniversalToolExposure[],
    blockedToolIds: string[],
  ): StrongCapabilityLoopExposureProfile {
    const requiresApproval = exposedTools.some((tool) => tool.requiresApproval);
    const highestRisk = riskFromScore(Math.max(0, ...exposedTools.map((tool) => normalizeRisk(tool.risk))));
    return {
      mode,
      toolIds: [...toolIds],
      exposedToolIds: exposedTools.map((tool) => tool.id),
      blockedToolIds,
      risk: highestRisk,
      requiresApproval,
    };
  }

  private buildReceipts(
    catalog: CapabilityCatalogEntry,
    status: StrongCapabilityStatus,
    requested: boolean,
    exposure: StrongCapabilityLoopExposureProfile,
    signals: CapabilitySignals,
  ): StrongCapabilityLoopReceipt[] {
    const receipts: StrongCapabilityLoopReceipt[] = [
      {
        id: `${catalog.capabilityId}:policy`,
        kind: 'policy',
        source: 'CapabilityLoopGovernanceService',
        status,
        detail: `${catalog.policyMode} em ${signals.trustMode}/${signals.sandboxTier}.`,
      },
    ];
    if (requested) {
      receipts.push({
        id: `${catalog.capabilityId}:request`,
        kind: 'request',
        source: 'CapabilityLoopGovernanceService',
        status,
        detail: exposure.exposedToolIds.length > 0
          ? `Tools expostas: ${exposure.exposedToolIds.join(', ')}.`
          : 'Capability solicitada por contexto/metadata.',
      });
    }
    if (exposure.requiresApproval || status === 'waiting_approval') {
      receipts.push({
        id: `${catalog.capabilityId}:approval`,
        kind: 'approval',
        source: 'CapabilityLoopGovernanceService',
        status,
        detail: 'Approval ou preview humano requerido pela policy.',
      });
    }
    if (status === 'blocked') {
      receipts.push({
        id: `${catalog.capabilityId}:block`,
        kind: 'block',
        source: 'CapabilityLoopGovernanceService',
        status,
        detail: exposure.blockedToolIds.length > 0
          ? `Tools bloqueadas: ${exposure.blockedToolIds.join(', ')}.`
          : 'Capability bloqueada por trust/policy.',
      });
    }
    if (status === 'degraded' || status === 'unavailable') {
      receipts.push({
        id: `${catalog.capabilityId}:fallback`,
        kind: 'fallback',
        source: 'CapabilityLoopGovernanceService',
        status,
        detail: catalog.fallback,
      });
    }
    return receipts;
  }

  private isImplicitlyRequested(
    catalog: CapabilityCatalogEntry,
    run: UniversalAgentRun,
    signals: CapabilitySignals,
  ): boolean {
    if (catalog.capabilityId === 'nexus.surface') {
      return run.replyPorts.some((port) => port.label.toLowerCase() === 'nexus')
        || normalizeText(signals.metadata.surface).toLowerCase() === 'nexus'
        || normalizeText(signals.metadata.source).toLowerCase() === 'nexus-surface';
    }
    if (catalog.capabilityId === 'session.ownership' || catalog.capabilityId === 'timing.canonical') {
      return true;
    }
    if (catalog.capabilityId === 'mnemos.memory') {
      const summary = recordOrNull(signals.metadata.canonicalContextSummary);
      return Boolean(summary?.hasMemoryPrompt) || run.memorySignals.length > 0;
    }
    if (catalog.capabilityId === 'skills.snapshot') {
      const summary = recordOrNull(signals.metadata.canonicalContextSummary);
      const trust = recordOrNull(signals.metadata.importedCapabilityTrust);
      return Boolean(summary?.hasSkillPrompt) || Boolean(recordOrNull(trust?.skill));
    }
    if (catalog.capabilityId === 'mcp.snapshot') {
      const summary = recordOrNull(signals.metadata.canonicalContextSummary);
      const trust = recordOrNull(signals.metadata.importedCapabilityTrust);
      return Boolean(summary?.hasMcpSnapshot) || Boolean(recordOrNull(trust?.mcp));
    }
    return false;
  }

  private hasContextAvailability(
    catalog: CapabilityCatalogEntry,
    run: UniversalAgentRun,
    metadata: Record<string, unknown>,
  ): boolean {
    if (catalog.capabilityId === 'mnemos.memory') {
      const summary = recordOrNull(metadata.canonicalContextSummary);
      return Boolean(summary?.hasMemoryPrompt) || run.memorySignals.length > 0;
    }
    if (catalog.capabilityId === 'skills.snapshot') {
      const summary = recordOrNull(metadata.canonicalContextSummary);
      return Boolean(summary?.hasSkillPrompt);
    }
    if (catalog.capabilityId === 'mcp.snapshot') {
      const summary = recordOrNull(metadata.canonicalContextSummary);
      return Boolean(summary?.hasMcpSnapshot);
    }
    if (catalog.capabilityId === 'nexus.surface') {
      return run.replyPorts.some((port) => port.kind === 'web');
    }
    if (catalog.capabilityId === 'channel-mesh.bridge') {
      return run.replyPorts.length > 0;
    }
    return false;
  }

  private hasCompletionMetadata(
    catalog: CapabilityCatalogEntry,
    metadata: Record<string, unknown>,
  ): boolean {
    if (catalog.capabilityId === 'echo.hands') {
      return recordOrNull(metadata.echoHands)?.executed === true;
    }
    if (catalog.capabilityId === 'selfmod.supervised') {
      return Boolean(recordOrNull(metadata.selfModificationPreview)?.success)
        || Boolean(recordOrNull(metadata.selfModificationActionProposal)?.approvalOnly);
    }
    if (catalog.capabilityId === 'watchmode.computer-use') {
      return Boolean(recordOrNull(metadata.watchModeVisualProposal)?.watchModeServiceCalled);
    }
    if (catalog.capabilityId === 'swarm.escalation') {
      return Boolean(recordOrNull(metadata.swarmEscalationProposal)?.launchServiceCalled);
    }
    return false;
  }

  private isCapabilityBlockedByMetadata(
    catalog: CapabilityCatalogEntry,
    metadata: Record<string, unknown>,
  ): boolean {
    if (catalog.capabilityId === 'watchmode.computer-use') {
      return recordOrNull(metadata.watchModeVisualProposal)?.blocked === true;
    }
    const trust = recordOrNull(metadata.trustSlider);
    if (trust?.blocked === true) {
      const blockedTools = normalizeList(catalog.toolIds);
      return blockedTools.length === 0 || blockedTools.some((toolId) => normalizeList(metadata.requestedTools).includes(toolId));
    }
    return false;
  }

  private isCapabilityDegradedByMetadata(
    catalog: CapabilityCatalogEntry,
    metadata: Record<string, unknown>,
  ): boolean {
    if (catalog.capabilityId === 'echo.hands') {
      const echoHands = recordOrNull(metadata.echoHands);
      return echoHands ? echoHands.executed === false : false;
    }
    if (catalog.capabilityId === 'selfmod.supervised') {
      const proposal = recordOrNull(metadata.selfModificationActionProposal);
      return Boolean(proposal?.missingTarget);
    }
    if (catalog.capabilityId === 'skills.snapshot' || catalog.capabilityId === 'mcp.snapshot') {
      const trust = recordOrNull(metadata.importedCapabilityTrust);
      const key = catalog.capabilityId === 'skills.snapshot' ? 'skill' : 'mcp';
      const summary = recordOrNull(trust?.[key]);
      return Number(summary?.quarantined || 0) > 0;
    }
    return false;
  }

  private resolveEventTitles(catalog: CapabilityCatalogEntry, run: UniversalAgentRun): string[] {
    const needles = [
      catalog.label,
      ...catalog.toolIds,
      ...catalog.metadataKeys,
      catalog.capabilityId.split('.')[0],
    ].map((value) => value.toLowerCase());
    return Array.from(new Set(run.events
      .filter((event) => {
        const haystack = `${event.title} ${event.detail || ''}`.toLowerCase();
        return needles.some((needle) => needle && haystack.includes(needle));
      })
      .map((event) => event.title)));
  }

  private buildSummary(
    requested: StrongCapabilityId[],
    blocked: StrongCapabilityId[],
    degraded: StrongCapabilityId[],
  ): string {
    return [
      `${requested.length} capability forte solicitada(s).`,
      `${blocked.length} bloqueada(s).`,
      `${degraded.length} degradada(s)/indisponivel(is).`,
    ].join(' ');
  }

  private resolveTrustMode(metadata: Record<string, unknown>): TrustSliderLevel {
    const trustSlider = recordOrNull(metadata.trustSlider);
    const level = normalizeText(trustSlider?.level).toLowerCase();
    if (level === 'protected' || level === 'collaborator' || level === 'overlord') {
      return level;
    }
    return 'collaborator';
  }

  private resolveSandboxTier(metadata: Record<string, unknown>): TrustSliderSandboxTier {
    const trustSlider = recordOrNull(metadata.trustSlider);
    const sandboxTier = normalizeText(trustSlider?.sandboxTier).toLowerCase();
    if (sandboxTier === 'safe-core' || sandboxTier === 'workspace-scoped' || sandboxTier === 'host-scoped') {
      return sandboxTier;
    }
    return 'workspace-scoped';
  }
}
