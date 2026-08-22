import { logger } from '../logger.js';
import * as os from 'os';
import { config } from '../config/index.js';
import type { ChatMessage, ILlmProvider, ToolDefinition } from '../providers/ILlmProvider.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { type WorkspaceTaskKind, type WorkspaceTaskSubtype } from '../services/WorkspaceTaskKind.js';
import { resolveWorkspaceLlmStrategy, type WorkspaceLlmStrategy } from '../services/WorkspaceLlmProfile.js';
import { normalizeRoleSurface, resolveLlmRoleScopeId } from '../contracts/runtime/LlmRoleRoutingContract.js';
import { LlmRoleRoutingService } from '../services/llm/LlmRoleRoutingService.js';
import { ToolUsageTracker } from '../cognitive-firewall/ToolUsageTracker.js';
import {
  ExecutionEscalationPolicy,
  type ExecutionEscalationDecision,
  type ExecutionEscalationInput,
} from '../runtime/agent/ExecutionEscalationPolicy.js';
import { wrapToolOutputForLlm } from '../security/ToolOutputTrust.js';
import {
  CognitiveFirewall,
  type FirewallDecision,
  type ToolGatekeeperHintProfile,
} from '../cognitive-firewall/index.js';

import { ToolResultCache } from '../cognitive-firewall/ToolResultCache.js';
import { ContextAwareInjector } from '../cognitive-firewall/ContextAwareInjector.js';
import { toCompact } from '../cognitive-firewall/LazyToolDefinition.js';
import type { ContextEngine } from '../context-engine/ContextEngine.js';
import {
  createStructuredAgentRunAction,
  type AgentRunAction,
} from '../contracts/runtime/StructuredAgentRunContract.js';

import {
  buildUntrustedContentFirewallInstruction,
  containsUntrustedContentMarker,
  withUntrustedInputMetadata,
} from '../security/UntrustedContent.js';

import { ZavorthHallucinationMitigationService } from '../services/ZavorthHallucinationMitigationService.js';
import { asErrorLike } from '../utils/errorLike.js';
import { authorizeHotPathToolCall, noteHotPathToolFailure } from '../services/AgentHotPathBudgetGate.js';
import { isLearningWriteAllowed } from '../services/ZavorthLearningWriteAuth.js';
import { ExperienceSkillLearningLoopService } from '../services/ExperienceSkillLearningLoopService.js';
import { getProductSurfaceRuntime } from '../services/ZavorthProductSurfaceRuntimeService.js';
import { isLearnedKnowledgeEnabled, buildLearnedKnowledgeInject } from '../services/learned-knowledge/index.js';
import { formatAboutYouInject } from '../services/learned-knowledge/AboutYouService.js';
import { captureConversationTurn } from '../services/learned-knowledge/ConversationContinuumCapture.js';
type InlineData = Array<{ mimeType: string; data: string }>;
type ConversationalToolTelemetry = {
  exposedToolNames: string[];
  toolRounds: number;
  toolsCalled: string[];
  unknownToolCalls: string[];
  toolFailures: string[];
  toolReceiptCount: number;
  /** Tools sent with full JSON schema this turn. */
  fullSchemaToolNames?: string[];
  /** Tools sent as compact stubs (lazy; expandable on call). */
  compactToolNames?: string[];
  /** Tools upgraded from compact → full during tool rounds. */
  expandedToolNames?: string[];
  /** Tool results shortened before LLM re-ingest. */
  truncatedToolResults?: number;
  /** Cache hits for read-only tools this turn. */
  toolCacheHits?: number;
  /** Times older tool history was compacted mid-turn. */
  historyCompactions?: number;
};

/** Always full-schema “brain” tools — enough for most free-text work. */
const AGENT_BRAIN_TOOL_NAMES = [
  'web_search',
  'get_datetime',
  'read_file',
  'create_file',
  'list_directory',
  'query_external_ai',
  'semantic_memory',
  'capability_discovery',
  'zavorth_delegate',
  'agent_manager',
  'zavorth_action',
] as const;

