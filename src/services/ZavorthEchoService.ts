import { buildCanonicalRunContext } from '../contracts/ExecutionLifecycleContract.js';
import path from 'path';
import {
  createBoundaryCorrelation,
  type ZavorthBoundaryCorrelation,
} from '../contracts/InternalBoundaryContract.js';
import { config } from '../config/index.js';
import { DEFAULT_ECHO_LLM_FALLBACK_ORDER } from '../config/sections/providerConfig.js';
import { getDefaultCapabilityRegistry, type CapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import { InternalControlPlaneApiService } from '../api/internal/InternalControlPlaneApiService.js';
import { ZavorthEchoOrchestrator } from '../echo/orchestrator/ZavorthEchoOrchestrator.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import {
  ZavorthProactivePermissionService,
  type PermissionRequest,
} from './ZavorthProactivePermissionService.js';
import { EchoExecutionBoundaryService } from '../domain/execution/infrastructure/EchoExecutionBoundaryService.js';
import { EchoExecutionLedgerService } from '../domain/execution/infrastructure/EchoExecutionLedgerService.js';
import { EchoPendingExecutionStoreService } from '../domain/execution/infrastructure/EchoPendingExecutionStoreService.js';
import {
  estimateGeminiTtsCostUsd,
  EchoVoiceTelemetryService,
  type EchoVoiceMetricsSnapshot,
} from '../domain/observability/infrastructure/EchoVoiceTelemetryService.js';
import { EchoCapabilityCatalogService } from '../domain/platform-ecosystem/infrastructure/EchoCapabilityCatalogService.js';
import { EchoCapabilitySurfaceStateService } from '../domain/platform-ecosystem/application/EchoCapabilitySurfaceStateService.js';
import {
  EchoSpeechSynthesisService,
} from '../domain/surface/application/EchoSpeechSynthesisService.js';
import {
  ZavorthWatchModeControlPlaneService,
  type ZavorthWatchModeControlPlaneSnapshot,
} from './ZavorthWatchModeControlPlaneService.js';
import { GeminiVoiceService } from '../providers/GeminiVoiceService.js';
import { EchoExecutionLoop } from './EchoExecutionLoop.js';
import { safeFetch } from '../security/SafeFetchService.js';

import type { ToolDefinition } from '../providers/ILlmProvider.js';
import type { ToolCategory } from '../echo/types/IZavorthTool.js';
import type {
  EchoExecutionEntry,
  EchoPhysicalSignalRecord,
  EchoPermissionResolutionResult,
  EchoPermissionResolverContext,
  EchoResult,
  EchoSnapshot,
  EchoToolCall,
  EchoWatchModeSurfaceSnapshot,
} from '../echo/types/EchoTypes.js';
import type {
  ZavorthEchoRuntime,
  EchoSurfaceOptions,
} from './ZavorthEchoServiceTypes.js';
import { logger } from '../logger.js';
import {
asSpeechFailure,
  asSpeechSuccess,
  extractCorrelation,
  normalizeResolverContext,
  normalizeSurfaceOptions,
  optionalText,
  text,
} from './ZavorthEchoServiceSupport.js';

/**
 * High-level Echo pipeline service used by the zavorthControl and the voice agent.
 * The public API remains stable while execution, permissions and snapshots
 * are re-anchored in the canonical internal boundaries.
 */
