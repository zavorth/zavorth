import type {
  UniversalAgentEvent,
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';
import {
  ZAVORTH_LLM_BRAIN_CONTRACT_VERSION,
  type ZavorthLlmBrainQaCheck,
  type ZavorthLlmBrainAdapterCoverage,
  type ZavorthLlmBrainHarnessRuntime,
  type ZavorthLlmBrainProviderNativeCapability,
  type ZavorthLlmBrainSnapshot,
  type ZavorthLlmBrainStatus,
  type ZavorthLlmBrainStreamEvent,
  type ZavorthLlmBrainStreamKind,
  type ZavorthLlmBrainStreamPhase,
} from '../contracts/ZavorthLlmBrainContract.js';

type Runtime = {
  now?: () => Date;
};

type BuildInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
  executorResult?: UniversalAgentExecutorResult | null;
};

type NativeToolStats = {
  toolsExposed?: unknown;
  requested?: unknown;
  executed?: unknown;
  denied?: unknown;
  failed?: unknown;
  safeObservations?: unknown;
  sideEffectsDeferred?: unknown;
  effectBoundaryDenied?: unknown;
};

const LONG_TAIL_FAMILIES: ZavorthLlmBrainAdapterCoverage['longTailFamilies'] = [
  'webhook',
  'bot-http',
  'relay-http',
  'local-bridge',
  'apple-bridge',
];

export class ZavorthLlmBrainService {
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildRunSnapshot(input: BuildInput): ZavorthLlmBrainSnapshot {
    const run = input.run;
    const metadata = recordOrEmpty(run.metadata);
    const nativeLoop = recordOrEmpty(metadata.nativeToolLoop) as NativeToolStats;
    const route = recordOrEmpty(metadata.llmRuntimeRoute);
    const toolsExposed = stringList(nativeLoop.toolsExposed);
    const requested = numberValue(nativeLoop.requested);
    const executed = numberValue(nativeLoop.executed);
    const denied = numberValue(nativeLoop.denied);
    const failed = numberValue(nativeLoop.failed);
    const safeObservations = numberValue(nativeLoop.safeObservations);
    const sideEffectsDeferred = numberValue(nativeLoop.sideEffectsDeferred);
    const effectBoundaryDenied = numberValue(nativeLoop.effectBoundaryDenied);
    const nativeToolLoopEnabled = Boolean(metadata.nativeToolLoop) || toolsExposed.length > 0;
    const llmRequestedTools = requested > 0;
    const status = this.resolveStatus(run, {
      nativeToolLoopEnabled,
      requested,
      denied,
      failed,
      effectBoundaryDenied,
    });
    const streamEvents = this.buildStreamEvents(run);
    const brainMode = metadata.naturalFirstLlmRuntime || metadata.llmRuntimeRoute
      ? nativeToolLoopEnabled ? 'llm-first-governed-tool-loop'
        : 'llm-first-no-tools-needed'
      : 'fallback-no-llm';
    const skillEvolution = this.buildSkillEvolution(input, {
      executed,
      requested,
      failed,
      sideEffectsDeferred,
    });
    const harnessRuntime = this.buildHarnessRuntime(run, {
      sideEffectsDeferred,
    });
    const providerNativeCapabilities = this.buildProviderNativeCapabilities(run);
    const adapterCoverage: ZavorthLlmBrainAdapterCoverage = {
      channel: normalizeText(run.channel, 'unknown'),
      provider: normalizeText(metadata.providerName || run.modelProfile.providerLabel, 'unknown'),
      route: normalizeText(route.selectedProvider || route.providerName || route.routeId || run.modelProfile.routeId, 'runtime'),
      fallbackUsed: Boolean(route.fallbackUsed || route.fallback),
      longTailFamilies: [...LONG_TAIL_FAMILIES],
      liveProofRequiredForClaim: true,
      readyWhenConfigured: true,
    };
    const checks = this.buildQaChecks({
      status,
      streamEvents,
      nativeToolLoopEnabled,
      sideEffectsDeferred,
      effectBoundaryDenied,
      harnessRuntime,
      fallbackConfigured: Array.isArray(run.modelProfile.fallbackOrder) && run.modelProfile.fallbackOrder.length > 1,
      skillStatus: skillEvolution.status,
    });
    const requiresHumanLiveQa = checks.some((check) => check.id === 'human-live-proof' && check.status !== 'passed');

    return {
      contractVersion: ZAVORTH_LLM_BRAIN_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthLlmBrainService',
      status,
      brainMode,
      summary: this.buildSummary(brainMode, status, requested, executed, sideEffectsDeferred),
      session: {
        sessionId: normalizeText(run.sessionId, 'default'),
        runId: run.id,
        channel: normalizeText(run.channel, 'unknown'),
        longSessionReady: Boolean(run.sessionId) && streamEvents.length >= 2,
        serializedEvents: streamEvents.length,
      },
      streaming: {
        model: 'lifecycle-assistant-tool',
        events: streamEvents,
        visualStreamingReady: streamEvents.length >= 2,
        rawChainOfThoughtExposed: false,
      },
      toolAgency: {
        nativeToolLoopEnabled,
        llmRequestedTools,
        toolsExposed,
        requested,
        executed,
        denied,
        failed,
        safeObservations,
        sideEffectsDeferred,
        effectBoundaryDenied,
        harnessRole: nativeToolLoopEnabled ? 'serve-and-govern' : brainMode === 'fallback-no-llm' ? 'blocked' : 'observe-and-route',
      },
      providerNativeCapabilities,
      harnessRuntime,
      skillEvolution,
      adapterCoverage,
      qa: {
        checks,
        requiresHumanLiveQa,
        nextSafeAction: requiresHumanLiveQa ? 'Run a real provider/channel session and verify receipts before claiming production maturity.'
          : 'Continue with long interactive sessions and promote only reviewed learning candidates.',
      },
      invariants: {
        llmStaysDecisionMaker: true,
        harnessServesWithToolsMemoryAndPolicy: true,
        sideEffectsGoThroughEffectBoundary: true,
        learningCannotModifySecurityPolicy: true,
        longTailAdaptersNeedLiveProofBeforeClaim: true,
        rawSecretsSerialized: false,
        rawChainOfThoughtSerialized: false,
      },
    };
  }

