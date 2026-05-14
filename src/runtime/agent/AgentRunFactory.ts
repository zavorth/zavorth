import { resolveAgentGatewayTraceId } from './AgentGatewayTelemetry.js';
import type { ModelPickerContract, SelectedModelProfile } from '../../contracts/ModelPickerContract.js';
import { decideNaturalFirstRuntimeEntrypoint } from '../../contracts/NaturalFirstAgentRuntimeContract.js';
import { AgentRunCanonicalContextService } from './AgentRunCanonicalContextService.js';
import { NaturalCapabilityDiscoveryService } from './NaturalCapabilityDiscoveryService.js';
import { NaturalFirstRunClassifier } from './NaturalFirstRunClassifier.js';
import { ZavorthSubagentAutoInvocationPolicyService } from '../../services/ZavorthSubagentAutoInvocationPolicyService.js';
import { ToolExposurePolicy, type ToolExposurePolicyHintProfile } from './ToolExposurePolicy.js';
import { UniversalPreviewModeService } from './UniversalPreviewModeService.js';
import type {
  UniversalAgentModelProfile,
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalReplyPort,
} from './UniversalAgentRuntimeTypes.js';

export type AgentRunFactoryRuntime = {
  now: () => Date;
  idFactory: (prefix: string) => string;
  toolPolicy: ToolExposurePolicy;
  canonicalContextService: AgentRunCanonicalContextService;
  defaultProviderLabel: string;
  defaultModelLabel: string;
  modelPickerContractService?: AgentRunModelPickerContractService | null;
  naturalCapabilityDiscovery?: NaturalCapabilityDiscoveryService | null;
  subagentAutoInvocationPolicy?: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'> | null;
  universalPreviewMode?: UniversalPreviewModeService | null;
};

export type AgentRunModelPickerContractService = {
  buildContract(options?: { includeAdvanced?: boolean }): ModelPickerContract;
};

