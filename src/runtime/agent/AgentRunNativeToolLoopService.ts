import type { ChatMessage, ToolCall, ToolDefinition, ILlmProvider } from '../../providers/ILlmProvider.js';
import { ContextCompactionService } from '../../services/ContextCompactionService.js';
import type { LlmRunOptions, LlmRuntimeResult } from '../../services/llm/LlmRuntimeService.js';
import type { UniversalAgentEvent, UniversalAgentRun, UniversalAgentRequest } from './UniversalAgentRuntimeTypes.js';
import type { UniversalAgentLlmRuntime } from './AgentRunLlmRuntimeExecutor.js';
import type { UniversalAgentToolRuntime } from './AgentRunEchoHandsExecutor.js';
import type { CreateZavorthMutationPlanInput } from '../../services/ZavorthMutationPlaneService.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import { containsUntrustedContentMarker, withUntrustedInputMetadata } from '../../security/UntrustedContent.js';
import {
  isSafeObservationTool,
  mapToolCallToEffectDecision,
  ToolEffectRegistry,
  type ToolEffectMapping,
} from '../../tools/governance/index.js';
import type { RuntimePolicyBundle } from '../../contracts/ProfileManifestContract.js';
import { ProfileEnforcementReceiptService } from '../../services/ProfileEnforcementReceiptService.js';
import { buildEffectRehearsalEnvelope } from '../rehearsal/index.js';
import type { AgentRunLlmRequestBuilder } from './AgentRunLlmRequestBuilder.js';
import {
  buildSpeculativeAutonomyReceipt,
  ZavorthSpeculativeAutonomyService,
  type PrepareZavorthSpeculativeAutonomyInput,
  type ZavorthSpeculativeAutonomyResult,
} from '../../autonomy/ZavorthSpeculativeAutonomyService.js';
import {
  resolveCanvasSessionServiceForRuntime,
  syncSpeculativeAutonomyToCanvas,
  type CanvasSpeculativeAutonomySyncService,
  type CanvasSpeculativeAutonomySyncSnapshot,
} from '../../services/CanvasRuntimeSyncService.js';
import { ZavorthTerminalBackendsService } from '../../services/ZavorthTerminalBackendsService.js';
import { buildStructuredToolFailurePlan } from './StructuredToolFailurePlan.js';
import {
  clampText,
  delay,
  estimateMessagesChars,
  isTransientToolError,
  matchesAnyAlias,
  normalizeText,
  normalizeToolArguments,
  normalizeToolKey,
  numberFromUnknown,
  recordOrNull,
  similarityScore,
  summarizeToolDefinition,
  truthy,
  uniqueToolDefinitions,
} from './AgentRunNativeToolLoopUtils.js';
import { asErrorLike } from '../../utils/errorLike.js';
import {
  OperatorContinuityKernel,
  decisionFromEffectBoundary,
  resultFromToolOutcome,
} from '../operator/OperatorContinuityEnvelope.js';
import { resolveDefaultAgentToolSecurityDefinition } from '../../security/AgentToolSecurityCatalog.js';
import {
  isDestructiveExposureTool,
  isFullProfileSecurityExposable,
  isProfileAlwaysExpose,
  isWriteLikeExposureTool,
  rankingBoostForProfile,
  resolveExposureProfile,
  resolveMaxExposedTools,
  type ToolExposureProfileName,
} from './tools/ToolExposureProfile.js';
import {
  buildDeferredToolEffectMessage,
  buildMutationPlanMetadata,
  buildProviderNativeFallbackToolCalls,
  buildToolEffectBoundaryMetadata,
  buildToolEvent,
  buildToolMessage,
  enrichNativeToolArgs,
  extractCommandsFromToolArgs,
  extractWorkspaceWritesFromToolArgs,
  resolveMutationDomain,
  resolveSpeculativeSandboxIsolation,
  resolveTerminalBackend,
  resolveToolAliases,
} from './AgentRunNativeToolLoopHelpers.js';

export type NativeToolLoopStats = {
  requested: number;
  executed: number;
  denied: number;
  failed: number;
  rounds: number;
  maxRounds: number;
  safeObservations: number;
  effectBoundaryDenied: number;
  sideEffectsDeferred: number;
  repairedToolCalls: number;
  unknownToolCalls: number;
  catalogSearches: number;
  catalogMaterializedTools: number;
  planningCalls: number;
  compactions: number;
  truncatedToolMessages: number;
  retriedToolCalls: number;
  successfulRetries: number;
  stopReasonRecoveries: number;
};

export type NativeToolLoopResult = {
  result: LlmRuntimeResult;
  evidenceTexts: string[];
  toolReceiptCount: number;
  stats: NativeToolLoopStats;
  events: Array<
    Omit<UniversalAgentEvent, 'runId' | 'createdAt' | 'id'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>
  >;
};

type Runtime = {
  llmRuntime: UniversalAgentLlmRuntime | null;
  toolRuntime: UniversalAgentToolRuntime | null;
  requestBuilder: AgentRunLlmRequestBuilder;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
  speculativeAutonomyService?: Pick<ZavorthSpeculativeAutonomyService, 'prepare'> | null;
  canvasSessionService?: CanvasSpeculativeAutonomySyncService | null;
  terminalBackendsService?: Pick<ZavorthTerminalBackendsService, 'execute'> | null;
  continuityKernel?: OperatorContinuityKernel;
};

const MAX_NATIVE_TOOL_ROUNDS = 5;
const HARD_NATIVE_TOOL_ROUNDS = 12;
const MAX_NATIVE_TOOL_CALLS_PER_ROUND = 8;
const MAX_EXPOSED_NATIVE_TOOLS = 12;
const MAX_CATALOG_MATERIALIZED_TOOLS = 4;
const NATIVE_TOOL_CONTEXT_CHARS = 60_000;
const COMPACT_TOOL_CATALOG_NAME = 'zavorth_tool_catalog';
const TOOL_PLANNER_NAME = 'zavorth_tool_plan';
const TOOL_EFFECT_REGISTRY = new ToolEffectRegistry();

type ToolCatalogState = {
  allTools: ToolDefinition[];
  exposedToolNames: Set<string>;
};

type ToolCallRepair = {
  toolCall: ToolCall;
  repaired: boolean;
  reason?: string;
};
type ExecuteToolAttemptResult = {
  output: string;
  attempts: number;
};