  private buildStreamEvents(run: UniversalAgentRun): ZavorthLlmBrainStreamEvent[] {
    const events: ZavorthLlmBrainStreamEvent[] = [{
      id: `${run.id}:brain:start`,
      kind: 'lifecycle',
      phase: 'start',
      title: 'Run accepted',
      summary: `Session ${run.sessionId || 'default'} accepted the request.`,
      status: 'done',
      createdAt: run.createdAt,
      sourceEventId: null,
    }];

    for (const event of run.events) {
      events.push(this.mapRunEvent(event));
    }

    events.push({
      id: `${run.id}:brain:end`,
      kind: 'lifecycle',
      phase: run.status === 'failed' ? 'failed' : run.status === 'waiting_approval' ? 'deferred' : 'end',
      title: run.status === 'waiting_approval' ? 'Waiting for approval' : 'Run closed',
      summary: run.summary || `Run ended with status ${run.status}.`,
      status: run.status === 'failed' ? 'failed' : run.status === 'waiting_approval' ? 'pending' : 'done',
      createdAt: run.updatedAt || run.createdAt,
      sourceEventId: null,
    });

    return events.slice(0, 80);
  }

  private mapRunEvent(event: UniversalAgentEvent): ZavorthLlmBrainStreamEvent {
    return {
      id: `${event.runId}:brain:${event.id}`,
      kind: this.mapKind(event.kind),
      phase: this.mapPhase(event),
      title: event.title,
      summary: normalizeText(event.detail, event.title),
      status: event.status,
      createdAt: event.createdAt,
      sourceEventId: event.id,
    };
  }