export class ZavorthEchoService {
  private readonly orchestrator: ZavorthEchoOrchestrator;
  private readonly llmRuntime: LlmRuntimeService;
  private readonly permissions: ZavorthProactivePermissionService;
  private readonly pendingExecutions: EchoPendingExecutionStoreService;
  private readonly executionBoundary: EchoExecutionBoundaryService;
  private readonly executionLedger: EchoExecutionLedgerService;
  private readonly voiceTelemetry: EchoVoiceTelemetryService;
  private readonly speechSynthesisService: Pick<EchoSpeechSynthesisService, 'synthesize'>;
  private readonly capabilityRegistry: CapabilityRegistry;
  private readonly capabilityCatalog: EchoCapabilityCatalogService;
  private readonly capabilitySurfaceState: EchoCapabilitySurfaceStateService;
  private readonly controlPlanes: InternalControlPlaneApiService;
  private readonly watchModeControlPlane: Pick<ZavorthWatchModeControlPlaneService, 'buildSnapshot'> | null;
  private readonly llmFallbackOrder: string[];
  private readonly executionLoop: EchoExecutionLoop;

  constructor(runtime: ZavorthEchoRuntime = {}) {
    this.orchestrator = new ZavorthEchoOrchestrator({
      capturePipelineHistory: false,
      startBackgroundBridges: false,
    });
    this.llmRuntime = new LlmRuntimeService(runtime.llmProvider);
    this.llmFallbackOrder = this.normalizeLlmFallbackOrder(runtime.llmFallbackOrder || config.echoLlmFallbackOrder);
    this.permissions = runtime.permissionService || new ZavorthProactivePermissionService({
      filePath: this.resolveDefaultRuntimeFile('echo-permissions.json'),
    });
    this.pendingExecutions = runtime.pendingExecutionStore || new EchoPendingExecutionStoreService({
      filePath: this.resolveDefaultRuntimeFile('echo-pending-executions.json'),
    });
    this.executionBoundary = runtime.executionBoundary || new EchoExecutionBoundaryService();
    this.executionLedger = runtime.executionLedger || new EchoExecutionLedgerService({
      filePath: this.resolveDefaultRuntimeFile('echo-execution-ledger.json'),
    });
    this.voiceTelemetry = runtime.voiceTelemetry || new EchoVoiceTelemetryService();
    this.speechSynthesisService = runtime.speechSynthesisService || new EchoSpeechSynthesisService({
      voiceTelemetry: this.voiceTelemetry,
      geminiVoiceService: runtime.geminiVoiceService || new GeminiVoiceService(),
      costEstimator: estimateGeminiTtsCostUsd,
    });
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.capabilityCatalog = new EchoCapabilityCatalogService();
    this.capabilitySurfaceState = runtime.capabilitySurfaceState || new EchoCapabilitySurfaceStateService();
    this.capabilityCatalog.registerTools(this.orchestrator.listAllTools(), this.capabilityRegistry);
    this.watchModeControlPlane = runtime.watchModeControlPlane || new ZavorthWatchModeControlPlaneService();
    this.executionLoop = new EchoExecutionLoop({
      orchestrator: this.orchestrator,
      llmRuntime: this.llmRuntime,
      permissions: this.permissions,
      pendingExecutions: this.pendingExecutions,
      executionBoundary: this.executionBoundary,
      decorateToolCall: (toolCall) => this.buildToolCallRecord(toolCall),
      buildLlmRunOptions: () => this.buildLlmRunOptions(),
    });
    this.controlPlanes = runtime.controlPlaneApi || new InternalControlPlaneApiService({
      planes: [{
        id: 'echo',
        label: 'Echo',
        buildSnapshot: async () => this.buildRawSnapshot(),
      }],
    });
  }