export class AgentRunNativeToolLoopService {
  private readonly llmRuntime: UniversalAgentLlmRuntime | null;
  private readonly toolRuntime: UniversalAgentToolRuntime | null;
  private readonly requestBuilder: AgentRunLlmRequestBuilder;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
  private readonly speculativeAutonomy: Pick<ZavorthSpeculativeAutonomyService, 'prepare'> | null;
  private readonly canvasSessions: CanvasSpeculativeAutonomySyncService | null;
  private readonly terminalBackends: Pick<ZavorthTerminalBackendsService, 'execute'> | null;
  private readonly continuityKernel: OperatorContinuityKernel;
  private readonly profileReceipts = new ProfileEnforcementReceiptService();
  private readonly toolCatalogByRun = new Map<string, ToolCatalogState>();
  private readonly compactionService = new ContextCompactionService();
  constructor(runtime: Runtime) {
    this.llmRuntime = runtime.llmRuntime;
    this.toolRuntime = runtime.toolRuntime;
    this.requestBuilder = runtime.requestBuilder;
    this.mutationPlane =
      runtime.mutationPlaneService === null ? null : runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.speculativeAutonomy =
      runtime.speculativeAutonomyService === null
        ? null
        : runtime.speculativeAutonomyService || new ZavorthSpeculativeAutonomyService();
    this.canvasSessions =
      runtime.canvasSessionService === null
        ? null
        : runtime.canvasSessionService || resolveCanvasSessionServiceForRuntime();
    this.terminalBackends =
      runtime.terminalBackendsService === null
        ? null
        : runtime.terminalBackendsService || new ZavorthTerminalBackendsService();
    this.continuityKernel = runtime.continuityKernel || new OperatorContinuityKernel();
  }
  public maxRounds(): number {
    return MAX_NATIVE_TOOL_ROUNDS;
  }
  public maxRoundsFor(run: UniversalAgentRun, request?: UniversalAgentRequest): number {
    const profileLimit = this.resolveRuntimePolicyBundle(run)?.maxToolRounds;
    const requestedLimit =
      numberFromUnknown(request?.metadata?.nativeToolMaxRounds) ||
      numberFromUnknown(run.metadata.nativeToolMaxRounds) ||
      numberFromUnknown(process.env.ZAVORTH_NATIVE_TOOL_MAX_ROUNDS);
    const raw = profileLimit || requestedLimit || this.inferAdaptiveRoundBudget(run, request);
    const max = Math.max(MAX_NATIVE_TOOL_ROUNDS, raw || MAX_NATIVE_TOOL_ROUNDS);
    return Math.min(HARD_NATIVE_TOOL_ROUNDS, max);
  }
  public resolveNativeTools(run: UniversalAgentRun, request: UniversalAgentRequest): ToolDefinition[] {
    if (!this.toolRuntime?.getToolDefinitions) return [];
    if (this.toolRuntime.isAvailable && !this.toolRuntime.isAvailable()) return [];

    const definitions = this.toolRuntime.getToolDefinitions();
    const policyContext = this.requestBuilder.buildToolPolicyContext(run, request);
    const approved = new Set((policyContext.approvedToolIds || []).map((tool) => tool.toLowerCase()));
    const requested = new Set((request.requestedTools || []).map((tool) => tool.toLowerCase()));
    const exposed = policyContext.exposedTools || [];
    const runtimePolicy = this.resolveRuntimePolicyBundle(run);
    const exposureProfile = resolveExposureProfile({ run, request });
    const maxExposedTools = resolveMaxExposedTools(exposureProfile);
    const allowedTools = definitions.filter((tool) => {
      if (this.toolRuntime?.hasTool && !this.toolRuntime.hasTool(tool.name)) return false;
      const aliases = resolveToolAliases(tool.name);
      const isApproved = aliases.some((alias) => approved.has(alias));
      const profileDecision = runtimePolicy
        ? this.applyProfileToolPolicy({
            run,
            runtimePolicy,
            toolName: tool.name,
            aliases,
          })
        : 'neutral';
      if (profileDecision === 'blocked') {
        return false;
      }
      if (
        profileDecision === 'requires_approval' &&
        !isApproved &&
        !aliases.some((alias) => isProfileAlwaysExpose(exposureProfile, alias))
      ) {
        return false;
      }

      // Destructive tools only when explicitly approved.
      if (aliases.some((alias) => isDestructiveExposureTool(alias) || isDestructiveExposureTool(tool.name))) {
        return isApproved;
      }

      if (aliases.includes('web_search')) {
        return this.shouldExposeWebSearch(run, request, aliases, requested, exposed);
      }

      if (aliases.some((alias) => isSafeObservationTool(alias, TOOL_EFFECT_REGISTRY))) {
        return true;
      }

      if (aliases.some((alias) => isProfileAlwaysExpose(exposureProfile, alias))) {
        // memory_write (and similar) only when security risk allows.
        if (aliases.some((alias) => isWriteLikeExposureTool(alias))) {
          return isApproved || this.securityAllowsWriteLikeExposure(tool.name);
        }
        return true;
      }

      if (exposureProfile === 'full' && this.isFullProfileExposableTool(tool.name, aliases)) {
        return true;
      }

      if (isApproved) return true;
      return exposed.some((entry) => {
        const id = entry.id.toLowerCase();
        return aliases.includes(id) && entry.requiresApproval !== true && entry.risk === 'safe';
      });
    });

    const rankedTools = this.rankNativeTools(allowedTools, run, request, exposureProfile);
    const syntheticTools = this.buildSyntheticToolDefinitions(rankedTools.length, maxExposedTools);
    const maxRealTools = Math.max(1, maxExposedTools - syntheticTools.length);
    const exposedTools =
      rankedTools.length > maxRealTools
        ? [...rankedTools.slice(0, maxRealTools), ...syntheticTools]
        : [...rankedTools, ...syntheticTools.filter(() => rankedTools.length > 1)];
    const uniqueTools = uniqueToolDefinitions(exposedTools);
    this.toolCatalogByRun.set(run.id, {
      allTools: uniqueToolDefinitions([...rankedTools, ...syntheticTools]),
      exposedToolNames: new Set(uniqueTools.map((tool) => tool.name)),
    });
    return uniqueTools;
  }