  private mapKind(kind: UniversalAgentEvent['kind']): ZavorthLlmBrainStreamKind {
    if (kind === 'reply') return 'assistant';
    if (kind === 'tool') return 'tool';
    if (kind === 'approval') return 'approval';
    if (kind === 'memory') return 'learning';
    if (kind === 'artifact') return 'evidence';
    return 'lifecycle';
  }

  private mapPhase(event: UniversalAgentEvent): ZavorthLlmBrainStreamPhase {
    if (event.status === 'failed') return 'failed';
    if (event.status === 'pending') return event.kind === 'approval' ? 'deferred' : 'progress';
    if (event.status === 'running') return 'progress';
    return 'end';
  }

  private buildSkillEvolution(
    input: BuildInput,
    stats: { executed: number; requested: number; failed: number; sideEffectsDeferred: number },
  ): ZavorthLlmBrainSnapshot['skillEvolution'] {
    const text = [
      input.request.text,
      input.run.summary,
      input.executorResult?.summary || '',
      input.executorResult?.replyText || '',
    ].join('\n');

    if (touchesSecurityPolicy(text)) {
      return {
        status: 'quarantined',
        candidateKind: 'none',
        summary: 'Learning signal touches protected security policy and was quarantined.',
        approvalRequired: true,
        canModifySecurityPolicy: false,
        suggestedCommand: null,
      };
    }

    if (input.run.status === 'completed' && (stats.executed > 0 || stats.requested > 0)) {
      return {
        status: 'candidate-ready',
        candidateKind: stats.failed > 0 ? 'skill-improvement' : 'auto-skill',
        summary: 'Successful tool-backed behavior can be reviewed as a reusable skill or procedure.',
        approvalRequired: true,
        canModifySecurityPolicy: false,
        suggestedCommand: `zavorth learn observe "${compact(input.request.text, 80)}"`,
      };
    }

    if (input.run.status === 'completed' && text.length > 80) {
      return {
        status: 'candidate-ready',
        candidateKind: 'procedure',
        summary: 'Successful conversational behavior can be reviewed as a Mnemos procedure.',
        approvalRequired: true,
        canModifySecurityPolicy: false,
        suggestedCommand: `zavorth mnemos procedural preview "${compact(input.request.text, 80)}"`,
      };
    }

    return {
      status: 'needs-more-signal',
      candidateKind: 'none',
      summary: 'No durable skill signal yet. More successful runs are needed before learning changes behavior.',
      approvalRequired: true,
      canModifySecurityPolicy: false,
      suggestedCommand: null,
    };
  }

  private buildProviderNativeCapabilities(run: UniversalAgentRun): ZavorthLlmBrainProviderNativeCapability {
    const metadata = recordOrEmpty(run.metadata);
    const runtimeMetadata = recordOrEmpty(metadata.llmRuntimeMetadata);
    const nativeTools = recordOrEmpty(runtimeMetadata.providerNativeTools);
    const matrix = recordOrEmpty(runtimeMetadata.providerNativeCapabilityMatrix);
    const assessments = Array.isArray(matrix.assessments) ? matrix.assessments : [];
    const requested = Array.isArray(nativeTools.requested) ? nativeTools.requested : [];
    const activated = Array.isArray(nativeTools.activated) ? nativeTools.activated : [];
    const fallbackRecommended = Boolean(matrix.fallbackRecommended)
      || assessments.some((assessment: any) => assessment?.fallbackRecommended === true);
    const fallbackUsed = run.events.some((event) =>
      event.kind === 'tool'
      && recordOrEmpty(event.metadata).providerNativeFallback);
    const citationCount = assessments.reduce((total: number, assessment: any) =>
      total + numberValue(assessment?.citationCount), 0);
    const enabled = requested.length > 0 || activated.length > 0 || assessments.length > 0;
    const used = activated.length > 0 || citationCount > 0;
    const summary = enabled
      ? fallbackUsed ? 'Provider-native capability needed verification, so Zavorth used a governed fallback tool.'
        : fallbackRecommended ? 'Provider-native capability was requested but still needs Zavorth fallback evidence.'
          : citationCount > 0
            ? `Provider-native capability returned ${citationCount} citation(s).`
            : used ? 'Provider-native capability was enabled for this run.'
              : 'Provider-native capability was planned but not activated by the adapter.'
      : 'No provider-native capability was needed for this run.';
    return {
      enabled,
      used,
      fallbackRecommended,
      fallbackUsed,
      summary,
    };
  }