  public async processIntent(prompt: string, options: EchoSurfaceOptions = {}): Promise<EchoResult> {
    const startTime = Date.now();
    const normalizedPrompt = String(prompt || '').trim();
    const normalizedOptions = normalizeSurfaceOptions(options);
    const correlation = createBoundaryCorrelation({
      sessionId: normalizedOptions.sessionId || null,
    });
    const runContext = buildCanonicalRunContext({
      correlation,
      sessionId: normalizedOptions.sessionId || null,
      surface: normalizedOptions.surface,
      requestedBy: normalizedOptions.requestedBy,
      profile: normalizedOptions.category || null,
    });

    try {
      const loopResult = await this.executionLoop.run({
        prompt: normalizedPrompt,
        options: normalizedOptions,
        correlation,
        startTime,
      });

      const entry = this.buildExecutionEntry({
        prompt: normalizedPrompt,
        startTime,
        status: loopResult.status,
        toolCalls: loopResult.toolCalls,
        finalResponse: loopResult.response,
        llmRaw: loopResult.llmRaw,
        correlation,
        runContext,
        metadata: {
          requestedBy: normalizedOptions.requestedBy,
          surface: normalizedOptions.surface,
          category: normalizedOptions.category || null,
          toolsExecuted: loopResult.toolsExecuted.slice(),
          blockedTools: loopResult.blockedTools.slice(),
          permissionsRequested: loopResult.permissionsRequested.slice(),
        },
      });
      this.executionLedger.append(entry);

      return {
        response: loopResult.response,
        toolsExecuted: loopResult.toolsExecuted,
        permissionsRequested: loopResult.permissionsRequested,
        executionEntry: entry,
      };
    } catch (error: any) {
      const entry = this.buildExecutionEntry({
        prompt: normalizedPrompt,
        startTime,
        status: 'error',
        toolCalls: [],
        finalResponse: error.message,
        llmRaw: null,
        correlation,
        runContext,
        metadata: {
          requestedBy: normalizedOptions.requestedBy,
          surface: normalizedOptions.surface,
          category: normalizedOptions.category || null,
        },
      });
      this.executionLedger.append(entry);
      return {
        response: `Erro no pipeline Echo: ${error.message}`,
        toolsExecuted: [],
        permissionsRequested: [],
        executionEntry: entry,
      };
    }
  }

  public listTools(category?: string): ToolDefinition[] {
    if (category) {
      return this.orchestrator.getSchemasForCategory(category as ToolCategory);
    }
    return this.orchestrator.listAllTools();
  }

  public getHistory(limit?: number): EchoExecutionEntry[] {
    return this.executionLedger.list(limit);
  }

  public getPendingPermissions(): PermissionRequest[] {
    return this.permissions.listPending();
  }