  public async run(input: {
    messages: ChatMessage[];
    initialResult: LlmRuntimeResult;
    tools: ToolDefinition[];
    options: LlmRunOptions;
    run: UniversalAgentRun;
    request?: UniversalAgentRequest;
  }): Promise<NativeToolLoopResult> {
    const stats: NativeToolLoopStats = {
      requested: 0,
      executed: 0,
      denied: 0,
      failed: 0,
      rounds: 0,
      maxRounds: this.maxRoundsFor(input.run, input.request),
      safeObservations: 0,
      effectBoundaryDenied: 0,
      sideEffectsDeferred: 0,
      repairedToolCalls: 0,
      unknownToolCalls: 0,
      catalogSearches: 0,
      catalogMaterializedTools: 0,
      planningCalls: 0,
      compactions: 0,
      truncatedToolMessages: 0,
      retriedToolCalls: 0,
      successfulRetries: 0,
      stopReasonRecoveries: 0,
    };
    const evidenceTexts: string[] = [];
    const events: NativeToolLoopResult['events'] = [];
    let result = input.initialResult;

    if (!this.llmRuntime || !this.toolRuntime || input.tools.length === 0) {
      return { result, evidenceTexts, toolReceiptCount: 0, stats, events };
    }

    let knownToolNames = new Set(input.tools.map((tool) => tool.name));
    let stopReasonRecoveryUsed = false;

    try {
      for (let round = 0; round < stats.maxRounds; round += 1) {
        if (input.options.signal?.aborted) {
          break;
        }
        const recovery = await this.recoverStopReasonIfNeeded({
          input,
          result,
          stopReasonRecoveryUsed,
        });
        if (recovery.recovered) {
          result = recovery.result;
          stopReasonRecoveryUsed = true;
          stats.stopReasonRecoveries += 1;
          events.push(
            buildToolEvent(
              input.run,
              'llm.stop_reason_recovery',
              'Continuation requested after an incomplete provider stop reason.',
              'done',
              {
                reason: 'stop-reason-recovery',
                finishReason: recovery.previousFinishReason,
              },
            ),
          );
        }
        const declaredToolCalls = result.response.toolCalls || [];
        const fallbackToolCalls =
          declaredToolCalls.length === 0
            ? buildProviderNativeFallbackToolCalls({
                result,
                run: input.run,
                request: input.request,
                knownToolNames,
              })
            : [];
        const rawToolCalls = declaredToolCalls.length > 0 ? declaredToolCalls : fallbackToolCalls;
        const repairs = rawToolCalls.map((toolCall) => this.repairToolCall(toolCall, knownToolNames));
        const toolCalls = repairs.map((repair) => repair.toolCall);
        stats.repairedToolCalls += repairs.filter((repair) => repair.repaired).length;
        if (toolCalls.length === 0) break;
        stats.rounds += 1;
        input.messages.push({
          role: 'assistant',
          content: result.response.content || '',
          toolCalls,
        });

        const toolMessages: ChatMessage[] = [];
        for (const [index, toolCall] of toolCalls.slice(0, MAX_NATIVE_TOOL_CALLS_PER_ROUND).entries()) {
          if (input.options.signal?.aborted) {
            break;
          }
          stats.requested += 1;
          const repair = repairs[index];
          if (toolCall.name === COMPACT_TOOL_CATALOG_NAME) {
            const catalogResult = this.handleToolCatalogCall({
              run: input.run,
              request: input.request,
              toolCall,
              tools: input.tools,
              knownToolNames,
            });
            stats.catalogSearches += 1;
            stats.catalogMaterializedTools += catalogResult.materializedTools;
            if (catalogResult.materializedTools > 0) {
              knownToolNames = new Set(input.tools.map((tool) => tool.name));
            }
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, catalogResult.output));
            events.push(
              buildToolEvent(input.run, toolCall.name, catalogResult.output, 'done', {
                reason: 'compact-tool-catalog',
                toolCallId: toolCall.id,
                materializedTools: catalogResult.materializedTools,
              }),
            );
            continue;
          }
          if (toolCall.name === TOOL_PLANNER_NAME) {
            const plan = this.handleToolPlanningCall({
              run: input.run,
              request: input.request,
              toolCall,
              knownToolNames,
            });
            stats.planningCalls += 1;
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, plan));
            events.push(
              buildToolEvent(input.run, toolCall.name, plan, 'done', {
                reason: 'agent-run-tool-planning',
                toolCallId: toolCall.id,
              }),
            );
            continue;
          }
          if (!knownToolNames.has(toolCall.name)) {
            stats.denied += 1;
            stats.unknownToolCalls += 1;
            const denied = `Tool ${toolCall.name} is not exposed for this run.${repair?.reason ? ` ${repair.reason}` : ''}`;
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, denied));
            events.push(
              buildToolEvent(input.run, toolCall.name, denied, 'failed', {
                reason: 'tool-not-exposed',
                toolCallId: toolCall.id,
                candidates: this.findToolCandidates(toolCall.name, knownToolNames).slice(0, 5),
              }),
            );
            continue;
          }

          const influencedByUntrustedContent =
            containsUntrustedContentMarker(input.messages) || containsUntrustedContentMarker(toolCall.arguments);
          const sourceTrust = influencedByUntrustedContent ? 'untrusted-content' : 'trusted-user';
          const effectMapping = mapToolCallToEffectDecision({
            toolCall,
            registry: TOOL_EFFECT_REGISTRY,
            sourceTrust,
            policyContext: {
              surface: 'agent-native-tool-loop',
              workspace: input.run.workspace || null,
              sandboxAvailable: true,
            },
          });
          const safeObservation =
            effectMapping.decision.action === 'allow' &&
            effectMapping.analysis.readOnly &&
            isSafeObservationTool(toolCall.name, TOOL_EFFECT_REGISTRY);
          if (safeObservation) {
            stats.safeObservations += 1;
          } else if (effectMapping.decision.action === 'deny') {
            stats.denied += 1;
            stats.effectBoundaryDenied += 1;
            const denied = `Tool ${toolCall.name} blocked by effect boundary: ${effectMapping.decision.reasons.join(' ')}`;
            const continuity = this.finalizeEffectBoundaryContinuity({
              run: input.run,
              toolCall,
              mapping: effectMapping,
              status: 'blocked',
              summary: denied,
            });
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, denied));
            events.push(
              buildToolEvent(input.run, toolCall.name, denied, 'failed', {
                reason: 'effect-boundary-deny',
                toolCallId: toolCall.id,
                sourceTrust,
                effectBoundary: buildToolEffectBoundaryMetadata(effectMapping),
                operatorContinuity: this.continuityKernel.toPublicView(continuity),
              }),
            );
            continue;
          } else {
            stats.denied += 1;
            stats.sideEffectsDeferred += 1;
            const rehearsalEnvelope = buildEffectRehearsalEnvelope({
              id: `${input.run.id}:${toolCall.id}:effect-boundary`,
              mapping: effectMapping,
            });
            const deferredPlan = await this.createPlanForDeferredEffect({
              run: input.run,
              toolName: toolCall.name,
              mapping: effectMapping,
              rehearsalEnvelope,
            });
            const deferred = buildDeferredToolEffectMessage(toolCall.name, effectMapping);
            const continuity = this.finalizeEffectBoundaryContinuity({
              run: input.run,
              toolCall,
              mapping: effectMapping,
              status: 'deferred',
              summary: deferred,
              mutationPlanId: deferredPlan.mutationPlan?.id || null,
            });
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, deferred));
            events.push(
              buildToolEvent(input.run, toolCall.name, deferred, 'failed', {
                reason: 'effect-boundary-deferred',
                toolCallId: toolCall.id,
                sourceTrust,
                effectBoundary: buildToolEffectBoundaryMetadata(effectMapping),
                effectRehearsal: rehearsalEnvelope,
                operatorContinuity: this.continuityKernel.toPublicView(continuity),
                ...(deferredPlan.mutationPlan
                  ? { mutationPlan: buildMutationPlanMetadata(deferredPlan.mutationPlan) }
                  : {}),
                ...(deferredPlan.speculativeAutonomy
                  ? {
                      superZavorthSpeculativeAutonomy: buildSpeculativeAutonomyReceipt(
                        deferredPlan.speculativeAutonomy,
                      ),
                    }
                  : {}),
                ...(deferredPlan.zCanvasSession ? { zCanvasSession: deferredPlan.zCanvasSession } : {}),
                ...(deferredPlan.terminalBackendPlan ? { terminalBackendPlan: deferredPlan.terminalBackendPlan } : {}),
              }),
            );
            continue;
          }

          const continuitySeed = this.continuityKernel.begin({
            correlation: {
              runId: input.run.id,
              sessionId: String(input.run.sessionId || input.run.metadata?.sessionId || '').trim() || null,
              toolCallId: toolCall.id,
            },
          });
          const rawToolArgs = influencedByUntrustedContent
            ? withUntrustedInputMetadata(toolCall.arguments, 'agent-run-llm-native-loop-contained-untrusted-evidence')
            : toolCall.arguments;
          const toolArgs = enrichNativeToolArgs({
            toolName: toolCall.name,
            args: rawToolArgs,
            providerName: result.providerName,
            modelName: result.modelName,
            continuity: {
              continuityId: continuitySeed.ids.continuityId,
              runId: input.run.id,
              toolCallId: toolCall.id,
              sourceSurface: 'agent-native-tool-loop',
            },
          });
          try {
            const execution = await this.executeToolWithRetry(toolCall.name, toolArgs);
            const toolResult = execution.output;
            if (execution.attempts > 1) {
              stats.retriedToolCalls += 1;
              stats.successfulRetries += 1;
            }
            stats.executed += 1;
            evidenceTexts.push(`${toolCall.name}:\n${clampText(toolResult, 6000)}`);
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, toolResult));
            events.push(
              buildToolEvent(input.run, toolCall.name, toolResult, 'done', {
                toolCallId: toolCall.id,
                sourceTrust,
                ...(repair?.repaired ? { toolCallRepair: repair.reason || 'normalized-tool-call' } : {}),
                effectBoundary: buildToolEffectBoundaryMetadata(effectMapping),
                operatorContinuity: this.buildAppliedToolContinuityView({
                  seed: continuitySeed,
                  toolName: toolCall.name,
                  ok: true,
                  summary: `${toolCall.name} applied`,
                }),
                ...(toolCall.arguments?.providerNativeFallback
                  ? { providerNativeFallback: toolCall.arguments.providerNativeFallback }
                  : {}),
              }),
            );
          } catch (error: unknown) {
            const err = asErrorLike(error);
            stats.failed += 1;
            if (isTransientToolError(error)) {
              stats.retriedToolCalls += 1;
            }
            const failureMessage = clampText(error instanceof Error ? err.message : String(error), 400);
            const recoveryPlan = buildStructuredToolFailurePlan({
              toolName: toolCall.name,
              errorMessage: failureMessage,
              availableAlternatives: this.listAlternateToolNames(toolCall.name),
            });
            const message = [
              `Tool ${toolCall.name} failed: ${failureMessage}`,
              `recovery.shouldRetry=${recoveryPlan.shouldRetry}`,
              `recovery.nextActions=${recoveryPlan.nextActions.join(',')}`,
              recoveryPlan.preferredAlternative ? `recovery.preferredAlternative=${recoveryPlan.preferredAlternative}`
                : null,
              recoveryPlan.userVisibleSummary,
            ]
              .filter(Boolean)
              .join('\n');
            evidenceTexts.push(`${toolCall.name}:\n${message}`);
            toolMessages.push(buildToolMessage(toolCall.name, toolCall.id, message));
            events.push(
              buildToolEvent(input.run, toolCall.name, message, 'failed', {
                toolCallId: toolCall.id,
                sourceTrust,
                effectBoundary: buildToolEffectBoundaryMetadata(effectMapping),
                operatorContinuity: this.buildAppliedToolContinuityView({
                  seed: continuitySeed,
                  toolName: toolCall.name,
                  ok: false,
                  summary: message,
                }),
                recoveryPlan,
              }),
            );
          }
        }

        if (toolMessages.length === 0) break;
        input.messages.push(...toolMessages);
        if (input.options.signal?.aborted) {
          break;
        }
        const compaction = await this.compactMessagesForNextTurn(
          input.messages,
          this.resolveContextBudgetChars(input.run, input.request),
          input.options,
        );
        stats.compactions += compaction.compacted ? 1 : 0;
        stats.truncatedToolMessages += compaction.truncatedToolMessages;
        result = await this.llmRuntime.chatDetailed(input.messages, input.tools, input.options);
      }
    } finally {
      if (input.options.signal?.aborted) {
        if (input.messages.length > 0 && input.messages[input.messages.length - 1].role === 'tool') {
          input.messages.push({ role: 'assistant', content: 'Operation interrupted.' });
        }
      }
    }

    return { result, evidenceTexts, toolReceiptCount: stats.executed, stats, events };
  }

  private resolveRuntimePolicyBundle(run: UniversalAgentRun): RuntimePolicyBundle | null {
    const bundle =
      recordOrNull(run.metadata.profileBundle)?.runtimePolicyBundle ||
      run.metadata.runtimePolicyBundle ||
      recordOrNull(run.metadata.profileRuntimeBundle)?.runtimePolicyBundle ||
      recordOrNull(run.metadata.profile)?.runtimePolicyBundle;
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
      return null;
    }
    const candidate = bundle as Partial<RuntimePolicyBundle>;
    if (!candidate.profileId || !candidate.checksum) {
      return null;
    }
    return candidate as RuntimePolicyBundle;
  }

  private applyProfileToolPolicy(input: {
    run: UniversalAgentRun;
    runtimePolicy: RuntimePolicyBundle;
    toolName: string;
    aliases: string[];
  }): 'allowed' | 'blocked' | 'requires_approval' | 'neutral' {
    const deny = input.runtimePolicy.deny || [];
    const requireApproval = input.runtimePolicy.requireApproval || [];
    const allow = input.runtimePolicy.allow || [];
    if (matchesAnyAlias(input.aliases, deny)) {
      this.emitProfileToolReceipt(
        input.run,
        input.runtimePolicy,
        input.toolName,
        input.aliases,
        'hidden',
        'profile-deny-list',
      );
      return 'blocked';
    }
    if (input.runtimePolicy.approvalMode === 'always' || matchesAnyAlias(input.aliases, requireApproval)) {
      this.emitProfileToolReceipt(
        input.run,
        input.runtimePolicy,
        input.toolName,
        input.aliases,
        'requires_approval',
        'profile-requires-approval',
      );
      return 'requires_approval';
    }
    if (allow.length > 0) {
      if (matchesAnyAlias(input.aliases, allow)) {
        this.emitProfileToolReceipt(
          input.run,
          input.runtimePolicy,
          input.toolName,
          input.aliases,
          'allowed',
          'profile-allow-list',
        );
        return 'allowed';
      }
      this.emitProfileToolReceipt(
        input.run,
        input.runtimePolicy,
        input.toolName,
        input.aliases,
        'hidden',
        'not-in-profile-allow-list',
      );
      return 'blocked';
    }
    return 'neutral';
  }

  private emitProfileToolReceipt(
    run: UniversalAgentRun,
    runtimePolicy: RuntimePolicyBundle,
    toolName: string,
    aliases: string[],
    decision: 'allowed' | 'hidden' | 'requires_approval',
    reason: string,
  ): void {
    const receipt = this.profileReceipts.fromToolExposure({
      runtimePolicy,
      toolName,
      aliases,
      decision,
      reason,
      runId: run.id,
      createdAt: run.updatedAt || run.createdAt,
    });
    const exists = run.events.some(
      (event) =>
        event.metadata?.profileEnforcementReceipt &&
        (event.metadata.profileEnforcementReceipt as { id?: string }).id === receipt.id,
    );
    if (exists) return;
    run.events.push({
      id: `${receipt.id}:${run.events.length}`,
      runId: run.id,
      kind: 'status',
      title: 'Profile policy enforced',
      detail: receipt.summary,
      status: decision === 'allowed' ? 'done' : 'pending',
      createdAt: receipt.createdAt,
      metadata: {
        source: 'AgentRunNativeToolLoopService',
        profileEnforcementReceipt: receipt,
      },
    });
  }

  private rankNativeTools(
    tools: ToolDefinition[],
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    exposureProfile: ToolExposureProfileName = 'safe',
  ): ToolDefinition[] {
    const requestText = normalizeText(
      `${request.text} ${run.input} ${(request.requestedTools || []).join(' ')}`,
    ).toLowerCase();
    const requested = new Set((request.requestedTools || []).flatMap((tool) => resolveToolAliases(tool)));
    return [...tools].sort((left, right) => scoreTool(right) - scoreTool(left));

    function scoreTool(tool: ToolDefinition): number {
      const name = tool.name.toLowerCase();
      let score = 0;
      // Structured requestedTools only — never free-text token overlap against descriptions.
      if (requested.has(name)) score += 80;
      // Exact tool-name mention as a whole token in the request payload (id-like), not word soft-match.
      if (new RegExp(`(?:^|\\s)${name.replace(/[.*+...^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i').test(requestText)) {
        score += 50;
      }
      if (name === 'zavorth_action') score += 45;
      if (name === 'read_file' || name === 'list_directory') score += 30;
      score += rankingBoostForProfile(exposureProfile, name);
      return score;
    }
  }

  private buildSyntheticToolDefinitions(
    realToolCount: number,
    maxExposedTools: number = MAX_EXPOSED_NATIVE_TOOLS,
  ): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    if (realToolCount > 1) {
      tools.push({
        name: TOOL_PLANNER_NAME,
        description:
          'Plan which governed Zavorth tools or subagent lanes should be used before executing a multi-step request.',
        category: 'agent-runtime',
        dangerLevel: 'safe',
        requiresPermission: false,
        parameters: {
          type: 'object',
          properties: {
            objective: { type: 'string', description: 'The current task or subtask to plan.' },
            mode: { type: 'string', description: 'Plan mode.', enum: ['tools', 'subagents', 'mixed'] },
          },
          required: ['objective'],
        },
      });
    }
    if (realToolCount > maxExposedTools - 1) {
      tools.push({
        name: COMPACT_TOOL_CATALOG_NAME,
        description:
          'Search or describe the compact catalog of governed tools. A search can materialize matching tools for the next native tool round.',
        category: 'agent-runtime',
        dangerLevel: 'safe',
        requiresPermission: false,
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', description: 'Catalog operation.', enum: ['search', 'describe'] },
            query: { type: 'string', description: 'Natural language query or domain to search.' },
            toolName: { type: 'string', description: 'Specific tool to describe.' },
            limit: { type: 'number', description: 'Maximum number of tools to return.' },
          },
          required: ['operation'],
        },
      });
    }
    return tools;
  }

  private securityAllowsWriteLikeExposure(toolName: string): boolean {
    try {
      const definition = resolveDefaultAgentToolSecurityDefinition(toolName);
      if (!definition) return false;
      if (definition.requiresConfirmation) return false;
      if (definition.defaultRisk === 'dangerous' || definition.defaultRisk === 'forbidden') return false;
      return definition.defaultRisk === 'safe' || definition.defaultRisk === 'review';
    } catch {
      return false;
    }
  }

  private isFullProfileExposableTool(toolName: string, aliases: string[]): boolean {
    const names = Array.from(
      new Set([toolName, ...aliases].map((entry) => String(entry || '').trim()).filter(Boolean)),
    );
    for (const name of names) {
      if (isDestructiveExposureTool(name)) return false;
    }
    try {
      const definition = resolveDefaultAgentToolSecurityDefinition(toolName);
      return isFullProfileSecurityExposable({
        toolName,
        defaultRisk: definition?.defaultRisk,
        requiresConfirmation: definition?.requiresConfirmation,
      });
    } catch {
      return false;
    }
  }

  private repairToolCall(toolCall: ToolCall, knownToolNames: Set<string>): ToolCallRepair {
    const args = normalizeToolArguments(toolCall.arguments);
    const argsRepaired = args !== toolCall.arguments;
    if (knownToolNames.has(toolCall.name)) {
      return {
        toolCall: { ...toolCall, arguments: args },
        repaired: argsRepaired,
        reason: argsRepaired ? 'arguments-normalized' : undefined,
      };
    }

    const normalized = normalizeToolKey(toolCall.name);
    const exactByNormalized = [...knownToolNames].find((name) => normalizeToolKey(name) === normalized);
    if (exactByNormalized) {
      return {
        toolCall: { ...toolCall, name: exactByNormalized, arguments: args },
        repaired: true,
        reason: `repaired tool name ${toolCall.name} -> ${exactByNormalized}`,
      };
    }

    const aliasMatch = [...knownToolNames].find((name) =>
      resolveToolAliases(name).some((alias) => normalizeToolKey(alias) === normalized),
    );
    if (aliasMatch) {
      return {
        toolCall: { ...toolCall, name: aliasMatch, arguments: args },
        repaired: true,
        reason: `matched alias ${toolCall.name} -> ${aliasMatch}`,
      };
    }

    const candidates = this.findToolCandidates(toolCall.name, knownToolNames);
    if (candidates.length === 1) {
      return {
        toolCall: { ...toolCall, name: candidates[0]!, arguments: args },
        repaired: true,
        reason: `single fuzzy candidate ${toolCall.name} -> ${candidates[0]}`,
      };
    }

    return {
      toolCall: { ...toolCall, arguments: args },
      repaired: argsRepaired,
      reason: candidates.length > 0 ? `Closest exposed tools: ${candidates.slice(0, 3).join(', ')}.` : undefined,
    };
  }

  private findToolCandidates(toolName: string, knownToolNames: Set<string>): string[] {
    const normalized = normalizeToolKey(toolName);
    return [...knownToolNames]
      .map((candidate) => ({
        candidate,
        score: similarityScore(normalized, normalizeToolKey(candidate)),
      }))
      .filter((entry) => entry.score >= 0.55)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.candidate);
  }

  private handleToolCatalogCall(input: {
    run: UniversalAgentRun;
    request?: UniversalAgentRequest;
    toolCall: ToolCall;
    tools: ToolDefinition[];
    knownToolNames: Set<string>;
  }): { output: Record<string, unknown>; materializedTools: number } {
    const args = normalizeToolArguments(input.toolCall.arguments);
    const operation = normalizeText(args.operation || 'search').toLowerCase();
    const query = normalizeText(args.query || args.domain || input.request?.text || input.run.input);
    const limit = Math.min(
      MAX_CATALOG_MATERIALIZED_TOOLS,
      Math.max(1, numberFromUnknown(args.limit) || MAX_CATALOG_MATERIALIZED_TOOLS),
    );
    const state = this.toolCatalogByRun.get(input.run.id) || {
      allTools: input.tools,
      exposedToolNames: input.knownToolNames,
    };
    const ranked = this.rankCatalogTools(state.allTools, query).filter(
      (tool) => ![COMPACT_TOOL_CATALOG_NAME, TOOL_PLANNER_NAME].includes(tool.name),
    );

    if (operation === 'describe') {
      const toolName = normalizeText(args.toolName || query);
      const tool = ranked.find(
        (entry) => entry.name === toolName || normalizeToolKey(entry.name) === normalizeToolKey(toolName),
      );
      return {
        materializedTools: 0,
        output: {
          status: tool ? 'found' : 'not_found',
          tool: tool ? summarizeToolDefinition(tool) : null,
          query: toolName,
        },
      };
    }

    const matches = ranked.slice(0, limit);
    let materializedTools = 0;
    for (const tool of matches) {
      if (!input.knownToolNames.has(tool.name)) {
        input.tools.push(tool);
        input.knownToolNames.add(tool.name);
        state.exposedToolNames.add(tool.name);
        materializedTools += 1;
      }
    }
    this.toolCatalogByRun.set(input.run.id, state);
    return {
      materializedTools,
      output: {
        status: 'ok',
        query,
        materializedTools: matches.map(summarizeToolDefinition),
        note:
          materializedTools > 0
            ? 'Matching governed tools were materialized for the next native tool round.'
            : 'Matching governed tools were already exposed.',
      },
    };
  }

  private rankCatalogTools(tools: ToolDefinition[], query: string): ToolDefinition[] {
    const normalizedQuery = normalizeText(query).toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter((entry) => entry.length > 2);
    return [...tools].sort((left, right) => score(right) - score(left));

    function score(tool: ToolDefinition): number {
      const haystack = `${tool.name} ${tool.description || ''} ${tool.category || ''}`.toLowerCase();
      let total = haystack.includes(normalizedQuery) && normalizedQuery ? 30 : 0;
      for (const token of tokens) {
        if (haystack.includes(token)) total += 4;
      }
      if (tool.dangerLevel === 'safe' || tool.requiresPermission === false) total += 2;
      return total;
    }
  }

  private handleToolPlanningCall(input: {
    run: UniversalAgentRun;
    request?: UniversalAgentRequest;
    toolCall: ToolCall;
    knownToolNames: Set<string>;
  }): Record<string, unknown> {
    const args = normalizeToolArguments(input.toolCall.arguments);
    const objective = normalizeText(args.objective || input.request?.text || input.run.input || input.run.title);
    const mode = normalizeText(args.mode || 'mixed').toLowerCase();
    const state = this.toolCatalogByRun.get(input.run.id);
    const allTools =
      state?.allTools ||
      [...input.knownToolNames].map((name) => ({
        name,
        description: name,
        parameters: { type: 'object' as const, properties: {} },
      }));
    const ranked = this.rankCatalogTools(allTools, objective)
      .filter((tool) => ![COMPACT_TOOL_CATALOG_NAME, TOOL_PLANNER_NAME].includes(tool.name))
      .slice(0, 6)
      .map(summarizeToolDefinition);
    const requestedSubagents = numberFromUnknown(args.subagentCount || args.subagents);
    const subagentRecommended = requestedSubagents > 0 || mode === 'parallel';
    return {
      status: 'planned',
      objective,
      mode,
      recommendedTools: ranked,
      subagents: {
        recommended: subagentRecommended,
        reason: subagentRecommended ? 'The objective is broad enough to benefit from governed read-only subagent lanes before mutation.'
          : 'Single-run tool use should be enough unless the model uncovers a broader branch.',
        suggestedRoles: subagentRecommended ? ['planner', 'auditor', 'qa'] : [],
      },
      executionRules: [
        'Use safe observation tools directly when exposed.',
        'Use zavorth_action for Zavorth configuration or runtime mutations.',
        'Defer real side effects to the mutation plane when the effect boundary requires approval.',
      ],
    };
  }

  private async recoverStopReasonIfNeeded(input: {
    input: {
      messages: ChatMessage[];
      tools: ToolDefinition[];
      options: LlmRunOptions;
    };
    result: LlmRuntimeResult;
    stopReasonRecoveryUsed: boolean;
  }): Promise<{ recovered: boolean; result: LlmRuntimeResult; previousFinishReason?: string }> {
    if (input.stopReasonRecoveryUsed || !this.llmRuntime) {
      return { recovered: false, result: input.result };
    }
    const finishReason = normalizeText(input.result.response.finishReason).toLowerCase();
    if (!/(length|max_tokens|incomplete|truncated|content_filter)/.test(finishReason)) {
      return { recovered: false, result: input.result };
    }
    input.input.messages.push({
      role: 'assistant',
      content: input.result.response.content || '',
    });
    input.input.messages.push({
      role: 'user',
      content:
        'Continue exactly from the interrupted response. If you intended to call a tool, emit only the valid governed tool call; otherwise finish the answer concisely.',
    });
    const recovered = await this.llmRuntime.chatDetailed(input.input.messages, input.input.tools, input.input.options);
    return {
      recovered: true,
      result: recovered,
      previousFinishReason: input.result.response.finishReason,
    };
  }

  private async executeToolWithRetry(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ExecuteToolAttemptResult> {
    if (!this.toolRuntime) {
      throw new Error('Tool runtime unavailable.');
    }
    try {
      return {
        output: await this.toolRuntime.executeTool(toolName, args),
        attempts: 1,
      };
    } catch (error: unknown) {
      if (!isTransientToolError(error)) {
        throw error;
      }
      await delay(120);
      return {
        output: await this.toolRuntime.executeTool(toolName, args),
        attempts: 2,
      };
    }
  }

  private listAlternateToolNames(failedToolName: string): string[] {
    const failed = normalizeToolKey(failedToolName);
    const definitions = Array.isArray(
      (this.toolRuntime as { listTools?: () => ToolDefinition[] } | null)?.listTools?.(),
    )
      ? (this.toolRuntime as unknown as { listTools: () => ToolDefinition[] }).listTools() || []
      : [];
    if (definitions.length > 0) {
      return definitions
        .map((entry) => normalizeText(entry.name))
        .filter((name) => name && normalizeToolKey(name) !== failed)
        .slice(0, 4);
    }
    const defaults = ['list_directory', 'read_file', 'web_search', 'get_datetime'];
    return defaults.filter((name) => normalizeToolKey(name) !== failed).slice(0, 3);
  }

  private async compactMessagesForNextTurn(
    messages: ChatMessage[],
    maxChars: number,
    options?: LlmRunOptions,
  ): Promise<{ compacted: boolean; truncatedToolMessages: number }> {
    if (estimateMessagesChars(messages) <= maxChars) {
      return { compacted: false, truncatedToolMessages: 0 };
    }
    let truncatedToolMessages = 0;

    const toCompactionMessages = () =>
      messages.map((m, index) => ({
        id: `native-msg-${index + 1}`,
        role: m.role as never,
        content: m.content || '',
        toolName: m.toolName || null,
        toolCallId: m.toolCallId || null,
        toolCalls: m.toolCalls || null,
      })) as import('../../services/ContextCompactionService.js').ContextCompactionMessage[];

    const applyCompactionMessages = (
      compacted: import('../../services/ContextCompactionService.js').ContextCompactionMessage[],
    ) => {
      const originalsByToolCallId = new Map<string, ChatMessage>();
      for (const original of messages) {
        if (original.toolCallId) {
          originalsByToolCallId.set(original.toolCallId, original);
        }
      }
      const mappedMessages: ChatMessage[] = compacted
        .map((entry) => {
          const prior = entry.toolCallId ? originalsByToolCallId.get(entry.toolCallId) : undefined;
          const role =
            entry.role === 'system' || entry.role === 'user' || entry.role === 'assistant' || entry.role === 'tool'
              ? entry.role
              : prior?.role || 'system';
          const mapped: ChatMessage = {
            role,
            content: typeof entry.content === 'string' ? entry.content : (prior?.content ?? ''),
          };
          const toolName = entry.toolName || prior?.toolName;
          const toolCallId = entry.toolCallId || prior?.toolCallId;
          const toolCalls = entry.toolCalls || prior?.toolCalls;
          if (toolName) mapped.toolName = toolName;
          if (toolCallId) mapped.toolCallId = toolCallId;
          if (toolCalls) mapped.toolCalls = toolCalls;
          if (prior?.inlineData) mapped.inlineData = prior.inlineData;
          return mapped;
        })
        .filter((message) => Boolean(message.content) || Boolean(message.toolCalls?.length));
      if (mappedMessages.length === 0) {
        return;
      }
      messages.length = 0;
      messages.push(...mappedMessages);
    };

    const runStructuralCompact = (): number => {
      try {
        const structural = this.compactionService.compact({
          messages: toCompactionMessages(),
          now: new Date(),
          lastActivityAt: new Date(0),
          usableContextTokens: Math.max(1_000, Math.floor(maxChars / 4)),
          reservedTokenBuffer: 0,
          recentVerbatimTurns: 4,
        });
        if (
          structural.triggered &&
          Array.isArray(structural.compactedMessages) &&
          structural.compactedMessages.length > 0
        ) {
          applyCompactionMessages(structural.compactedMessages);
          return Number(structural.clearedToolOutputs || 0) + Number(structural.compactedOlderMessages || 0);
        }
      } catch {
        // Fall through to semantic / static compaction.
      }
      return 0;
    };

    truncatedToolMessages += runStructuralCompact();

    if (this.llmRuntime && estimateMessagesChars(messages) > maxChars) {
      const providerAdapter: ILlmProvider = {
        name: this.llmRuntime.getPreferredProviderName?.() || 'active-provider',
        chat: async (msgs, tools, opts) => {
          const runResult = await this.llmRuntime!.chatDetailed(msgs, tools, {
            modelName: opts?.modelName,
            allowFallback: false,
          });
          return runResult.response;
        },
      };

      try {
        const result = await this.compactionService.compactSemanticAsync(
          toCompactionMessages(),
          providerAdapter,
          8,
          options?.modelName,
        );

        if (result.clearedToolOutputs > 0) {
          applyCompactionMessages(result.messages);
          truncatedToolMessages += result.clearedToolOutputs;
        }
      } catch {
        // Fall through to structural re-pass / static truncation.
      }
    }

    if (estimateMessagesChars(messages) > maxChars) {
      truncatedToolMessages += runStructuralCompact();
    }

    if (estimateMessagesChars(messages) > maxChars) {
      const protectedStart = 1;
      const protectedTail = Math.max(0, messages.length - 8);
      for (let index = protectedStart; index < protectedTail; index += 1) {
        const message = messages[index];
        if (!message?.content) continue;
        if (message.role === 'tool' && message.content.length > 1600) {
          message.content = `${message.content.slice(0, 1500).trim()}\n[tool result compacted before next round]`;
          truncatedToolMessages += 1;
        } else if (message.role === 'assistant' && message.content.length > 2400) {
          message.content = `${message.content.slice(0, 2200).trim()}\n[assistant turn compacted before next round]`;
        }
      }
    }

    if (estimateMessagesChars(messages) > maxChars) {
      const compactNotice: ChatMessage = {
        role: 'system',
        content:
          'Earlier native tool-loop context was compacted. Preserve user intent, receipts, approvals and latest tool observations; request catalog search again if you need a hidden tool.',
      };
      messages.splice(1, 0, compactNotice);
    }
    return { compacted: true, truncatedToolMessages };
  }

  private resolveContextBudgetChars(run: UniversalAgentRun, request?: UniversalAgentRequest): number {
    return Math.max(
      12_000,
      numberFromUnknown(request?.metadata?.nativeToolContextChars) ||
        numberFromUnknown(run.metadata.nativeToolContextChars) ||
        numberFromUnknown(process.env.ZAVORTH_NATIVE_TOOL_CONTEXT_CHARS) ||
        NATIVE_TOOL_CONTEXT_CHARS,
    );
  }

  private inferAdaptiveRoundBudget(run: UniversalAgentRun, request?: UniversalAgentRequest): number {
    let rounds = MAX_NATIVE_TOOL_ROUNDS;
    if ((request?.requestedTools || []).length >= 3 || run.toolExposure.tools.length >= 8) {
      rounds = Math.max(rounds, 8);
    }
    return rounds;
  }

  private async createPlanForDeferredEffect(input: {
    run: UniversalAgentRun;
    toolName: string;
    mapping: ToolEffectMapping;
    rehearsalEnvelope: ReturnType<typeof buildEffectRehearsalEnvelope>;
  }): Promise<{
    mutationPlan: ZavorthMutationPlan | null;
    speculativeAutonomy: ZavorthSpeculativeAutonomyResult | null;
    zCanvasSession: CanvasSpeculativeAutonomySyncSnapshot | null;
    terminalBackendPlan: Record<string, unknown> | null;
  }> {
    const args = input.mapping.actionIntent.args || {};
    const workspaceWrites = extractWorkspaceWritesFromToolArgs(args);
    const commands = extractCommandsFromToolArgs(args);
    const speculativeAutonomy = await this.prepareSpeculativeAutonomyForDeferredWrite({
      run: input.run,
      toolName: input.toolName,
      mapping: input.mapping,
      workspaceWrites,
    });
    const zCanvasSession = await syncSpeculativeAutonomyToCanvas({
      service: this.canvasSessions,
      result: speculativeAutonomy,
      engineId: 'shield',
    });
    const terminalBackendPlan = this.buildTerminalBackendPlan({
      run: input.run,
      mapping: input.mapping,
      commands,
    });
    if (speculativeAutonomy?.mutationPlan) {
      return {
        mutationPlan: speculativeAutonomy.mutationPlan,
        speculativeAutonomy,
        zCanvasSession,
        terminalBackendPlan,
      };
    }
    if (!this.mutationPlane || !input.mapping.analysis.hasRealSideEffect) {
      return {
        mutationPlan: null,
        speculativeAutonomy,
        zCanvasSession,
        terminalBackendPlan,
      };
    }
    const effect = input.mapping.analysis.effect;
    const hasProcessEffect =
      effect.processSpawn.length > 0 ||
      effect.deletes.some((resource) => resource.kind === 'process') ||
      commands.length > 0;
    const rollbackSteps = input.rehearsalEnvelope.rehearsal.rollbackPlan.steps
      .map((step) => step.summary)
      .filter(Boolean);
    const payload: Record<string, unknown> = {
      source: 'effect-boundary',
      toolName: input.toolName,
      actionIntent: input.mapping.actionIntent,
      effectBoundary: buildToolEffectBoundaryMetadata(input.mapping),
      effectRehearsal: input.rehearsalEnvelope,
      workspaceWrites,
      commands,
      affectedResources: {
        reads: effect.reads,
        writes: effect.writes,
        deletes: effect.deletes,
        networkEgress: effect.networkEgress,
        processSpawn: effect.processSpawn,
        persistence: effect.persistence,
        humanVisibleSend: effect.humanVisibleSend,
      },
    };
    const planInput: CreateZavorthMutationPlanInput = {
      domain: resolveMutationDomain(input.mapping),
      actionId: `effect-boundary:${input.run.id}:${input.mapping.toolCallId}`,
      title: `Effect Boundary: ${input.toolName}`,
      summary: `Side effect deferred by Effect Boundary for ${input.toolName}. Review sandbox/rehearsal before applying.`,
      requestedBy: input.run.userId,
      sourceSurface: `agent-run:${input.run.channel}`,
      riskLevel: input.mapping.decision.risk === 'danger' ? 'high' : 'medium',
      approvalRequired: true,
      approvalReason: 'Effect Boundary deferred this side effect until sandbox/rehearsal approval.',
      resourceImpact: {
        diskMb: Math.max(1, workspaceWrites.length),
        processCount: hasProcessEffect ? 1 : 0,
        externalExposure:
          effect.humanVisibleSend.length > 0
            ? 'public'
            : effect.networkEgress.length > 0
              ? 'network'
              : hasProcessEffect ? 'local'
                : 'none',
        recurring: false,
        notes: [
          'Created from deferred LLM native tool side effect.',
          `Effect policy rule: ${input.mapping.decision.rule}`,
        ],
      },
      readinessGates: [
        {
          id: `${input.rehearsalEnvelope.id}:readiness`,
          status:
            input.mapping.decision.action === 'require_admin_policy'
              ? 'blocked'
              : input.rehearsalEnvelope.rehearsal.status === 'prepared'
                ? 'warning'
                : 'blocked',
          canProceed:
            input.mapping.decision.action !== 'require_admin_policy' &&
            input.rehearsalEnvelope.rehearsal.status === 'prepared',
          scope: 'effect-boundary-rehearsal',
          reasons: input.mapping.decision.reasons,
          warnings: ['Mutation plan requires sandbox/rehearsal validation before apply.'],
          blockers: input.rehearsalEnvelope.rehearsal.blockers,
          checkedAt: new Date().toISOString(),
          nextActions: ['Review mutation plan', 'Run sandbox validation', 'Approve only after preview matches intent'],
        },
      ],
      validationPlan: ['Run sandbox validation before applying this mutation plan.'],
      rollbackPlan: rollbackSteps.length > 0 ? rollbackSteps : ['Review rollback evidence before commit.'],
      payload: {
        ...payload,
        ...(speculativeAutonomy
          ? { superZavorthSpeculativeAutonomy: buildSpeculativeAutonomyReceipt(speculativeAutonomy) }
          : {}),
        ...(zCanvasSession ? { zCanvasSession } : {}),
        ...(terminalBackendPlan ? { terminalBackendPlan } : {}),
      },
    };

    return {
      mutationPlan: this.mutationPlane.createPlan(planInput),
      speculativeAutonomy,
      zCanvasSession,
      terminalBackendPlan,
    };
  }

  private async prepareSpeculativeAutonomyForDeferredWrite(input: {
    run: UniversalAgentRun;
    toolName: string;
    mapping: ToolEffectMapping;
    workspaceWrites: Array<{ path: string; content: string }>;
  }): Promise<ZavorthSpeculativeAutonomyResult | null> {
    if (!this.speculativeAutonomy || input.workspaceWrites.length === 0) {
      return null;
    }
    const workspaceRoot = normalizeText(input.run.workspace || input.run.metadata.workspaceRoot);
    if (!workspaceRoot) {
      return null;
    }
    const preparedInput: PrepareZavorthSpeculativeAutonomyInput = {
      workspaceRoot,
      task: `LLM native tool ${input.toolName}: ${input.mapping.analysis.summary}`,
      writes: input.workspaceWrites,
      patches: [],
      validationMode: 'auto',
      runId: input.run.id,
      traceId: input.run.traceId,
      requestedBy: input.run.userId,
      sourceSurface: `agent-run:${input.run.channel}:native-tool-loop`,
      createMutationPlan: true,
      approvalRequired: true,
      maxCorrectionRounds: 1,
      sandboxIsolation: resolveSpeculativeSandboxIsolation(input.run),
    };
    try {
      return await this.speculativeAutonomy.prepare(preparedInput);
    } catch (error: unknown) {
      return null;
    }
  }

  private buildTerminalBackendPlan(input: {
    run: UniversalAgentRun;
    mapping: ToolEffectMapping;
    commands: string[];
  }): Record<string, unknown> | null {
    if (!this.terminalBackends || input.commands.length === 0) {
      return null;
    }
    try {
      const snapshot = this.terminalBackends.execute({
        action: 'terminal.plan',
        backend: resolveTerminalBackend(input.run),
        command: input.commands[0],
        workspace: normalizeText(input.run.workspace || input.run.metadata.workspaceRoot || process.cwd()),
        live: false,
        sourceSurface: `agent-run:${input.run.channel}:native-tool-loop`,
        actorId: input.run.userId,
      });
      return {
        contractVersion: snapshot.contractVersion,
        status: snapshot.status,
        selectedBackend: snapshot.selectedBackend,
        risk: snapshot.command.risk,
        approvalRequired: snapshot.command.approvalRequired,
        planMode: snapshot.plan.mode,
        willExecute: snapshot.plan.willExecute,
        reason: snapshot.plan.reason,
        nextSafeAction: snapshot.nextSafeAction,
      };
    } catch (error: unknown) {
      return null;
    }
  }

  private buildAppliedToolContinuityView(input: {
    seed: ReturnType<OperatorContinuityKernel['begin']>;
    toolName: string;
    ok: boolean;
    summary: string;
  }) {
    const child = this.toolRuntime?.getLastContinuityEnvelope?.() || null;
    let continuity = this.continuityKernel.correlate(input.seed, {
      parentContinuityId: input.seed.ids.continuityId,
      policyBrokerReceiptId:
        child?.ids.correlation?.policyBrokerReceiptId || child?.decision?.brokerReceipt?.receiptId || null,
      toolCallId: input.seed.ids.correlation?.toolCallId || null,
      runId: input.seed.ids.correlation?.runId || null,
      sessionId: input.seed.ids.correlation?.sessionId || null,
    });
    if (!continuity.request) {
      continuity = this.continuityKernel.recordRequest(continuity, {
        surface: 'agent-native-tool-loop',
        operation: 'tool.execute',
        target: input.toolName,
        sourceSurface: 'agent-native-tool-loop',
      });
    }
    if (child?.decision) {
      continuity = this.continuityKernel.attachDecision(continuity, {
        ...child.decision,
        reasons: [...(child.decision.reasons || [])],
      });
    } else if (!continuity.decision) {
      continuity = this.continuityKernel.attachDecision(continuity, {
        source: 'effect-boundary',
        action: input.ok ? 'allow' : 'deny',
        allowed: input.ok,
        rule: input.ok ? 'native-loop:applied' : 'native-loop:failed',
        reasons: [input.summary],
      });
    }
    if (child?.result) {
      continuity = this.continuityKernel.attachResult(continuity, { ...child.result });
    } else {
      continuity = this.continuityKernel.attachResult(
        continuity,
        resultFromToolOutcome({
          ok: input.ok,
          status: input.ok ? 'applied' : 'failed',
          summary: input.summary,
        }),
      );
    }
    continuity = this.continuityKernel.finalizeReceipt(continuity, {
      receiptId: child?.receipt?.receiptId || child?.ids.receiptId || undefined,
    });
    return this.continuityKernel.toPublicView(continuity);
  }

  private finalizeEffectBoundaryContinuity(input: {
    run: UniversalAgentRun;
    toolCall: ToolCall;
    mapping: ToolEffectMapping;
    status: 'blocked' | 'deferred';
    summary: string;
    mutationPlanId?: string | null;
  }) {
    let continuity = this.continuityKernel.begin({
      correlation: {
        runId: input.run.id,
        sessionId: String(input.run.sessionId || input.run.metadata?.sessionId || '').trim() || null,
        toolCallId: input.toolCall.id,
        mutationPlanId: input.mutationPlanId || null,
      },
    });
    continuity = this.continuityKernel.recordRequest(continuity, {
      surface: 'agent-native-tool-loop',
      operation: 'effect-boundary',
      target: input.toolCall.name,
      sourceSurface: 'agent-native-tool-loop',
      metadata: {
        status: input.status,
      },
    });
    continuity = this.continuityKernel.attachDecision(
      continuity,
      decisionFromEffectBoundary({
        action: input.mapping.decision.action,
        allowed: input.mapping.decision.allowed,
        rule: input.mapping.decision.rule,
        reasons: input.mapping.decision.reasons,
        risk: input.mapping.decision.risk,
        requiresApproval: input.mapping.decision.approvalRequired,
        mutationPlanId: input.mutationPlanId || null,
      }),
    );
    continuity = this.continuityKernel.attachResult(
      continuity,
      resultFromToolOutcome({
        ok: false,
        status: input.status,
        summary: input.summary,
        data: {
          ...(input.mutationPlanId ? { mutationPlanId: input.mutationPlanId } : {}),
        },
      }),
    );
    return this.continuityKernel.finalizeReceipt(continuity);
  }

  private shouldExposeWebSearch(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    aliases: string[],
    requested: Set<string>,
    exposed: Array<{ id: string; risk?: string; requiresApproval?: boolean }>,
  ): boolean {
    if (aliases.some((alias) => requested.has(alias))) {
      return true;
    }
    if (exposed.some((entry) => aliases.includes(entry.id.toLowerCase()))) {
      return true;
    }
    const metadata = {
      ...run.metadata,
      ...(request.metadata || {}),
    };
    // Structured flags only — free-text never auto-exposes web_search.
    return truthy(metadata.enableWebTools) || truthy(metadata.webSearchEnabled) || truthy(metadata.allowWebSearch);
  }
}