const LAZY_COMPACT_META_KEY = 'lazyCompact';
type ConversationalResponse = {
  text?: string;
  action?: AgentRunAction;
  escalation?: ExecutionEscalationDecision;
  llm?: { providerName: string; modelName?: string; role?: string; roleReason?: string };
  toolTelemetry?: ConversationalToolTelemetry;
  roleSetupHandled?: boolean;
};
type ConversationalMode = 'default' | 'direct';
type ConversationalStructuredEscalation = {
  target?: string | null;
  requestedTarget?: string | null;
  taskGoal?: string | null;
  payload?: string | null;
  requiresGraphRuntime?: boolean | null;
  complexObjective?: boolean | null;
  suggestedSubagents?: readonly string[] | null;
  requiresApproval?: boolean | null;
  modeEscalationRequest?: ExecutionEscalationInput['modeEscalationRequest'];
  metadata?: Record<string, unknown>;
};
type ConversationalChatOptions = {
  mode?: ConversationalMode;
  styleHints?: string[];
  taskKind?: WorkspaceTaskKind;
  taskSubtype?: WorkspaceTaskSubtype;
  workspaceOperationalMemory?: Record<string, unknown> | null;
  userId?: string | null;
  chatId?: string | null;
  /** Active chat surface for this turn (telegram, discord, whatsapp, desktop, cli, future ids…). */
  surface?: string | null;
  workspaceContext?: string | null;
  requireContextEngine?: boolean;
  executionEscalation?: ConversationalStructuredEscalation | null;
  /** When false, post-turn durable learning write is skipped (e.g. non-operator Telegram). */
  allowLearningWrite?: boolean | null;
  forceStrong?: boolean | null;
  effortHigh?: boolean | null;
  llmRole?: 'default' | 'strong' | 'background' | null;
  roleScopeId?: string | null;
};
type ConversationalToolRuntime = {
  getToolDefinitions(): ToolDefinition[];
  executeTool(toolName: string, args: unknown): Promise<string>;
};
type ConversationalAgentRuntime = {
  llmRuntime?: LlmRuntimeService;
  toolRuntime?: ConversationalToolRuntime | null;
  contextEngine?: Pick<ContextEngine, 'prepareAsync'> | null;
};
type ConversationalToolPolicyDecision = {
  tools?: ToolDefinition[];
  toolHintProfile?: ToolGatekeeperHintProfile;
  recommendedToolNames?: string[];
  toolExposureGatedByCognitiveFirewall?: boolean;
};
type ConversationalToolPolicyInput = {
  tools: ToolDefinition[];
  source: 'context-engine' | 'cognitive-firewall' | 'none';
  recommendedToolNames: string[];
  toolExposureGatedByCognitiveFirewall: boolean;
  hintGroups: string[];
  quarantinedToolNames: string[];
};
const MAX_CONVERSATIONAL_TOOL_ROUNDS = 8;
const MAX_TOOL_CALLS_PER_ROUND = 8;
/** Soft cap for tool text sent back to the model (~3k tokens). Full result stays in cache when cacheable. */
const MAX_TOOL_RESULT_CHARS_FOR_LLM = 12_000;
/** Keep this many most-recent tool messages fully expanded; older ones are summarized. */
const KEEP_RECENT_TOOL_MESSAGES = 4;
/** After this many tool rounds, compact older tool I/O before the next LLM call. */
const COMPACT_HISTORY_AFTER_ROUNDS = 2;

export class ConversationalAgent {
  private readonly llmRuntime: LlmRuntimeService;
  private readonly toolRuntime: ConversationalToolRuntime | null;
  private readonly contextEngine: Pick<ContextEngine, 'prepareAsync'> | null;
  private readonly cognitiveFirewall = new CognitiveFirewall();
  private readonly executionEscalationPolicy = new ExecutionEscalationPolicy();
  private readonly hallucinationMitigation = new ZavorthHallucinationMitigationService();

  // Cognitive Firewall improvements
  private readonly usageTracker = new ToolUsageTracker();
  private readonly toolCache = new ToolResultCache();
  private readonly toolInjector = new ContextAwareInjector();
  private sessionId = '';

  constructor(runtime: LlmRuntimeService | ConversationalAgentRuntime = {}) {
    if (runtime instanceof LlmRuntimeService || (typeof runtime === 'object' && runtime !== null && 'chatDetailed' in runtime && typeof (runtime as { chatDetailed?: unknown }).chatDetailed === 'function')) {
      this.llmRuntime = runtime as LlmRuntimeService;
      this.toolRuntime = null;
      this.contextEngine = null;
      return;
    }

    this.llmRuntime = runtime.llmRuntime || new LlmRuntimeService();
    this.toolRuntime = runtime.toolRuntime || null;
    this.contextEngine = runtime.contextEngine || null;
  }