type ImportedCapabilityTrustSummary = {
  trusted: number;
  safe: number;
  quarantined: number;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeStringList(value: unknown): string[] {
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

function titleFromText(text: string): string {
  const normalized = normalizeText(text, 'Nova solicitacao');
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

function emptyImportedCapabilityTrustSummary(): ImportedCapabilityTrustSummary {
  return {
    trusted: 0,
    safe: 0,
    quarantined: 0,
  };
}

function normalizeTrustCount(value: unknown): number {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function normalizeImportedCapabilityTrustSummary(value: unknown): ImportedCapabilityTrustSummary | null {
  const record = recordOrNull(value);
  if (!record) {
    return null;
  }
  return {
    trusted: normalizeTrustCount(record.trusted),
    safe: normalizeTrustCount(record.safe),
    quarantined: normalizeTrustCount(record.quarantined),
  };
}

function addImportedCapabilityTrustSummary(
  left: ImportedCapabilityTrustSummary,
  right: ImportedCapabilityTrustSummary | null,
): ImportedCapabilityTrustSummary {
  if (!right) {
    return left;
  }
  return {
    trusted: left.trusted + right.trusted,
    safe: left.safe + right.safe,
    quarantined: left.quarantined + right.quarantined,
  };
}

function normalizeRiskReports(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(recordOrNull)
    .filter((report): report is Record<string, unknown> => Boolean(report))
    .map((report) => ({ ...report }));
}

function isQuarantinedRiskReport(report: Record<string, unknown>): boolean {
  return report.quarantined === true
    || report.trustState === 'quarantined'
    || report.canExposeTools === false;
}

function resolveImportedCapabilityBlockedTools(riskReports: Record<string, unknown>[]): string[] {
  const blockedTools: string[] = [];
  for (const report of riskReports) {
    if (!isQuarantinedRiskReport(report)) {
      continue;
    }

    const reportToolNames = normalizeStringList(report.toolNames);
    if (reportToolNames.length > 0) {
      blockedTools.push(...reportToolNames);
    } else {
      blockedTools.push(normalizeText(report.id));
    }
  }

  return Array.from(new Set(blockedTools.filter(Boolean)));
}

function resolveColdContextMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | null {
  const direct = recordOrNull(metadata?.coldContext);
  if (direct) {
    return direct;
  }

  const context = recordOrNull(metadata?.context) || recordOrNull(metadata?.canonicalContext);
  const cold = recordOrNull(context?.cold);
  return recordOrNull(cold?.metadata) || recordOrNull(metadata?.coldContextMetadata);
}

function buildImportedCapabilityTrustMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | null {
  const coldContext = resolveColdContextMetadata(metadata);
  if (!coldContext) {
    return null;
  }

  const skillContext = recordOrNull(coldContext.skillContext);
  const mcpContext = recordOrNull(coldContext.mcpContext);
  const skillSummary = normalizeImportedCapabilityTrustSummary(skillContext?.trustSummary);
  const mcpSummary = normalizeImportedCapabilityTrustSummary(mcpContext?.trustSummary);
  const riskReports = [
    ...normalizeRiskReports(skillContext?.riskReports),
    ...normalizeRiskReports(mcpContext?.riskReports),
  ];

  if (!skillSummary && !mcpSummary && riskReports.length === 0) {
    return null;
  }

  const skill = skillSummary || emptyImportedCapabilityTrustSummary();
  const mcp = mcpSummary || emptyImportedCapabilityTrustSummary();
  const total = addImportedCapabilityTrustSummary(
    addImportedCapabilityTrustSummary(emptyImportedCapabilityTrustSummary(), skill),
    mcp,
  );
  const hasQuarantined = total.quarantined > 0
    || riskReports.some((report) => report.quarantined === true || report.trustState === 'quarantined');
  const blockedTools = resolveImportedCapabilityBlockedTools(riskReports);

  return {
    source: 'ColdContextResolver',
    skill,
    mcp,
    total,
    riskReports,
    hasQuarantined,
    ...(blockedTools.length > 0 ? { blockedTools } : {}),
    toolExposureGatedByImportedCapabilityTrust: blockedTools.length > 0,
  };
}

function resolveToolHintProfile(metadata?: Record<string, unknown>): ToolExposurePolicyHintProfile | null {
  const candidate = metadata?.toolHintProfile;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const recommendedToolNames = normalizeStringList(record.recommendedToolNames);
  const groups = normalizeStringList(record.groups);
  const intentCategory = normalizeText(record.intentCategory);
  const reason = normalizeText(record.reason);
  if (recommendedToolNames.length === 0 && groups.length === 0 && !intentCategory && !reason) {
    return null;
  }

  return {
    intentCategory: intentCategory || null,
    groups,
    recommendedToolNames,
    toolExposureGatedByCognitiveFirewall: false,
    isHardGate: false,
    reason: reason || undefined,
  };
}

function buildToolExposureHintMetadata(
  toolHintProfile: ToolExposurePolicyHintProfile | null,
): Record<string, unknown> | null {
  if (!toolHintProfile) {
    return null;
  }
  const metadata: Record<string, unknown> = {
    source: 'toolHintProfile',
    intentCategory: toolHintProfile.intentCategory ?? null,
    groups: toolHintProfile.groups || [],
    recommendedToolNames: toolHintProfile.recommendedToolNames || [],
    toolExposureGatedByCognitiveFirewall: false,
    isHardGate: false,
    usedAsPolicyInput: true,
  };
  if (toolHintProfile.reason) {
    metadata.reason = toolHintProfile.reason;
  }
  return metadata;
}

function mergeToolHintProfiles(
  explicit: ToolExposurePolicyHintProfile | null,
  discovered: ToolExposurePolicyHintProfile | null,
): ToolExposurePolicyHintProfile | null {
  if (!explicit) {
    return discovered;
  }
  if (!discovered) {
    return explicit;
  }
  return {
    intentCategory: explicit.intentCategory || discovered.intentCategory || null,
    groups: Array.from(new Set([
      ...(explicit.groups || []),
      ...(discovered.groups || []),
    ])),
    recommendedToolNames: Array.from(new Set([
      ...(explicit.recommendedToolNames || []),
      ...(discovered.recommendedToolNames || []),
    ])),
    toolExposureGatedByCognitiveFirewall: false,
    isHardGate: false,
    reason: [
      explicit.reason,
      discovered.reason,
    ].filter(Boolean).join(' | ') || undefined,
  };
}

export class AgentRunFactory {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly toolPolicy: ToolExposurePolicy;
  private readonly canonicalContextService: AgentRunCanonicalContextService;
  private readonly defaultProviderLabel: string;
  private readonly defaultModelLabel: string;
  private readonly modelPickerContractService: AgentRunModelPickerContractService | null;
  private readonly naturalCapabilityDiscovery: NaturalCapabilityDiscoveryService;
  private readonly naturalFirstRunClassifier: NaturalFirstRunClassifier;
  private readonly subagentAutoInvocationPolicy: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'>;
  private readonly universalPreviewMode: UniversalPreviewModeService;

  constructor(runtime: AgentRunFactoryRuntime) {
    this.now = runtime.now;
    this.idFactory = runtime.idFactory;
    this.toolPolicy = runtime.toolPolicy;
    this.canonicalContextService = runtime.canonicalContextService;
    this.defaultProviderLabel = runtime.defaultProviderLabel;
    this.defaultModelLabel = runtime.defaultModelLabel;
    this.modelPickerContractService = runtime.modelPickerContractService || null;
    this.naturalCapabilityDiscovery = runtime.naturalCapabilityDiscovery || new NaturalCapabilityDiscoveryService({
      now: this.now,
    });
    this.naturalFirstRunClassifier = new NaturalFirstRunClassifier();
    this.subagentAutoInvocationPolicy = runtime.subagentAutoInvocationPolicy || new ZavorthSubagentAutoInvocationPolicyService();
    this.universalPreviewMode = runtime.universalPreviewMode || new UniversalPreviewModeService({
      now: this.now,
    });
  }

  public createRun(input: UniversalAgentRequest): UniversalAgentRun {
    const now = this.now().toISOString();
    const requestId = normalizeText(input.requestId, this.idFactory('request'));
    const runId = this.idFactory('agent-run');
    const sessionId = normalizeText(input.sessionId, `${input.channel || 'unknown'}:${requestId}`);
    const traceId = resolveAgentGatewayTraceId({
      channel: input.channel || 'unknown',
      requestId,
      sessionId,
      traceId: input.traceId,
      metadata: input.metadata,
    });
    const text = normalizeText(input.text, '(pedido vazio)');
    const naturalFirstRoute = this.naturalFirstRunClassifier.classify({
      text,
      channel: input.channel || 'unknown',
      userId: input.userId,
      sessionId,
      workspace: input.workspace,
      requestedTools: input.requestedTools,
      metadata: input.metadata,
    });
    const naturalFirstEntrypoint = decideNaturalFirstRuntimeEntrypoint(text);
    const canonicalContextResult = this.canonicalContextService.buildMetadata(input, {
      traceId,
      sessionId,
    });
    const metadataForPolicy = canonicalContextResult.metadata;
    const importedCapabilityTrust = buildImportedCapabilityTrustMetadata(metadataForPolicy);
    const discoveryMetadata = importedCapabilityTrust
      ? {
        ...metadataForPolicy,
        importedCapabilityTrust,
      }
      : metadataForPolicy;
    const naturalCapabilityDiscovery = this.naturalCapabilityDiscovery.discover({
      text,
      surface: input.channel || 'unknown',
      requestedTools: input.requestedTools,
      metadata: discoveryMetadata,
      generatedAt: now,
    });
    const metadataAttachments = input.metadata?.attachments;
    const subagentAutoDecision = this.subagentAutoInvocationPolicy.decide({
      text,
      channel: input.channel || 'unknown',
      mode: normalizeText(input.metadata?.mode, 'default'),
      taskKind: normalizeText(naturalCapabilityDiscovery.intentCategory),
      taskSubtype: normalizeText(input.metadata?.taskSubtype),
      hasInlineData: Array.isArray(metadataAttachments) && metadataAttachments.length > 0,
      allowImplicit: input.metadata?.autoLiveSubagents !== false,
    });
    const subagentAutoInvocation = subagentAutoDecision.shouldInvoke || subagentAutoDecision.requiresApproval
      ? {
        ...subagentAutoDecision.telemetry,
        generatedAt: now,
      }
      : null;
    const toolHintProfile = mergeToolHintProfiles(
      resolveToolHintProfile(metadataForPolicy),
      naturalCapabilityDiscovery.toolHintProfile,
    );
    const toolExposure = this.toolPolicy.buildProfile({
      requestedTools: input.requestedTools,
      allowedTools: Array.isArray(input.metadata?.allowedTools) ? input.metadata.allowedTools.map(String) : [],
      requireApprovalFor: Array.isArray(input.metadata?.requireApprovalFor)
        ? input.metadata.requireApprovalFor.map(String)
        : [],
      blockedTools: normalizeStringList(importedCapabilityTrust?.blockedTools),
      blockedToolReason: 'blocked-by-imported-capability-trust',
      toolHintProfile,
    });
    const universalPreviewMode = this.universalPreviewMode.buildSnapshot({
      runId,
      traceId,
      requestId,
      sessionId,
      text,
      surface: input.channel || 'unknown',
      requestedTools: input.requestedTools,
      toolExposure,
      naturalCapabilityDiscovery,
      metadata: input.metadata,
      generatedAt: now,
    });
    const toolExposureHint = buildToolExposureHintMetadata(toolHintProfile);
    const modelPickerContract = this.readModelPickerContract();
    const modelPickerSelection = this.toModelPickerSelectionMetadata(modelPickerContract?.selected || null);
    const modelProfile = this.buildModelProfile(input.modelProfile, modelPickerContract?.selected || null);
    const replyPorts = this.buildReplyPorts(input);

    return {
      id: runId,
      traceId,
      requestId,
      sessionId,
      userId: normalizeText(input.userId, 'operator'),
      channel: input.channel || 'unknown',
      title: titleFromText(text),
      input: text,
      workspace: input.workspace ?? null,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      summary: 'Execucao recebida pelo runtime universal.',
      events: [
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'input',
          title: 'Pedido recebido',
          detail: text,
          status: 'done',
          createdAt: now,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Contrato natural-first aplicado',
          detail: `${naturalFirstEntrypoint.entrypoint}: ${naturalFirstEntrypoint.reason}`,
          status: 'done',
          createdAt: now,
          metadata: naturalFirstEntrypoint,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Roteamento natural-first',
          detail: `${naturalFirstRoute.route}: ${naturalFirstRoute.reason}`,
          status: 'done',
          createdAt: now,
          metadata: naturalFirstRoute,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Plano inicial preparado',
          detail: 'O pedido entrou pelo gateway universal e esta pronto para roteamento.',
          status: 'done',
          createdAt: now,
        },
        ...this.buildModelPickerEvents(modelPickerSelection, runId, now),
      ],
      toolExposure,
      replyPorts,
      modelProfile,
      approvals: [],
      artifacts: [],
      memorySignals: [],
      metadata: {
        ...metadataForPolicy,
        naturalFirstEntrypoint,
        naturalFirstRoute,
        ...(toolExposureHint ? { toolExposureHint } : {}),
        naturalCapabilityDiscovery,
        ...(subagentAutoInvocation ? { subagentAutoInvocation } : {}),
        universalPreviewMode,
        ...(importedCapabilityTrust ? { importedCapabilityTrust } : {}),
        ...(modelPickerSelection ? { modelPickerSelection } : {}),
        adapterSource: 'universal-agent-runtime',
      },
    };
  }

  private buildModelProfile(
    input?: Partial<UniversalAgentModelProfile>,
    selected: SelectedModelProfile | null = null,
  ): UniversalAgentModelProfile {
    return {
      providerLabel: normalizeText(input?.providerLabel, selected?.providerLabel || this.defaultProviderLabel),
      modelLabel: normalizeText(input?.modelLabel, selected?.modelLabel || this.defaultModelLabel),
      routingPolicy: input?.routingPolicy || 'unknown',
      fallbackModelLabel: normalizeText(input?.fallbackModelLabel)
        || (selected?.fallbackOrder?.[1] ? selected.fallbackOrder[1] : undefined),
      routeId: normalizeText(input?.routeId, selected?.routeId) || undefined,
      familyId: normalizeText(input?.familyId, selected?.familyId) || undefined,
      selectionSource: input?.selectionSource || selected?.source,
      readiness: input?.readiness || selected?.readiness,
      ready: typeof input?.ready === 'boolean' ? input.ready : selected?.ready,
      fallbackOrder: input?.fallbackOrder ? [...input.fallbackOrder] : selected ? [...selected.fallbackOrder] : undefined,
      selectionExplanation: input?.selectionExplanation
        ? [...input.selectionExplanation]
        : selected
          ? [...selected.explanation]
          : undefined,
      supportsTools: input?.supportsTools,
      supportsVision: input?.supportsVision,
      supportsStreaming: input?.supportsStreaming,
    };
  }

  private readModelPickerContract(): ModelPickerContract | null {
    if (!this.modelPickerContractService) {
      return null;
    }
    try {
      return this.modelPickerContractService.buildContract({ includeAdvanced: true });
    } catch {
      return null;
    }
  }

  private toModelPickerSelectionMetadata(
    selected: SelectedModelProfile | null,
  ): Record<string, unknown> | null {
    if (!selected) {
      return null;
    }
    return {
      schemaVersion: selected.schemaVersion,
      source: selected.source,
      providerName: selected.providerName,
      providerLabel: selected.providerLabel,
      modelName: selected.modelName,
      modelLabel: selected.modelLabel,
      routeId: selected.routeId,
      familyId: selected.familyId,
      readiness: selected.readiness,
      ready: selected.ready,
      fallbackOrder: [...selected.fallbackOrder],
      explanation: [...selected.explanation],
    };
  }

  private buildModelPickerEvents(
    selection: Record<string, unknown> | null,
    runId: string,
    now: string,
  ): UniversalAgentRun['events'] {
    if (!selection) {
      return [];
    }
    return [
      {
        id: this.idFactory('agent-event'),
        runId,
        kind: 'planning',
        title: 'Model Picker aplicado',
        detail: `Selecao atual: ${selection.providerLabel}/${selection.modelLabel} (${selection.readiness}).`,
        status: 'done',
        createdAt: now,
        metadata: {
          source: 'ModelPickerContract',
          selected: selection,
        },
      },
    ];
  }

  private buildReplyPorts(input: UniversalAgentRequest): UniversalReplyPort[] {
    if (input.replyPort) {
      return [input.replyPort];
    }

    return [
      {
        id: `${input.channel || 'unknown'}:primary`,
        label: input.channel === 'web'
          ? 'Command Center'
          : input.channel === 'cli'
            ? 'Terminal'
            : input.channel === 'telegram'
              ? 'Telegram'
              : 'Canal de origem',
        kind: input.channel || 'unknown',
        status: 'available',
        primary: true,
        description: 'Porta de resposta criada pelo gateway universal.',
      },
    ];
  }
}