  public async resolvePermission(
    id: string,
    approved: boolean,
    resolvedByInput?: Partial<EchoPermissionResolverContext> | null,
  ): Promise<EchoPermissionResolutionResult> {
    const resolvedBy = normalizeResolverContext(resolvedByInput);
    const request = this.permissions.check(id);
    if (!request) {
      return { ok: false, id, error: `Permissao "${id}" nao encontrada.` };
    }

    if (request.status !== 'pending') {
      return {
        ok: false,
        id,
        status: request.status === 'approved' ? 'approved' : 'denied',
        error: `Permissao "${id}" ja foi resolvida como ${request.status}.`,
      correlation: extractCorrelation(request.metadata || {}),
        resolvedBy,
      };
    }

    const context = this.pendingExecutions.get(id);
    const resolved = this.permissions.resolve(id, approved);
    if (!resolved) {
      return { ok: false, id, error: `Permissao "${id}" nao pode ser resolvida.` };
    }

    const correlation = createBoundaryCorrelation({
      ...(context?.correlation || extractCorrelation(request.metadata || {})),
      approvalId: id,
    });
    const runContext = buildCanonicalRunContext({
      correlation,
      sessionId: context?.sessionId || correlation.sessionId || null,
      surface: text(context?.metadata?.surface, 'echo'),
      requestedBy: text(context?.metadata?.requestedBy, 'echo'),
      profile: context?.category || null,
    });

    if (!approved) {
      this.pendingExecutions.delete(id);
      const response = `Permissao "${id}" negada. A acao "${request.action}" nao foi executada.`;
      const entry = this.buildExecutionEntry({
        prompt: context?.prompt || request.reason,
        startTime: Date.now(),
        status: 'permission_denied',
        toolCalls: [{
          toolName: context?.toolName || request.action,
          args: context?.args || {},
          securityDecision: 'permission_denied',
          result: response,
          durationMs: 0,
          correlation,
        }],
        finalResponse: response,
        llmRaw: null,
        correlation,
        runContext,
        metadata: {
          permissionId: id,
          pendingKind: context?.kind || 'tool',
          resolvedBy,
        },
      });
      this.executionLedger.append(entry);
      return {
        ok: true,
        id,
        status: 'denied',
        response,
        toolsExecuted: [],
        executionEntry: entry,
        correlation,
        resolvedBy,
      };
    }

    if (!context) {
      return {
        ok: true,
        id,
        status: 'approved',
        response: `Permissao "${id}" aprovada, mas nao ha execucao Echo vinculada.`,
        toolsExecuted: [],
        correlation,
        resolvedBy,
      };
    }

    this.pendingExecutions.delete(id);
    const approvedIntent = {
      ...(context.intent || this.executionBoundary.buildToolIntent({
        prompt: context.prompt,
        toolName: context.toolName || request.action,
        args: context.args,
        category: context.category,
        sessionId: context.sessionId || null,
        approved: true,
      requestedBy: text(context.metadata?.requestedBy, 'echo'),
      surface: text(context.metadata?.surface, 'echo'),
        correlation,
      })),
      approved: true,
      correlation,
    };
    const outcome = await this.executionBoundary.execute(approvedIntent);
    let response = outcome.summary;
    const toolsExecuted: string[] = [];
    const toolCalls: EchoToolCall[] = [];

    if (context.toolName) {
      const toolStart = Date.now();
      const executionResult = await this.orchestrator.executePipeline(
        context.prompt,
        context.toolName,
        context.args,
        {
          sessionId: context.sessionId || undefined,
          traceId: outcome.correlation.traceId,
          runId: outcome.correlation.runId,
          approvalId: id,
          artifactId: outcome.correlation.artifactId,
        },
      );
      response = executionResult.response;
      toolsExecuted.push(context.toolName);
      toolCalls.push({
        ...this.buildToolCallRecord({
          toolName: context.toolName,
          args: context.args,
          securityDecision: 'approved',
          result: executionResult.response,
          durationMs: Date.now() - toolStart,
          data: executionResult.data,
          correlation: outcome.correlation,
        }),
      });
    }

    const entry = this.buildExecutionEntry({
      prompt: context.prompt,
      startTime: Date.now(),
      status: outcome.ok ? 'success' : 'error',
      toolCalls,
      finalResponse: response,
      llmRaw: null,
      correlation: outcome.correlation,
      runContext: outcome.runContext,
      metadata: {
        permissionId: id,
        pendingKind: context.kind,
        toolsExecuted: toolsExecuted.slice(),
        resolvedBy,
      },
    });
    this.executionLedger.append(entry);

    return {
      ok: true,
      id,
      status: 'approved',
      response,
      toolsExecuted,
      executionEntry: entry,
      correlation: outcome.correlation,
      resolvedBy,
    };
  }

  public approvePermission(id: string): Promise<EchoPermissionResolutionResult> {
    return this.resolvePermission(id, true);
  }

  public denyPermission(id: string): Promise<EchoPermissionResolutionResult> {
    return this.resolvePermission(id, false);
  }

