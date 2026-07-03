import { resolveAgentGatewayTraceId } from './AgentGatewayTelemetry.js';
import type { ModelPickerContract, SelectedModelProfile } from '../../contracts/ModelPickerContract.js';
import { decideNaturalFirstRuntimeEntrypoint } from '../../contracts/NaturalFirstAgentRuntimeContract.js';
import { AgentRunCanonicalContextService } from './AgentRunCanonicalContextService.js';
import { NaturalCapabilityDiscoveryService } from './NaturalCapabilityDiscoveryService.js';
import { NaturalFirstRunClassifier } from './NaturalFirstRunClassifier.js';
import { AgenticRouteClassifier } from './AgenticRouteClassifier.js';
import { ZavorthSubagentAutoInvocationPolicyService } from '../../services/ZavorthSubagentAutoInvocationPolicyService.js';
import { ToolExposurePolicy, type ToolExposurePolicyHintProfile } from './ToolExposurePolicy.js';
import { UniversalPreviewModeService } from './UniversalPreviewModeService.js';
import { ZavorthAgentKernelSnapshotService } from '../../services/ZavorthAgentKernelSnapshotService.js';
import {
  ProfileManifestService,
} from '../../services/ProfileManifestService.js';
import type {
  ProfileRuntimeBundle,
} from '../../contracts/ProfileManifestContract.js';
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
  profileManifestService?: Pick<ProfileManifestService, 'compileProfileById'> | null;
  agentKernelSnapshotService?: Pick<ZavorthAgentKernelSnapshotService, 'buildSnapshotSync'> | null;
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
  const normalized = normalizeText(text, 'New request');
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
    quarantinedToolNames: normalizeStringList(record.quarantinedToolNames),
    toolExposureGatedByCognitiveFirewall: record.toolExposureGatedByCognitiveFirewall === true,
    isHardGate: record.isHardGate === true,
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
    quarantinedToolNames: toolHintProfile.quarantinedToolNames || [],
    toolExposureGatedByCognitiveFirewall: toolHintProfile.toolExposureGatedByCognitiveFirewall === true,
    isHardGate: toolHintProfile.isHardGate === true,
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
    quarantinedToolNames: Array.from(new Set([
      ...(explicit.quarantinedToolNames || []),
      ...(discovered.quarantinedToolNames || []),
    ])),
    toolExposureGatedByCognitiveFirewall: explicit.toolExposureGatedByCognitiveFirewall === true
      || discovered.toolExposureGatedByCognitiveFirewall === true,
    isHardGate: explicit.isHardGate === true || discovered.isHardGate === true,
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
  private readonly agenticRouteClassifier: AgenticRouteClassifier;
  private readonly subagentAutoInvocationPolicy: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'>;
  private readonly universalPreviewMode: UniversalPreviewModeService;
  private readonly profileManifestService: Pick<ProfileManifestService, 'compileProfileById'>;
  private readonly agentKernelSnapshotService: Pick<ZavorthAgentKernelSnapshotService, 'buildSnapshotSync'>;

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
    this.agenticRouteClassifier = new AgenticRouteClassifier();
    this.subagentAutoInvocationPolicy = runtime.subagentAutoInvocationPolicy || new ZavorthSubagentAutoInvocationPolicyService();
    this.universalPreviewMode = runtime.universalPreviewMode || new UniversalPreviewModeService({
      now: this.now,
    });
    this.profileManifestService = runtime.profileManifestService || new ProfileManifestService();
    this.agentKernelSnapshotService = runtime.agentKernelSnapshotService || new ZavorthAgentKernelSnapshotService({
      now: this.now,
      profileManifestService: this.profileManifestService,
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
    const text = normalizeText(input.text, '(empty request)');
    const naturalFirstRoute = this.naturalFirstRunClassifier.classify({
      text,
      channel: input.channel || 'unknown',
      userId: input.userId,
      sessionId,
      workspace: input.workspace,
      requestedTools: input.requestedTools,
      metadata: input.metadata,
    });
    const agenticRoute = this.agenticRouteClassifier.decide({
      request: input,
      naturalFirst: naturalFirstRoute,
    });
    const naturalFirstEntrypoint = decideNaturalFirstRuntimeEntrypoint(text);
    const canonicalContextResult = this.canonicalContextService.buildMetadata(input, {
      traceId,
      sessionId,
    });
    const profileResolution = this.resolveProfileRuntimeBundle(input, canonicalContextResult.metadata);
    const metadataForPolicy = {
      ...canonicalContextResult.metadata,
      profile: profileResolution.profileId,
      profileSource: profileResolution.source,
      ...(profileResolution.profileBundle ? {
        profileBundle: profileResolution.profileBundle,
        profileRuntimeBundle: profileResolution.profileBundle,
        cognitiveContextBundle: profileResolution.profileBundle.cognitiveContextBundle,
        runtimePolicyBundle: profileResolution.profileBundle.runtimePolicyBundle,
        surfaceExperienceBundle: profileResolution.profileBundle.surfaceExperienceBundle,
      } : {
        profileBundleMissing: {
          requested: profileResolution.profileId,
          source: profileResolution.source,
        },
      }),
    };
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
    const exposeProfileCapabilities = this.shouldExposeProfileCapabilities(
      profileResolution.source,
      input.metadata,
    );
    const toolExposure = this.toolPolicy.buildProfile({
      requestedTools: input.requestedTools,
      allowedTools: unique([
        ...(Array.isArray(input.metadata?.allowedTools) ? input.metadata.allowedTools.map(String) : []),
        ...(exposeProfileCapabilities ? profileResolution.profileBundle?.capabilityPolicy.allow || [] : []),
      ]),
      requireApprovalFor: unique([
        ...(Array.isArray(input.metadata?.requireApprovalFor)
          ? input.metadata.requireApprovalFor.map(String)
          : []),
        ...(exposeProfileCapabilities ? profileResolution.profileBundle?.capabilityPolicy.requireApproval || [] : []),
      ]),
      blockedTools: normalizeStringList(importedCapabilityTrust?.blockedTools),
      blockedToolReason: 'blocked-by-imported-capability-trust',
      toolHintProfile,
      metadata: discoveryMetadata,
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
    const agentKernelSnapshot = this.agentKernelSnapshotService.buildSnapshotSync({
      projectRoot: normalizeText(input.metadata?.projectRoot) || process.cwd(),
      text,
      channel: input.channel,
      profileId: profileResolution.profileId,
      profileSource: profileResolution.source,
      profileBundle: profileResolution.profileBundle,
      modelProfile,
      includeProviderActivation: false,
    });
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
      summary: 'Request received by Zavorth.',
      events: [
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'input',
          title: 'Request received',
          detail: text,
          status: 'done',
          createdAt: now,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Natural-first contract applied',
          detail: `${naturalFirstEntrypoint.entrypoint}: ${naturalFirstEntrypoint.reason}`,
          status: 'done',
          createdAt: now,
          metadata: naturalFirstEntrypoint,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Natural-first routing',
          detail: `${naturalFirstRoute.route}: ${naturalFirstRoute.reason}`,
          status: 'done',
          createdAt: now,
          metadata: naturalFirstRoute,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Agentic routing',
          detail: `${agenticRoute.userFacingLabel}: ${agenticRoute.explanation}`,
          status: agenticRoute.requiresApproval ? 'pending' : 'done',
          createdAt: now,
          metadata: agenticRoute,
        },
        {
          id: this.idFactory('agent-event'),
          runId,
          kind: 'planning',
          title: 'Initial plan prepared',
          detail: 'The request entered through the universal gateway and is ready for routing.',
          status: 'done',
          createdAt: now,
        },
        ...this.buildModelPickerEvents(modelPickerSelection, runId, now),
      ],
      toolExposure,
      replyPorts,
      modelProfile,
      approvals: [],
      steering: [],
      artifacts: [],
      memorySignals: [],
      metadata: {
        ...metadataForPolicy,
        naturalFirstEntrypoint,
        naturalFirstRoute,
        agenticRoute,
        ...(toolExposureHint ? { toolExposureHint } : {}),
        naturalCapabilityDiscovery,
        ...(subagentAutoInvocation ? { subagentAutoInvocation } : {}),
        universalPreviewMode,
        ...(importedCapabilityTrust ? { importedCapabilityTrust } : {}),
        ...(modelPickerSelection ? { modelPickerSelection } : {}),
        agentKernelSnapshot,
        capabilityPassport: agentKernelSnapshot.capabilityPassport,
        intentDecision: agentKernelSnapshot.intentDecision,
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
        detail: `Current selection: ${selection.providerLabel}/${selection.modelLabel} (${selection.readiness}).`,
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
          ? 'ZavorthControl'
          : input.channel === 'cli'
            ? 'Terminal'
            : input.channel === 'telegram'
              ? 'Telegram'
              : 'Origin channel',
        kind: input.channel || 'unknown',
        status: 'available',
        primary: true,
        description: 'Reply port created by the universal gateway.',
      },
    ];
  }

  private resolveProfileRuntimeBundle(
    input: UniversalAgentRequest,
    metadata: Record<string, unknown>,
  ): {
    profileId: string;
    source: 'request' | 'metadata' | 'environment' | 'default' | 'fallback';
    profileBundle: ProfileRuntimeBundle | null;
  } {
    const requested = this.resolveRequestedProfileId(input, metadata);
    const selectedId = requested.profileId || 'personal';
    const selected = this.profileManifestService.compileProfileById(selectedId);
    if (selected) {
      return {
        profileId: selected.id,
        source: requested.source || 'default',
        profileBundle: selected,
      };
    }

    const fallback = this.profileManifestService.compileProfileById('personal')
      || this.profileManifestService.compileProfileById('developer');
    return {
      profileId: fallback?.id || selectedId,
      source: fallback ? 'fallback' : (requested.source || 'default'),
      profileBundle: fallback,
    };
  }

  private resolveRequestedProfileId(
    input: UniversalAgentRequest,
    metadata: Record<string, unknown>,
  ): { profileId: string; source: 'request' | 'metadata' | 'environment' | 'default' | null } {
    const inputMetadata = recordOrNull(input.metadata) || {};
    const nestedInputProfile = recordOrNull(inputMetadata.profile);
    const nestedMetadataProfile = recordOrNull(metadata.profile);
    const requestProfile = firstNormalizedProfileId([
      inputMetadata.profileId,
      inputMetadata.profile,
      inputMetadata.experienceProfile,
      nestedInputProfile?.id,
      nestedInputProfile?.profileId,
    ]);
    if (requestProfile) return { profileId: requestProfile, source: 'request' };

    const metadataProfile = firstNormalizedProfileId([
      metadata.profileId,
      metadata.profile,
      metadata.experienceProfile,
      nestedMetadataProfile?.id,
      nestedMetadataProfile?.profileId,
    ]);
    if (metadataProfile) return { profileId: metadataProfile, source: 'metadata' };

    const environmentProfile = firstNormalizedProfileId([
      process.env.ZAVORTH_PROFILE,
      process.env.ZAVORTH_EXPERIENCE_PROFILE,
    ]);
    if (environmentProfile) return { profileId: environmentProfile, source: 'environment' };

    return { profileId: '', source: 'default' };
  }

  private shouldExposeProfileCapabilities(
    source: 'request' | 'metadata' | 'environment' | 'default' | 'fallback',
    metadata: Record<string, unknown> | undefined,
  ): boolean {
    const override = normalizeBooleanFlag(
      metadata?.profileCapabilities,
      metadata?.profileCapabilityExposure,
      metadata?.exposeProfileTools,
      metadata?.exposeProfileCapabilities,
    );
    if (override !== null) {
      return override;
    }
    return source !== 'default';
  }
}

function firstNormalizedProfileId(values: unknown[]): string {
  for (const value of values) {
    if (value && typeof value === 'object') continue;
    const normalized = normalizeProfileId(value);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeProfileId(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function normalizeBooleanFlag(...values: unknown[]): boolean | null {
  for (const value of values) {
    const normalized = normalizeText(value).toLowerCase();
    if (['true', '1', 'yes', 'on', 'enabled', 'expose'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off', 'disabled', 'hide'].includes(normalized)) {
      return false;
    }
  }
  return null;
}