  private buildQaChecks(input: {
    status: ZavorthLlmBrainStatus;
    streamEvents: ZavorthLlmBrainStreamEvent[];
    nativeToolLoopEnabled: boolean;
    sideEffectsDeferred: number;
    effectBoundaryDenied: number;
    harnessRuntime: ZavorthLlmBrainHarnessRuntime;
    fallbackConfigured: boolean;
    skillStatus: ZavorthLlmBrainSnapshot['skillEvolution']['status'];
  }): ZavorthLlmBrainQaCheck[] {
    return [
      {
        id: 'session-stream',
        status: input.streamEvents.length >= 2 ? 'passed' : 'attention',
        summary: `${input.streamEvents.length} lifecycle/assistant/tool event(s) serialized for visual surfaces.`,
      },
      {
        id: 'native-tool-loop',
        status: input.nativeToolLoopEnabled ? 'passed' : 'attention',
        summary: input.nativeToolLoopEnabled ? 'The LLM can receive native tools and continue after observations.'
          : 'This run did not expose native tools; safe for chat-only turns.',
      },
      {
        id: 'effect-boundary',
        status: input.sideEffectsDeferred > 0 || input.effectBoundaryDenied > 0 ? 'passed' : 'attention',
        summary: input.sideEffectsDeferred > 0
          ? `${input.sideEffectsDeferred} side effect(s) deferred into governed planning.`
          : 'No sensitive side effect was requested in this run.',
      },
      {
        id: 'sandbox-first-mutation',
        status: input.harnessRuntime.mode === 'sandbox-first-governed' || input.sideEffectsDeferred === 0 ? 'passed' : 'attention',
        summary: input.harnessRuntime.summary,
      },
      {
        id: 'terminal-backends',
        status: input.harnessRuntime.terminalBackendPlans > 0 || input.sideEffectsDeferred === 0 ? 'passed' : 'attention',
        summary: input.harnessRuntime.terminalBackendPlans > 0
          ? `${input.harnessRuntime.terminalBackendPlans} terminal backend plan(s) attached to deferred effects.`
          : 'No terminal backend was needed for this run.',
      },
      {
        id: 'provider-fallback',
        status: input.fallbackConfigured ? 'passed' : 'attention',
        summary: input.fallbackConfigured ? 'Provider fallback order is available to the runtime.'
          : 'No explicit fallback order was visible on this run.',
      },
      {
        id: 'skill-evolution',
        status: input.skillStatus === 'quarantined' ? 'blocked' : input.skillStatus === 'candidate-ready' ? 'passed' : 'attention',
        summary: `Skill evolution signal: ${input.skillStatus}.`,
      },
      {
        id: 'long-tail-adapters',
        status: 'passed',
        summary: 'Long-tail adapter families are treated as live-proof required until configured and receipted.',
      },
      {
        id: 'human-live-proof',
        status: 'attention',
        summary: 'Human live QA is still required for real credentials, long sessions, channels and provider behavior.',
      },
    ];
  }

  private resolveStatus(
    run: UniversalAgentRun,
    stats: {
      nativeToolLoopEnabled: boolean;
      requested: number;
      denied: number;
      failed: number;
      effectBoundaryDenied: number;
    },
  ): ZavorthLlmBrainStatus {
    if (run.status === 'failed' || stats.failed > 0) return 'blocked';
    if (stats.effectBoundaryDenied > 0 || run.status === 'waiting_approval') return 'attention';
    if (!stats.nativeToolLoopEnabled && stats.requested === 0) return 'passed';
    if (stats.denied > 0 && stats.requested > 0) return 'attention';
    return 'passed';
  }