  public async testConnection(): Promise<{ online: boolean; model: string; latencyMs: number; providerName: string }> {
    const start = Date.now();
    const providerName = this.llmRuntime.getPreferredProviderName();

    if (providerName !== 'ollama') {
      return {
        online: this.llmRuntime.isProviderAvailable(providerName),
        model: process.env.ZAVORTH_LLM_MODEL || providerName,
        providerName,
        latencyMs: Date.now() - start,
      };
    }

    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    const model = process.env.OLLAMA_MODEL || 'gemma2:2b';

    try {
      const res = await safeFetch(`${baseUrl}/models`, {
        signal: AbortSignal.timeout(3000),
      }, {
        serviceName: 'Zavorth Echo Ollama connection test',
        allowLoopback: true,
      });
      return {
        online: res.ok,
        model,
        providerName,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
    logger.warn('[Zavorth] network request failed', error);
    return {
        online: false,
        model,
        providerName,
        latencyMs: Date.now() - start,
      };
  }
  }

  public async buildSnapshot(): Promise<EchoSnapshot> {
    const snapshot = await this.controlPlanes.readSnapshot<EchoSnapshot>({
      planeId: 'echo',
      surface: 'echo',
      requestedBy: 'echo',
      profile: null,
      correlation: null,
    });
    return snapshot.data || await this.buildRawSnapshot();
  }

  public buildVoiceMetricsSnapshot(): EchoVoiceMetricsSnapshot {
    return this.voiceTelemetry.buildSnapshot();
  }

  public async synthesizeSpeech(input: {
    text: string;
    surface?: string;
    requestedBy?: string;
    sessionId?: string;
    model?: string;
    voiceName?: string;
    languageCode?: string;
  }): Promise<
    | {
      ok: true;
      audio: Buffer;
      mimeType: string;
      model: string | null;
      voiceName: string | null;
      languageCode: string | null;
      latencyMs: number;
    }
    | {
      ok: false;
      statusCode: number;
      error: string;
    }
  > {
    const result = await this.speechSynthesisService.synthesize(input);
    if (!result.ok) {
      return asSpeechFailure(result);
    }
    return asSpeechSuccess(result);
  }

  private async buildRawSnapshot(): Promise<EchoSnapshot> {
    const allTools = this.orchestrator.listAllTools();
    const history = this.executionLedger.list(20);
    const categoryCounts: Record<string, number> = {};

    for (const tool of allTools) {
      const category = String(tool.category || tool.name.split('_')[0]).toLowerCase();
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    const connection = await this.testConnection();
    const watchMode = this.watchModeControlPlane
      ? this.buildWatchModeSurfaceSnapshot(this.watchModeControlPlane.buildSnapshot({ limit: 4 }))
      : null;
    const recentPhysicalEvents = this.collectRecentPhysicalEvents();
    const voiceMetrics = this.buildVoiceMetricsSnapshot();

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTools: allTools.length,
        categoryCounts,
        recentExecutions: history.length,
        llmOnline: connection.online,
        preferredProvider: connection.providerName,
        ollamaOnline: connection.providerName === 'ollama' ? connection.online : false,
      },
      tools: allTools,
      recentHistory: history,
      watchMode,
      voiceMetrics,
      capabilityLifecycle: this.capabilitySurfaceState.buildCapabilityLifecycle(this.orchestrator.listRegisteredTools()),
      signals: {
        recentPhysicalEvents,
      },
    };
  }

  private buildWatchModeSurfaceSnapshot(
    snapshot: ZavorthWatchModeControlPlaneSnapshot,
  ): EchoWatchModeSurfaceSnapshot {
    return {
      generatedAt: snapshot.generatedAt,
      posture: snapshot.summary.posture,
      activeStatus: snapshot.summary.activeStatus,
      pendingApprovals: snapshot.summary.pendingApprovals,
      artifactEntries: snapshot.summary.artifactEntries,
      throttledScreenshots: snapshot.summary.throttledScreenshots,
      droppedTimelineEntries: snapshot.summary.droppedTimelineEntries,
      averageApprovalLatencyMs: snapshot.summary.averageApprovalLatencyMs,
      strictApprovalDefault: snapshot.summary.strictApprovalDefault,
      allowedApps: snapshot.summary.allowedApps,
      allowedSites: snapshot.summary.allowedSites,
      cost: {
        level: snapshot.cost.level,
        score: snapshot.cost.score,
        summary: snapshot.cost.summary,
      },
      headline: snapshot.narrative.headline,
      operatorSummary: snapshot.narrative.operatorSummary,
      nextAction: snapshot.narrative.nextAction,
      cards: snapshot.cards.map((entry) => ({
        id: entry.id,
        label: entry.label,
        posture: entry.posture,
        summary: entry.summary,
        command: entry.command,
      })),
      actions: snapshot.actions.map((entry) => ({
        id: entry.id,
        label: entry.label,
        severity: entry.severity,
        reason: entry.reason,
        command: entry.command,
      })),
    };
  }