  public async chat(
    message: string,
    inlineData?: InlineData,
    options?: ConversationalChatOptions,
  ): Promise<ConversationalResponse> {
    const userMessage = this.stripInternalVoicePreamble(message);
    const primaryProvider = String(config.llmProvider || '').trim();
    if (!primaryProvider) {
      throw new Error('No provider selected. Choose your default model/provider before chatting.');
    }
    const mode = options?.mode || 'default';
    // Surface is detected from the call site; setup is asked on whatever surface the user is on.
    const surface = normalizeRoleSurface(options?.surface);
    const roleScopeId =
      String(options?.roleScopeId || resolveLlmRoleScopeId({ userId: options?.userId, surface })).trim() || 'global';
    const roleService = new LlmRoleRoutingService();
    const isUsable = (name: string) => this.llmRuntime.isProviderAvailable(name);

    // Multi-surface role setup: intercept free text only when this scope is awaiting a reply.
    // Works on any surface that passed options.surface; skipped in unit tests unless opted in.
    const allowRoleSetupPath =
      process.env.NODE_ENV !== 'test' ||
      process.env.ZAVORTH_LLM_ROLE_AUTOPROMPT === '1' ||
      process.env.ZAVORTH_LLM_ROLE_SETUP_INTERCEPT === '1';
    try {
      if (allowRoleSetupPath) {
        const roleCfg = roleService.getConfig(roleScopeId);
        if (roleCfg.awaitingSetup || roleCfg.pendingConfirmation) {
          await roleService.refreshLiveCatalog(isUsable).catch(() => 0);
          const setupLlm: Pick<ILlmProvider, 'chat'> = {
            chat: async (messages) => {
              const result = await this.llmRuntime.chatDetailed(messages);
              return result.response;
            },
          };
          const setup = await roleService.handleInboundSetupMessage(roleScopeId, userMessage, setupLlm, isUsable);
          if (setup.handled && setup.reply) {
            return {
              text: setup.reply,
              roleSetupHandled: true,
              llm: {
                providerName: primaryProvider,
                role: 'setup',
                roleReason: 'llm_role_setup_reply',
              },
            };
          }
        }
      }
    } catch {
      // continue normal chat
    }

    const forceStrong = options?.forceStrong === true || roleService.isForceStrongActive(roleScopeId);
    const llmStrategy = resolveWorkspaceLlmStrategy(options?.taskKind || 'unknown', options?.taskSubtype || 'unknown', {
      configuredProviderName: primaryProvider,
      isProviderUsable: isUsable,
      workspaceMemory: options?.workspaceOperationalMemory,
      roleScopeId,
      forceStrong,
      effortHigh: options?.effortHigh === true,
      role: options?.llmRole || null,
    });
    if (llmStrategy.roleReason) {
      logger.info(`[ConversationalAgent] ${llmStrategy.roleReason}`);
    }
    if (llmStrategy.role) {
      roleService.recordRoleTurn(roleScopeId, llmStrategy.role);
    }

    const allTools = this.getConversationalToolDefinitions();
    const systemInstruction = this.appendProductRuntimeContext(
      this.buildSystemInstruction(mode, options?.styleHints),
      options,
      userMessage,
    );
    const contextDecision = await this.prepareContextDecision(
      userMessage,
      allTools,
      systemInstruction,
      inlineData,
      options,
    );
    // Free text does not auto-run tools. Lazy exposure: full schema for brain tools,
    // compact stubs for the rest (expand on call). Capabilities stay discoverable.
    const firewallDecision = contextDecision ? null : this.cognitiveFirewall.evaluate(userMessage, allTools);
    const toolPolicyInput = this.resolveConversationalToolPolicyInput(contextDecision, firewallDecision);
    const quarantined = new Set(toolPolicyInput.quarantinedToolNames);
    const fullRegistry = this.buildFullToolRegistry(allTools, quarantined);
    let activeTools = this.buildInitialLazyToolExposure(fullRegistry);
    const catalogNames = Array.from(fullRegistry.keys()).sort();
    const systemWithCatalog = this.appendToolCatalogBrain(systemInstruction, activeTools, catalogNames);
    const messages: ChatMessage[] = contextDecision
      ? this.injectToolCatalogIntoMessages(contextDecision.messages, activeTools, catalogNames)
      : [
          { role: 'system', content: systemWithCatalog },
          { role: 'user', content: userMessage, inlineData },
        ];

    const groundingEvidenceTexts: string[] = [];
    let toolReceiptCount = 0;
    const toolsCalled: string[] = [];
    const unknownToolCalls: string[] = [];
    const toolFailures: string[] = [];
    const expandedToolNames: string[] = [];
    let truncatedToolResults = 0;
    let toolCacheHits = 0;
    let historyCompactions = 0;
    let toolRounds = 0;

    const firewallStats = contextDecision?.firewallStats || firewallDecision?.stats;
    if (firewallStats) {
      logger.info(firewallStats);
    }

    let chatOptions = {
      providerName: llmStrategy.providerName,
      modelName: llmStrategy.modelName,
      allowFallback: llmStrategy.allowFallback,
      fallbackOrder: llmStrategy.fallbackOrder,
    };
    let { providerName, response } = await this.llmRuntime
      .chatDetailed(messages, activeTools.length > 0 ? activeTools : undefined, chatOptions)
      .catch(async (error: unknown) => {
        const roleRetry = this.tryStrongFallbackAfterDefaultFailure(roleScopeId, llmStrategy, error);
        if (!roleRetry) {
          throw error;
        }
        logger.info(`[ConversationalAgent] ${roleRetry.roleReason}`);
        chatOptions = {
          providerName: roleRetry.providerName,
          modelName: roleRetry.modelName,
          allowFallback: roleRetry.allowFallback,
          fallbackOrder: roleRetry.fallbackOrder,
        };
        return this.llmRuntime.chatDetailed(messages, activeTools.length > 0 ? activeTools : undefined, chatOptions);
      });

    for (let round = 0; round < MAX_CONVERSATIONAL_TOOL_ROUNDS; round += 1) {
      if (!response.toolCalls?.length || !this.toolRuntime || fullRegistry.size === 0) {
        break;
      }
      toolRounds += 1;

      const toolMessages: ChatMessage[] = [];
      const rawToolResults: string[] = [];
      for (const toolCall of response.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND)) {
        const ensured = this.ensureFullToolSchema(activeTools, fullRegistry, toolCall.name);
        activeTools = ensured.tools;
        if (ensured.expanded) {
          expandedToolNames.push(toolCall.name);
        }

        if (!fullRegistry.has(toolCall.name)) {
          unknownToolCalls.push(toolCall.name);
          const missing = [
            `Tool "${toolCall.name}" is not registered.`,
            `Discoverable tools include: ${catalogNames.slice(0, 24).join(', ') || '(none)'}.`,
            'Use capability_discovery when unsure. Never invent results.',
          ].join(' ');
          rawToolResults.push(missing);
          toolFailures.push(toolCall.name);
          toolMessages.push({
            role: 'tool',
            content: wrapToolOutputForLlm(toolCall.name, missing, {
              source: 'conversational_tool_result',
              tool_call_id: toolCall.id,
            }),
            toolCallId: toolCall.id,
            toolName: toolCall.name,
          });
          continue;
        }

        let toolResult = '';
        let fromCache = false;
        try {
          const argsRecord = (toolCall.arguments || {}) as Record<string, unknown>;
          const cachedResult = this.toolCache.get(toolCall.name, argsRecord);
          if (cachedResult !== null) {
            toolResult = cachedResult;
            fromCache = true;
            toolCacheHits += 1;
          } else {
            // Hot-path autonomy budget (actions / mutations) — shared store with partner missions.
            try {
              const budget = await authorizeHotPathToolCall({
                userId: options?.userId,
                sessionId: options?.chatId || this.sessionId,
                surface,
                toolName: toolCall.name,
              });
              if (!budget.allowed) {
                toolResult = [
                  `Tool "${toolCall.name}" blocked by autonomy budget: ${budget.blockers.join(' ') || 'limit exceeded'}.`,
                  'Do not invent success. Explain the limit and safer next steps.',
                ].join(' ');
                toolFailures.push(toolCall.name);
                noteHotPathToolFailure(options?.chatId || this.sessionId, options?.userId, surface);
                rawToolResults.push(toolResult);
                toolMessages.push({
                  role: 'tool',
                  content: wrapToolOutputForLlm(toolCall.name, toolResult, {
                    source: 'conversational_tool_result',
                    tool_call_id: toolCall.id,
                    budget_blocked: 'true',
                  }),
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                });
                continue;
              }
            } catch {
              // Budget gate optional if module unavailable.
            }
            const influencedByUntrustedContent =
              Boolean(inlineData?.length) ||
              containsUntrustedContentMarker(messages) ||
              containsUntrustedContentMarker(toolCall.arguments);
            const toolArguments = influencedByUntrustedContent
              ? withUntrustedInputMetadata(toolCall.arguments, 'conversation-contained-untrusted-evidence')
              : toolCall.arguments;
            toolResult = await this.toolRuntime.executeTool(toolCall.name, toolArguments);
            this.toolCache.set(toolCall.name, argsRecord, toolResult);
          }
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn('[Conversational Agent] process execution failed', error);
          const message = error instanceof Error ? err.message : String(error);
          toolResult = [
            `Tool ${toolCall.name} failed: ${message}`,
            'Do not invent success. Explain the failure and the next safe step.',
          ].join(' ');
          toolFailures.push(toolCall.name);
          try {
            noteHotPathToolFailure(options?.chatId || this.sessionId, options?.userId, surface);
          } catch {
            // optional
          }
        }

        // Grounding keeps fuller text; the model re-ingest path is budgeted.
        groundingEvidenceTexts.push(`${toolCall.name}:\n${toolResult}`);
        const forLlm = this.budgetToolResultForLlm(toolCall.name, toolResult, fromCache);
        if (forLlm.truncated) {
          truncatedToolResults += 1;
        }

        toolsCalled.push(toolCall.name);
        rawToolResults.push(forLlm.text);
        toolReceiptCount += 1;
        toolMessages.push({
          role: 'tool',
          content: wrapToolOutputForLlm(toolCall.name, forLlm.text, {
            source: 'conversational_tool_result',
            tool_call_id: toolCall.id,
            ...(fromCache ? { cache: 'hit' } : {}),
            ...(forLlm.truncated ? { truncated: 'true', original_chars: String(forLlm.originalChars) } : {}),
          }),
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
      }

      if (toolsCalled.length > 0) {
        this.usageTracker.recordTurn(this.sessionId || 'default', toolsCalled.slice(-MAX_TOOL_CALLS_PER_ROUND));
      }

      if (toolMessages.length === 0) {
        break;
      }

      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });
      messages.push(...toolMessages);

      if (toolRounds >= COMPACT_HISTORY_AFTER_ROUNDS) {
        const compacted = this.compactOlderToolHistory(messages, KEEP_RECENT_TOOL_MESSAGES);
        if (compacted > 0) {
          historyCompactions += 1;
        }
      }

      const followUp = await this.llmRuntime.chatDetailed(
        messages,
        activeTools.length > 0 ? activeTools : undefined,
        chatOptions,
      );
      providerName = followUp.providerName;
      response = followUp.response.content
        ? followUp.response
        : {
            ...followUp.response,
            content: rawToolResults.join('\n'),
          };
    }