  private buildSummary(
    brainMode: ZavorthLlmBrainSnapshot['brainMode'],
    status: ZavorthLlmBrainStatus,
    requested: number,
    executed: number,
    deferred: number,
  ): string {
    if (brainMode === 'fallback-no-llm') {
      return 'The runtime did not use a configured LLM path for this run.';
    }
    return `LLM brain ${status}: mode=${brainMode}, tool_calls=${requested}, executed=${executed}, deferred_effects=${deferred}.`;
  }

  private buildHarnessRuntime(
    run: UniversalAgentRun,
    stats: { sideEffectsDeferred: number },
  ): ZavorthLlmBrainHarnessRuntime {
    const eventMetadata = run.events
      .map((event) => recordOrEmpty(event.metadata))
      .filter((entry) => Object.keys(entry).length > 0);
    const speculativeSandboxRuns = countMetadata(eventMetadata, 'superZavorthSpeculativeAutonomy')
      + (recordOrEmpty(run.metadata.superZavorthSpeculativeAutonomy).id ? 1 : 0);
    const terminalPlans = eventMetadata
      .map((metadata) => recordOrEmpty(metadata.terminalBackendPlan))
      .filter((plan) => Object.keys(plan).length > 0);
    const connectedBackends = Array.from(new Set(
      terminalPlans
        .map((plan) => normalizeBackendId(plan.selectedBackend))
        .filter((backend): backend is ZavorthLlmBrainHarnessRuntime['connectedBackends'][number] => Boolean(backend)),
    ));
    const explicitBackend = Boolean(normalizeText(run.metadata.terminalBackend || run.metadata.executionBackend));
    const mode: ZavorthLlmBrainHarnessRuntime['mode'] = stats.sideEffectsDeferred > 0
      ? speculativeSandboxRuns > 0 || terminalPlans.length > 0
        ? 'sandbox-first-governed'
        : 'needs-live-proof'
      : 'observation-only';
    const preferredMutationBackend: ZavorthLlmBrainHarnessRuntime['preferredMutationBackend'] = explicitBackend ? 'configured-backend'
      : speculativeSandboxRuns > 0
        ? 'local-copy-fallback'
        : 'docker-first';
    const summary = stats.sideEffectsDeferred > 0
      ? mode === 'sandbox-first-governed'
        ? 'Mutable effect(s) were converted into sandbox/rehearsal or terminal backend plans before host commit.'
        : 'Mutable effect(s) were deferred, but this run still needs a concrete sandbox/backend proof receipt.'
      : 'This run stayed observation-only; no sandbox commit path was required.';
    return {
      mode,
      mutableHostDirectExecution: false,
      sideEffectsDeferred: stats.sideEffectsDeferred,
      speculativeSandboxRuns,
      terminalBackendPlans: terminalPlans.length,
      preferredMutationBackend,
      connectedBackends,
      receiptsRequiredBeforeCommit: true,
      approvalRequiredBeforeHostMutation: true,
      summary,
    };
  }
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function countMetadata(entries: Record<string, unknown>[], key: string): number {
  return entries.reduce((count, entry) => count + (recordOrEmpty(entry[key]).id ? 1 : 0), 0);
}

function normalizeBackendId(value: unknown): ZavorthLlmBrainHarnessRuntime['connectedBackends'][number] | null {
  const normalized = normalizeText(value).toLowerCase();
  if (['local', 'docker', 'ssh', 'wsl', 'vercel-sandbox', 'modal', 'daytona'].includes(normalized)) {
    return normalized as ZavorthLlmBrainHarnessRuntime['connectedBackends'][number];
  }
  return null;
}

function compact(value: unknown, max = 120): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length <= max ? text : `${text.slice(0, max - 3).trim()}...`;
}

function touchesSecurityPolicy(value: string): boolean {
  return /\b(security\s*policy|safety\s*policy|approval\s*policy|effect\s*boundary|policy\s*broker|intent\s*safety|workspace\s*fs\s*policy|bypass|disable\s+approval|skip\s+sandbox|always\s+allow)\b/i
    .test(value);
}
