import { withAgentGatewayTraceMetadata } from './AgentGatewayTelemetry.js';
import {
  CanonicalSessionContextAssembler,
  LightweightRunProfileClassifier,
  type CanonicalColdContextInput,
  type CanonicalHotContextInput,
  type CanonicalIdentityFile,
  type CanonicalSessionContextSnapshot,
  type CanonicalWarmContextInput,
} from './context/index.js';
import type { UniversalAgentRequest } from './UniversalAgentRuntimeTypes.js';

export type AgentRunCanonicalContextRuntime = {
  contextAssembler?: CanonicalSessionContextAssembler | null;
  runProfileClassifier?: LightweightRunProfileClassifier | null;
};

export type AgentRunCanonicalContextCorrelation = {
  traceId: string;
  sessionId: string;
};

export type AgentRunCanonicalContextBuildResult = {
  canonicalContext: CanonicalSessionContextSnapshot;
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export class AgentRunCanonicalContextService {
  private readonly contextAssembler: CanonicalSessionContextAssembler;
  private readonly runProfileClassifier: LightweightRunProfileClassifier;

  constructor(runtime: AgentRunCanonicalContextRuntime = {}) {
    this.contextAssembler = runtime.contextAssembler || new CanonicalSessionContextAssembler();
    this.runProfileClassifier = runtime.runProfileClassifier || new LightweightRunProfileClassifier();
  }

  public buildMetadata(
    input: UniversalAgentRequest,
    correlation: AgentRunCanonicalContextCorrelation,
  ): AgentRunCanonicalContextBuildResult {
    const canonicalContext = this.buildSnapshot(input, correlation);
    const baseMetadata = withAgentGatewayTraceMetadata(input.metadata, correlation.traceId);
    return {
      canonicalContext,
      metadata: this.mergeMetadata(baseMetadata, canonicalContext),
    };
  }

  public buildSnapshot(
    input: UniversalAgentRequest,
    correlation: AgentRunCanonicalContextCorrelation,
  ): CanonicalSessionContextSnapshot {
    const metadata = input.metadata || {};
    const contextInput = this.resolveProvidedContext(metadata);
    const hot = this.resolveHotContextInput(metadata, contextInput);
    const warm = this.resolveWarmContextInput(metadata, contextInput);
    const cold = this.resolveColdContextInput(metadata, contextInput);
    const inheritedDepth = this.resolveProvidedContextDepth(metadata, contextInput);
    const classifierMetadata = inheritedDepth && !metadata.contextDepth
      ? { ...metadata, contextDepth: inheritedDepth }
      : metadata;
    const profile = this.runProfileClassifier.classify({
      request: {
        text: input.text,
        workspace: input.workspace,
        requestedTools: input.requestedTools,
        metadata: classifierMetadata,
      },
      hasWorkspaceProfile: Boolean(warm.workspacePrompt || warm.workspaceProfile || warm.identityFiles?.length),
      hasMemoryContext: Boolean(cold.memoryPrompt || recordOrNull(cold.metadata)?.memoryContext),
      hasSkillOrMcpSnapshot: Boolean(
        cold.skillPrompt
        || cold.mcpSnapshot
        || recordOrNull(cold.metadata)?.skillContext
        || recordOrNull(cold.metadata)?.mcpContext
      ),
    });

    return this.contextAssembler.assemble({
      sessionId: correlation.sessionId,
      userId: input.userId,
      channel: input.channel,
      traceId: correlation.traceId,
      workspace: input.workspace,
      profile,
      hot,
      warm,
      cold,
      metadata: {
        source: 'AgentRunService',
        providedContext: Boolean(contextInput),
        requestedTools: input.requestedTools || [],
      },
    });
  }

  public mergeMetadata(
    metadata: Record<string, unknown>,
    canonicalContext: CanonicalSessionContextSnapshot,
  ): Record<string, unknown> {
    const coldMetadata = canonicalContext.cold?.metadata;
    return {
      ...metadata,
      canonicalContext,
      canonicalContextSummary: {
        source: 'AgentRunService',
        profile: canonicalContext.profile.id,
        depth: canonicalContext.profile.depth,
        layers: canonicalContext.metadata.contextLayers,
        hasWorkspacePrompt: Boolean(canonicalContext.workspacePrompt),
        hasMemoryPrompt: Boolean(canonicalContext.memoryPrompt),
        hasSkillPrompt: Boolean(canonicalContext.skillPrompt),
        hasMcpSnapshot: Boolean(canonicalContext.mcpSnapshot),
        toolExposureGatedByContextProfile: false,
      },
      ...(!metadata.coldContext && coldMetadata ? { coldContext: coldMetadata } : {}),
    };
  }

  private resolveProvidedContext(metadata: Record<string, unknown>): Record<string, unknown> | null {
    return recordOrNull(metadata.canonicalContextInput)
      || recordOrNull(metadata.contextInput)
      || recordOrNull(metadata.canonicalContext)
      || recordOrNull(metadata.context)
      || recordOrNull(metadata.contextSnapshot);
  }

  private resolveProvidedContextDepth(
    metadata: Record<string, unknown>,
    contextInput: Record<string, unknown> | null,
  ): string | null {
    const profile = recordOrNull(contextInput?.profile);
    return normalizeText(metadata.contextDepth)
      || normalizeText(profile?.depth)
      || normalizeText(contextInput?.contextDepth);
  }

  private resolveHotContextInput(
    metadata: Record<string, unknown>,
    contextInput: Record<string, unknown> | null,
  ): CanonicalHotContextInput {
    const hot = recordOrNull(contextInput?.hot);
    return {
      continuityPrompt: normalizeText(metadata.continuityPrompt)
        || normalizeText(contextInput?.continuityPrompt)
        || normalizeText(hot?.continuityPrompt)
        || null,
      summaryPrompt: normalizeText(metadata.summaryPrompt)
        || normalizeText(contextInput?.summaryPrompt)
        || normalizeText(hot?.summaryPrompt)
        || null,
      canonicalSessionPrompt: normalizeText(metadata.canonicalSessionPrompt)
        || normalizeText(contextInput?.canonicalSessionPrompt)
        || normalizeText(hot?.canonicalSessionPrompt)
        || null,
      recentEvents: Array.isArray(hot?.recentEvents)
        ? hot.recentEvents
        : Array.isArray(metadata.recentEvents)
          ? metadata.recentEvents
          : [],
      metadata: recordOrNull(hot?.metadata) || recordOrNull(metadata.hotContextMetadata) || {},
    };
  }

  private resolveWarmContextInput(
    metadata: Record<string, unknown>,
    contextInput: Record<string, unknown> | null,
  ): CanonicalWarmContextInput {
    const warm = recordOrNull(contextInput?.warm);
    return {
      workspacePrompt: normalizeText(metadata.workspacePrompt)
        || normalizeText(contextInput?.workspacePrompt)
        || normalizeText(warm?.workspacePrompt)
        || null,
      workspaceProfile: recordOrNull(metadata.workspaceProfile)
        || recordOrNull(warm?.workspaceProfile),
      identityFiles: this.resolveCanonicalIdentityFiles(metadata, warm),
      metadata: recordOrNull(warm?.metadata) || recordOrNull(metadata.warmContextMetadata) || {},
    };
  }

  private resolveColdContextInput(
    metadata: Record<string, unknown>,
    contextInput: Record<string, unknown> | null,
  ): CanonicalColdContextInput {
    const cold = recordOrNull(contextInput?.cold);
    return {
      memoryPrompt: normalizeText(metadata.memoryPrompt)
        || normalizeText(contextInput?.memoryPrompt)
        || normalizeText(cold?.memoryPrompt)
        || null,
      skillPrompt: normalizeText(metadata.skillPrompt)
        || normalizeText(contextInput?.skillPrompt)
        || normalizeText(cold?.skillPrompt)
        || null,
      mcpSnapshot: recordOrNull(metadata.mcpSnapshot)
        || recordOrNull(contextInput?.mcpSnapshot)
        || recordOrNull(cold?.mcpSnapshot),
      metadata: recordOrNull(metadata.coldContext)
        || recordOrNull(cold?.metadata)
        || recordOrNull(metadata.coldContextMetadata)
        || {},
    };
  }

  private resolveCanonicalIdentityFiles(
    metadata: Record<string, unknown>,
    warm: Record<string, unknown> | null,
  ): CanonicalIdentityFile[] {
    const candidates = Array.isArray(warm?.identityFiles)
      ? warm?.identityFiles
      : Array.isArray(metadata.identityFiles)
        ? metadata.identityFiles
        : [];
    return candidates
      .map(recordOrNull)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => ({
        path: normalizeText(entry.path),
        exists: entry.exists === false ? false : entry.exists === true ? true : null,
        content: normalizeText(entry.content) || null,
        summary: normalizeText(entry.summary) || null,
      }))
      .filter((entry) => Boolean(entry.path));
  }
}