    const fullSchemaToolNames = activeTools.filter((tool) => !this.isLazyCompactTool(tool)).map((tool) => tool.name);
    const compactToolNames = activeTools.filter((tool) => this.isLazyCompactTool(tool)).map((tool) => tool.name);
    const toolTelemetry: ConversationalToolTelemetry = {
      exposedToolNames: catalogNames,
      toolRounds,
      toolsCalled: Array.from(new Set(toolsCalled)),
      unknownToolCalls: Array.from(new Set(unknownToolCalls)),
      toolFailures: Array.from(new Set(toolFailures)),
      toolReceiptCount,
      fullSchemaToolNames,
      compactToolNames,
      expandedToolNames: Array.from(new Set(expandedToolNames)),
      truncatedToolResults,
      toolCacheHits,
      historyCompactions,
    };
    logger.info(
      `[ConversationalAgent] tools rounds=${toolRounds} called=${toolTelemetry.toolsCalled.join(',') || 'none'} exposed=${catalogNames.length} full=${fullSchemaToolNames.length} compact=${compactToolNames.length} trunc=${truncatedToolResults} cacheHits=${toolCacheHits} histCompact=${historyCompactions}`,
    );

    let responseText = response.content || '';
    if (!responseText.trim()) {
      if (toolFailures.length > 0) {
        responseText = `I could not complete this request cleanly. Tool failure(s): ${toolFailures.join(', ')}. I will not invent success.`;
      } else if (unknownToolCalls.length > 0) {
        responseText = `I tried unavailable tool(s): ${unknownToolCalls.join(', ')}. Visible tools include: ${catalogNames.slice(0, 16).join(', ') || '(none)'}.`;
      } else if (fullRegistry.size === 0) {
        responseText = 'No tools are available for this turn. Configure tools or use an explicit slash command.';
      }
    }

    const hallucinationReview = this.hallucinationMitigation.reviewResponse({
      requestText: userMessage,
      responseText,
      channel: options?.surface || null,
      evidenceTexts: groundingEvidenceTexts,
      toolReceiptCount,
    });
    let safeResponseText = hallucinationReview.outputText;
    const escalation = this.resolveExecutionEscalation(safeResponseText, mode, options);

    // Surface-agnostic setup prompt: append on the surface the user is currently using.
    try {
      const calm =
        toolRounds === 0 && toolFailures.length === 0 && !escalation?.shouldEscalate && Boolean(safeResponseText);
      const promptDecision = roleService.shouldPromptSetup(roleScopeId, isUsable, {
        calmTurn: calm,
        surface,
      });
      if (promptDecision.shouldPrompt) {
        const prompt = roleService.buildSurfaceSetupPrompt(roleScopeId, surface, isUsable);
        safeResponseText = `${safeResponseText || ''}${prompt}`.trim();
      }
    } catch {
      // optional
    }