  private buildExecutionEntry(input: {
    prompt: string;
    startTime: number;
    status: EchoExecutionEntry['status'];
    toolCalls: EchoToolCall[];
    finalResponse: string;
    llmRaw: string | null;
    correlation: ZavorthBoundaryCorrelation;
    runContext: ReturnType<typeof buildCanonicalRunContext>;
    metadata?: Record<string, unknown>;
  }): EchoExecutionEntry {
    return {
      id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      prompt: input.prompt,
      llmRaw: input.llmRaw,
      toolCalls: input.toolCalls,
      finalResponse: input.finalResponse,
      status: input.status,
      durationMs: Date.now() - input.startTime,
      correlation: input.correlation,
      runContext: input.runContext,
      metadata: input.metadata || {},
    };
  }

  private buildToolCallRecord(input: EchoToolCall): EchoToolCall {
    const projected = this.capabilitySurfaceState.projectExecutionData(input.data);
    return {
      ...input,
      lifecycle: projected.lifecycle,
      artifact: projected.artifact,
      policy: projected.policy,
    };
  }

  private buildLlmRunOptions() {
    return {
      providerName: this.llmRuntime.getPreferredProviderName(),
      allowFallback: true,
      fallbackOrder: [...this.llmFallbackOrder],
    };
  }

  private normalizeLlmFallbackOrder(input: readonly string[] | undefined): string[] {
    const seen = new Set<string>();
    const normalized = (input || [])
      .map((provider) => String(provider || '').trim().toLowerCase())
      .filter((provider) => {
        if (!provider || seen.has(provider)) {
          return false;
        }
        seen.add(provider);
        return true;
      });
    return normalized.length > 0 ? normalized : [...DEFAULT_ECHO_LLM_FALLBACK_ORDER];
  }

  private resolveDefaultRuntimeFile(name: string): string | null {
    if ((process.env.NODE_ENV || '').toLowerCase() === 'test') {
      return null;
    }
    return path.join(config.dataDir, 'runtime', name);
  }

  private collectRecentPhysicalEvents(): EchoPhysicalSignalRecord[] {
    const tools = this.orchestrator.listRegisteredTools() as Array<{
      getRecentPhysicalEvents?: (limit?: number) => unknown[];
    }>;
    const events = tools.flatMap((tool) => {
      try {
        return typeof tool.getRecentPhysicalEvents === 'function'
          ? tool.getRecentPhysicalEvents(6)
          : [];
      } catch (error) { logger.warn('[Zavorth] process signal failed', error); return []; }
    });

    return events
      .map((entry) => this.normalizePhysicalEvent(entry))
      .filter((entry): entry is EchoPhysicalSignalRecord => Boolean(entry))
      .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
      .slice(0, 6);
  }

  private normalizePhysicalEvent(value: unknown): EchoPhysicalSignalRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const id = optionalText(record.id);
    const timestamp = optionalText(record.timestamp);
    const entityId = optionalText(record.entityId);
    const newState = optionalText(record.newState);
    const feedback = optionalText(record.feedback);
    const severity = optionalText(record.severity);
    if (!id || !timestamp || !entityId || !newState || !feedback) {
      return null;
    }
    return {
      id,
      source: text(record.source, 'iot'),
      timestamp,
      entityId,
      oldState: optionalText(record.oldState),
      newState,
      feedback,
      severity: severity === 'critical' || severity === 'warn' ? severity : 'info',
    };
  }

}