    // Experience skill learning loop: multi-tool success → reviewable draft (+ improve on reuse).
    // Failed tool turns still call processTurn so similar drafts get failureCount demotion.
    // Same write gate as product-surface post-turn learning (public multi-tenant requires explicit true / allowlist).
    let learningWriteAllowed = false;
    try {
      learningWriteAllowed = isLearningWriteAllowed({
        surface,
        userId: options?.userId,
        chatId: options?.chatId,
        allowLearningWrite: options?.allowLearningWrite,
      });
    } catch {
      // Module load failure: fail closed on multi-tenant-looking surfaces; allow only explicit true.
      const surfaceHint = String(surface || '');
      const looksPublic = /telegram|discord|whatsapp|slack|signal|matrix|teams|irc|line|feishu|mattermost/i.test(
        surfaceHint,
      );
      learningWriteAllowed =
        options?.allowLearningWrite === true ||
        (options?.allowLearningWrite !== false && !looksPublic && Boolean(String(options?.userId || '').trim()));
    }
    try {
      const toolsOk = toolFailures.length === 0;
      const success = toolsOk && Boolean(safeResponseText);
      if (toolReceiptCount > 0 && learningWriteAllowed && (success || !toolsOk)) {
        const loop = new ExperienceSkillLearningLoopService({ projectRoot: process.cwd() });
        const learned = await loop.processTurn({
          userId: options?.userId,
          sessionId: options?.chatId || this.sessionId,
          surface,
          userMessage,
          assistantText: safeResponseText || '',
          toolsCalled: toolsCalled,
          toolCallCount: toolReceiptCount,
          toolFailures,
          outcome: success ? 'success' : 'failure',
        });
        if (learned.triggered && learned.userNudge) {
          safeResponseText = `${safeResponseText || ''}${learned.userNudge}`.trim();
        }
      }
    } catch {
      // learning loop optional
    }

    if (providerName !== llmStrategy.providerName) {
      logger.info(`[Fallback] Request served by ${providerName} (preferred ${llmStrategy.providerName} failed)`);
    }

    const autonomousAction = this.buildAutonomousActionFromEscalation(escalation, mode);
    if (autonomousAction) {
      return {
        text: 'Starting the autonomous runtime to change the system...',
        action: autonomousAction,
        escalation,
        llm: {
          providerName,
          modelName: llmStrategy.modelName,
          role: llmStrategy.role,
          roleReason: llmStrategy.roleReason,
        },
        toolTelemetry,
      };
    }

    if (learningWriteAllowed) {
      this.schedulePostTurnLearning(
        userMessage,
        safeResponseText,
        toolReceiptCount,
        options?.surface || 'conversational',
        options?.userId,
        options?.allowLearningWrite,
        options?.chatId,
      );
    }

    // Conversation continuum capture (Learned Knowledge · Conversation recall pillar).
    // Best-effort; never blocks the reply. AgentRun path also captures via bootstrapFoundation.
    try {
      captureConversationTurn({
        userMessage,
        assistantMessage: safeResponseText,
        sessionId: options?.chatId || this.sessionId,
        userId: options?.userId,
        surface: options?.surface || 'conversational',
        projectRoot: process.cwd(),
        source: 'ConversationalAgent.chat',
      });
    } catch {
      // optional
    }

    return {
      text: safeResponseText,
      escalation,
      llm: {
        providerName,
        modelName: llmStrategy.modelName,
        role: llmStrategy.role,
        roleReason: llmStrategy.roleReason,
      },
      toolTelemetry,
    };
  }

  private appendToolCatalogBrain(
    systemInstruction: string,
    tools: ToolDefinition[],
    catalogNames: string[] = [],
  ): string {
    if (!tools.length && catalogNames.length === 0) {
      return [
        systemInstruction,
        '',
        '**TOOLS:**',
        '- No tools are registered for this turn. Answer from knowledge only, or say which setup is needed.',
        '- Never invent tool results or external actions.',
      ].join('\n');
    }

    const fullNames = new Set(tools.filter((tool) => !this.isLazyCompactTool(tool)).map((tool) => tool.name));
    const coreLines = tools
      .filter((tool) => fullNames.has(tool.name))
      .map((tool) => {
        const desc = String(tool.description || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100);
        return `- \`${tool.name}\`${desc ? `: ${desc}` : ''} (full schema)`;
      });
    const deferred = catalogNames.filter((name) => !fullNames.has(name));
    const deferredPreview = deferred
      .slice(0, 48)
      .map((name) => `\`${name}\``)
      .join(', ');

    return [
      systemInstruction,
      '',
      '**TOOLS (lazy):**',
      '- Prefer tools over guessing for current facts, files, teams, and side effects.',
      '- Prefer **1–3 tool rounds**. Batch independent tool calls in the **same** step when possible.',
      '- Prefer **one focused** `web_search` (or tool call) over many speculative ones.',
      '- Never invent tool results. If output is truncated, re-call with a narrower query/path — do not invent omitted text.',
      '- Core tools below have full parameter schemas in this turn.',
      '- Other product tools are compact stubs or listed by name; call them when needed (schema expands on use).',
      '- If unsure which tool fits, call `capability_discovery`.',
      '- Multi-agent: `zavorth_delegate` / `agent_manager` when listed.',
      '',
      '**Core (full schema):**',
      ...(coreLines.length > 0 ? coreLines : ['- (none in this turn)']),
      '',
      deferred.length > 0
        ? `**Also available (${deferred.length}, compact/lazy):** ${deferredPreview}${deferred.length > 48 ? ', …' : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private injectToolCatalogIntoMessages(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    catalogNames: string[] = [],
  ): ChatMessage[] {
    if (!messages.length) {
      return [{ role: 'system', content: this.appendToolCatalogBrain('', tools, catalogNames) }];
    }
    const cloned = messages.map((entry) => ({ ...entry }));
    const firstSystem = cloned.findIndex((entry) => entry.role === 'system');
    if (firstSystem >= 0) {
      cloned[firstSystem] = {
        ...cloned[firstSystem],
        content: this.appendToolCatalogBrain(String(cloned[firstSystem].content || ''), tools, catalogNames),
      };
      return cloned;
    }
    return [{ role: 'system', content: this.appendToolCatalogBrain('', tools, catalogNames) }, ...cloned];
  }

  private buildFullToolRegistry(
    allTools: ToolDefinition[],
    quarantinedToolNames: Set<string>,
  ): Map<string, ToolDefinition> {
    const registry = new Map<string, ToolDefinition>();
    for (const tool of allTools || []) {
      if (!tool?.name || quarantinedToolNames.has(tool.name)) {
        continue;
      }
      registry.set(tool.name, tool);
    }
    return registry;
  }

  private buildInitialLazyToolExposure(fullRegistry: Map<string, ToolDefinition>): ToolDefinition[] {
    const brain = new Set<string>(AGENT_BRAIN_TOOL_NAMES);
    const exposed: ToolDefinition[] = [];
    const seen = new Set<string>();

    for (const name of AGENT_BRAIN_TOOL_NAMES) {
      const full = fullRegistry.get(name);
      if (!full || seen.has(name)) continue;
      exposed.push(full);
      seen.add(name);
    }

    for (const [name, full] of fullRegistry) {
      if (seen.has(name) || brain.has(name)) continue;
      exposed.push(this.toLazyCompactToolDefinition(full));
      seen.add(name);
    }

    return exposed;
  }

  private toLazyCompactToolDefinition(tool: ToolDefinition): ToolDefinition {
    const compact = toCompact(tool);
    return {
      name: tool.name,
      description: compact.description || tool.name,
      category: tool.category,
      dangerLevel: tool.dangerLevel,
      requiresPermission: tool.requiresPermission,
      metadata: {
        ...(tool.metadata || {}),
        [LAZY_COMPACT_META_KEY]: true,
      },
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  private isLazyCompactTool(tool: ToolDefinition): boolean {
    return tool?.metadata?.[LAZY_COMPACT_META_KEY] === true;
  }

  private tryStrongFallbackAfterDefaultFailure(
    roleScopeId: string,
    current: WorkspaceLlmStrategy,
    error: unknown,
  ): WorkspaceLlmStrategy | null {
    try {
      const roles = new LlmRoleRoutingService().getConfig(roleScopeId);
      if (!roles.strongOnDefaultFailure || !roles.strong) {
        return null;
      }
      if (current.role === 'strong') {
        return null;
      }
      const message = error instanceof Error ? error.message : String(error || '');
      if (!/429|rate|quota|unavailable|timeout|ECONN|5\d\d/i.test(message)) {
        return null;
      }
      return resolveWorkspaceLlmStrategy('unknown', 'unknown', {
        configuredProviderName: current.providerName,
        isProviderUsable: (name) => this.llmRuntime.isProviderAvailable(name),
        roleScopeId,
        defaultFailed: true,
      });
    } catch {
      return null;
    }
  }

  private ensureFullToolSchema(
    activeTools: ToolDefinition[],
    fullRegistry: Map<string, ToolDefinition>,
    toolName: string,
  ): { tools: ToolDefinition[]; expanded: boolean } {
    const full = fullRegistry.get(toolName);
    if (!full) {
      return { tools: activeTools, expanded: false };
    }

    const current = activeTools.find((tool) => tool.name === toolName);
    if (current && !this.isLazyCompactTool(current)) {
      return { tools: activeTools, expanded: false };
    }

    const byName = new Map(activeTools.map((tool) => [tool.name, tool]));
    byName.set(toolName, full);
    return { tools: Array.from(byName.values()), expanded: true };
  }

  /**
   * Budget tool text for the next LLM turn. Full output remains in ToolResultCache when cacheable.
   */
  private budgetToolResultForLlm(
    toolName: string,
    result: string,
    fromCache: boolean,
  ): { text: string; truncated: boolean; originalChars: number } {
    const original = String(result ?? '');
    const originalChars = original.length;
    if (originalChars <= MAX_TOOL_RESULT_CHARS_FOR_LLM) {
      const prefix = fromCache ? `[cache hit for ${toolName}]\n` : '';
      return { text: prefix + original, truncated: false, originalChars };
    }

    const head = original.slice(0, MAX_TOOL_RESULT_CHARS_FOR_LLM);
    const omitted = originalChars - MAX_TOOL_RESULT_CHARS_FOR_LLM;
    const note = [
      '',
      `[truncated tool output: showing ${MAX_TOOL_RESULT_CHARS_FOR_LLM} of ${originalChars} chars; ${omitted} omitted]`,
      'If you need more, re-call the same tool with a narrower query, path, or limit — do not invent the omitted content.',
    ].join('\n');
    const prefix = fromCache ? `[cache hit for ${toolName}]\n` : '';
    return { text: prefix + head + note, truncated: true, originalChars };
  }

  /**
   * Summarize older tool messages so multi-round turns do not re-send full I/O every time.
   * Keeps the most recent `keepRecent` tool messages intact. Mutates `messages` in place.
   * @returns number of tool messages compacted
   */
  private compactOlderToolHistory(messages: ChatMessage[], keepRecent: number): number {
    const toolIndexes: number[] = [];
    for (let i = 0; i < messages.length; i += 1) {
      if (messages[i]?.role === 'tool') {
        toolIndexes.push(i);
      }
    }
    if (toolIndexes.length <= keepRecent) {
      return 0;
    }

    const toCompact = toolIndexes.slice(0, toolIndexes.length - keepRecent);
    let compacted = 0;
    for (const idx of toCompact) {
      const msg = messages[idx];
      const raw = String(msg.content || '');
      if (raw.includes('[compacted tool history]')) {
        continue;
      }
      const toolName = String(msg.toolName || 'tool');
      const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
      messages[idx] = {
        ...msg,
        content: [
          `[compacted tool history] tool=${toolName} original_chars=${raw.length}`,
          preview ? `preview: ${preview}${raw.length > 240 ? '…' : ''}` : 'preview: (empty)',
          'Details were truncated to save context. Re-call the tool if you need the full payload again.',
        ].join('\n'),
      };
      compacted += 1;
    }
    return compacted;
  }

  private appendProductRuntimeContext(
    systemInstruction: string,
    options?: ConversationalChatOptions | null,
    userMessage?: string | null,
  ): string {
    let next = systemInstruction;
    try {
      next = getProductSurfaceRuntime(process.cwd()).appendInjectBlocks(next, {
        userId: options?.userId || null,
      });
    } catch {
      // optional
    }
    // unified Learned Knowledge pack (workflows + conversation + about you + knowledge)
    // with hard token budget. Falls back to legacy dual inject if pack path fails.
    try {
      if (isLearnedKnowledgeEnabled()) {
        const packBlock = buildLearnedKnowledgeInject({
          userId: options?.userId || null,
          userMessage: userMessage || null,
          surface: options?.surface || null,
          projectRoot: process.cwd(),
        });
        if (packBlock) {
          next = `${next}\n\n${packBlock}`;
          return next;
        }
      }
    } catch {
      // fall through to legacy
    }
    try {
      const block = new ExperienceSkillLearningLoopService({ projectRoot: process.cwd() }).formatInjectBlock(
        options?.userId,
        5,
        {
          userMessage: userMessage || null,
          fullProcedureTopK: 2,
        },
      );
      if (block) {
        next = `${next}\n\n${block}`;
      }
    } catch {
      // optional
    }
    try {
      const about = formatAboutYouInject(options?.userId, process.cwd());
      if (about) {
        next = `${next}\n\n${about}`;
      }
    } catch {
      // optional
    }
    return next;
  }

  private schedulePostTurnLearning(
    userMessage: string,
    assistantText: string,
    toolReceiptCount: number,
    sourceSurface: string,
    userId?: string | null,
    allowLearningWrite?: boolean | null,
    chatId?: string | null,
  ): void {
    if (!String(assistantText || '').trim()) return;
    try {
      getProductSurfaceRuntime(process.cwd()).scheduleSuccessfulTurn({
        userId: userId || null,
        surface: sourceSurface || 'conversational',
        userMessage: String(userMessage || ''),
        assistantText: String(assistantText || ''),
        toolCallCount: toolReceiptCount,
        allowLearningWrite,
        chatId: chatId || null,
      });
    } catch (error) { logger.debug('Product surface scheduling skipped', { error: asErrorLike(error) }); }
  }

  public buildSystemInstruction(mode: ConversationalMode = 'default', styleHints?: string[]): string {
    const currentDate = new Date().toLocaleDateString('en-US');
    const platform = os.platform();
    const arch = os.arch();
    const workspace = process.cwd();

    const lines = [
      'You are **Zavorth**, a clear, reliable personal assistant.',
      'Be concise. Prefer answers over internal jargon. Voice and text share the same tools.',
      '',
      '**CONTEXT:**',
      `- Date: ${currentDate}`,
      `- Workspace: ${workspace}`,
      `- Platform: ${platform} (${arch})`,
      '',
      '**HOW TO WORK:**',
      '- Use tools when facts need verification, files change, or side effects are required; not for fixed keywords.',
      '- Prefer `web_search` for current/unstable facts; `get_datetime` for clock time; `zavorth_action` for product config (schema → preview → apply).',
      '- Keep tool use efficient: 1–3 rounds, batch parallel reads/searches, one strong search over many weak ones.',
      '- Respect tool evidence (QUALITY_GATE, errors, weak sources, truncation notes). Never invent success or sources.',
      '- High-stakes topics (health, law, finance, research): search when tools allow; separate fact vs interpretation; not personalized professional advice.',
      '- Destructive or sensitive actions need clear confirmation/approval first.',
      '- Slash/UI commands exist for ops; do not dump command menus unless the user asks for help or capabilities.',
      buildUntrustedContentFirewallInstruction(),
      this.hallucinationMitigation.buildInstruction(),
      '',
      '**RULES:**',
      '1. Clear and human.',
      '2. Do not invent news, files, or commands.',
      '3. If you do not know, say so.',
    ];

    if (mode === 'direct') {
      const normalizedStyleHints = Array.from(
        new Set((styleHints || []).map((hint) => String(hint || '').trim()).filter(Boolean)),
      );
      lines.push('', '**DIRECT MODE:** Answer the user directly without autonomous engine delegation.');
      if (normalizedStyleHints.length > 0) {
        lines.push('', '**PREFERRED FORMAT:**', ...normalizedStyleHints.map((hint) => `- ${hint}`));
      }
    } else {
      lines.push(
        '',
        '**DEFAULT MODE:** Answer naturally; structured policies outside this text handle operational routing.',
      );
    }

    return lines.join('\n');
  }

  private resolveExecutionEscalation(
    responseText: string,
    mode: ConversationalMode,
    options?: ConversationalChatOptions,
  ): ExecutionEscalationDecision {
    const structured = options?.executionEscalation || null;
    return this.executionEscalationPolicy.resolve({
      responseText,
      mode,
      target: structured?.target,
      requestedTarget: structured?.requestedTarget,
      taskGoal: structured?.taskGoal,
      payload: structured?.payload,
      requiresGraphRuntime: structured?.requiresGraphRuntime,
      complexObjective: structured?.complexObjective,
      suggestedSubagents: structured?.suggestedSubagents,
      requiresApproval: structured?.requiresApproval,
      modeEscalationRequest: structured?.modeEscalationRequest,
      metadata: {
        ...(structured?.metadata || {}),
        conversationalAgent: {
          source: 'ConversationalAgent.chat',
          structuredEscalationRequested: Boolean(structured),
        },
      },
    });
  }

  private buildAutonomousActionFromEscalation(
    escalation: ExecutionEscalationDecision,
    mode: ConversationalMode,
  ): AgentRunAction | null {
    if (
      mode === 'direct' ||
      !escalation.shouldEscalate ||
      escalation.target !== 'graph_runtime' ||
      !escalation.taskGoal ||
      escalation.requiresApproval
    ) {
      return null;
    }

    return createStructuredAgentRunAction({
      payload: escalation.taskGoal,
      metadata: {
        source: 'ExecutionEscalationPolicy',
        reason: escalation.reason,
        canonicalEscalation: true,
      },
    });
  }

  private getConversationalToolDefinitions(): ToolDefinition[] {
    if (!this.toolRuntime) {
      return [];
    }

    return this.toolRuntime.getToolDefinitions();
  }

  private mergeToolDefinitions(
    filteredTools: ToolDefinition[],
    allTools: ToolDefinition[],
    requiredToolNames: Set<string>,
    quarantinedToolNames: Set<string> = new Set(),
  ): ToolDefinition[] {
    const byName = new Map<string, ToolDefinition>();

    for (const tool of filteredTools || []) {
      if (quarantinedToolNames.has(tool.name)) {
        continue;
      }
      byName.set(tool.name, tool);
    }

    for (const tool of allTools || []) {
      if (requiredToolNames.has(tool.name)) {
        if (quarantinedToolNames.has(tool.name)) {
          continue;
        }
        byName.set(tool.name, tool);
      }
    }

    return Array.from(byName.values());
  }

  private resolveConversationalToolPolicyInput(
    contextDecision: ConversationalToolPolicyDecision | null | undefined,
    firewallDecision: FirewallDecision | null | undefined,
  ): ConversationalToolPolicyInput {
    const source: ConversationalToolPolicyInput['source'] = contextDecision ? 'context-engine'
      : firewallDecision ? 'cognitive-firewall'
        : 'none';
    const decision = contextDecision || firewallDecision || null;
    const hintProfile = decision?.toolHintProfile || null;
    const tools = hintProfile?.tools || decision?.tools || [];

    return {
      tools,
      source,
      recommendedToolNames:
        hintProfile?.recommendedToolNames || decision?.recommendedToolNames || tools.map((tool) => tool.name),
      toolExposureGatedByCognitiveFirewall:
        hintProfile?.toolExposureGatedByCognitiveFirewall === true ||
        decision?.toolExposureGatedByCognitiveFirewall === true,
      hintGroups: hintProfile?.groups || [],
      quarantinedToolNames: hintProfile?.quarantinedToolNames || [],
    };
  }

  private async prepareContextDecision(
    message: string,
    allTools: ToolDefinition[],
    systemInstruction: string,
    inlineData: InlineData | undefined,
    options?: ConversationalChatOptions,
  ) {
    const userId = String(options?.userId || '').trim();
    const chatId = String(options?.chatId || '').trim();
    if (!this.contextEngine || !userId || !chatId) {
      if (options?.requireContextEngine) {
        throw new Error('ContextEngine.prepareAsync is required for natural conversation before calling the LLM.');
      }
      return null;
    }

    return this.contextEngine.prepareAsync(
      message,
      userId,
      chatId,
      options?.surface || 'telegram',
      allTools,
      systemInstruction,
      options?.workspaceContext || null,
      inlineData,
    );
  }

  private stripInternalVoicePreamble(message: string): string {
    const raw = String(message || '').trim();
    if (!raw) {
      return raw;
    }

    // Use a single regex to match all preamble patterns anywhere in the string
    return raw
      .replace(
        /\s*\[Automatically transcribed audio\]\s*|\s*STT provider:\s*[^\n.]+[\n.]?\s*|\s*Detected language:\s*[^\n.]+[\n.]?\s*|\s*Use this transcript as an auditory draft[^\n.]*[\n.]?\s*|\s*Reply in the\s+same\s+language\s+as\s+the\s+transcript[^\n.]*[\n.]?\s*/gi,
        ''
      )
      .trim();
  }

  /**
   * Set the session ID for tool usage tracking.
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Get cache statistics for monitoring.
   */
  public getCacheStats() {
    return this.toolCache.getStats();
  }

  /**
   * Get predictive loading statistics.
   */
  public getUsageStats() {
    return {
      activeSessions: this.usageTracker.getActiveSessionCount(),
      currentSessionTurns: this.sessionId ? this.usageTracker.getSessionTurnCount(this.sessionId) : 0,
    };
  }

  /**
   * Get predicted tools for the current session.
   */
  public getPredictedTools(currentIntentTools: string[] = []): string[] {
    if (!this.sessionId) return [];
    return this.usageTracker.predictNextTools(this.sessionId, currentIntentTools).predictedTools;
  }
}
