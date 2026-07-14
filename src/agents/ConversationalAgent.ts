import { logger } from '../logger.js';
import * as os from 'os';
import { config } from '../config/index.js';
import type { ChatMessage, ToolDefinition } from '../providers/ILlmProvider.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import {
  type WorkspaceTaskKind,
  type WorkspaceTaskSubtype,
} from '../services/WorkspaceTaskKind.js';
import { resolveWorkspaceLlmStrategy } from '../services/WorkspaceLlmProfile.js';
import { ToolUsageTracker } from '../cognitive-firewall/ToolUsageTracker.js';
import {
  ExecutionEscalationPolicy,
  type ExecutionEscalationDecision,
  type ExecutionEscalationInput,
} from '../runtime/agent/ExecutionEscalationPolicy.js';
import { wrapToolOutputForLlm } from '../security/ToolOutputTrust.js';
import { TELEGRAM_COMMAND_CATALOG } from '../gateways/channels/telegram/commandCatalog.js';
import {
  CognitiveFirewall,
  type FirewallDecision,
  type ToolGatekeeperHintProfile,
} from '../cognitive-firewall/index.js';

import { ToolResultCache } from '../cognitive-firewall/ToolResultCache.js';
import { ContextAwareInjector } from '../cognitive-firewall/ContextAwareInjector.js';
import type { ContextEngine } from '../context-engine/ContextEngine.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';
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
type InlineData = Array<{ mimeType: string; data: string }>;
type ConversationalToolTelemetry = {
  exposedToolNames: string[];
  toolRounds: number;
  toolsCalled: string[];
  unknownToolCalls: string[];
  toolFailures: string[];
  toolReceiptCount: number;
};
type ConversationalResponse = {
  text?: string;
  action?: AgentRunAction;
  escalation?: ExecutionEscalationDecision;
  llm?: { providerName: string; modelName?: string };
  toolTelemetry?: ConversationalToolTelemetry;
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
  workspaceOperationalMemory?: Record<string, any> | null;
  userId?: string | null;
  chatId?: string | null;
  surface?: MessageChannel | null;
  workspaceContext?: string | null;
  requireContextEngine?: boolean;
  executionEscalation?: ConversationalStructuredEscalation | null;
  /** When false, post-turn durable learning write is skipped (e.g. non-operator Telegram). */
  allowLearningWrite?: boolean | null;
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
    if (runtime instanceof LlmRuntimeService || typeof (runtime as any).chatDetailed === 'function') {
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
    const llmStrategy = resolveWorkspaceLlmStrategy(
      options?.taskKind || 'unknown',
      options?.taskSubtype || 'unknown',
      {
        configuredProviderName: primaryProvider,
        isProviderUsable: (name) => this.llmRuntime.isProviderAvailable(name),
        workspaceMemory: options?.workspaceOperationalMemory,
      },
    );

    const allTools = this.getConversationalToolDefinitions();
    const systemInstruction = this.appendProductRuntimeContext(
      this.buildSystemInstruction(mode, options?.styleHints),
      options,
    );
    const contextDecision = await this.prepareContextDecision(
      userMessage,
      allTools,
      systemInstruction,
      inlineData,
      options,
    );
    // Free text does not auto-run tools. The model selects tools from the catalog.
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
    const requiredToolNames = new Set<string>(AGENT_BRAIN_TOOL_NAMES);
    const firewallDecision = contextDecision
      ? null
      : this.cognitiveFirewall.evaluate(userMessage, allTools);
    const toolPolicyInput = this.resolveConversationalToolPolicyInput(
      contextDecision,
      firewallDecision,
    );
    // Expose the full tool catalog (minus quarantine). Local intent never hides capabilities.
    const conversationalTools = this.mergeToolDefinitions(
      allTools,
      allTools,
      requiredToolNames,
      new Set(toolPolicyInput.quarantinedToolNames),
    );
    const exposedToolNames = conversationalTools.map((tool) => tool.name);
    const systemWithCatalog = this.appendToolCatalogBrain(systemInstruction, conversationalTools);
    const messages: ChatMessage[] = contextDecision
      ? this.injectToolCatalogIntoMessages(contextDecision.messages, conversationalTools)
      : [
        { role: 'system', content: systemWithCatalog },
        { role: 'user', content: userMessage, inlineData },
      ];

    const groundingEvidenceTexts: string[] = [];
    let toolReceiptCount = 0;
    const toolsCalled: string[] = [];
    const unknownToolCalls: string[] = [];
    const toolFailures: string[] = [];
    let toolRounds = 0;

    const firewallStats = contextDecision?.firewallStats || firewallDecision?.stats;
    if (firewallStats) {
      logger.info(firewallStats);
    }

    let { providerName, response } = await this.llmRuntime.chatDetailed(
      messages,
      conversationalTools.length > 0 ? conversationalTools : undefined,
      {
        providerName: llmStrategy.providerName,
        modelName: llmStrategy.modelName,
        allowFallback: llmStrategy.allowFallback,
        fallbackOrder: llmStrategy.fallbackOrder,
      },
    );

    for (let round = 0; round < MAX_CONVERSATIONAL_TOOL_ROUNDS; round += 1) {
      if (!response.toolCalls?.length || !this.toolRuntime || conversationalTools.length === 0) {
        break;
      }
      toolRounds += 1;

      const toolMessages: ChatMessage[] = [];
      const rawToolResults: string[] = [];
      const knownToolNames = new Set(conversationalTools.map((tool) => tool.name));
      for (const toolCall of response.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND)) {
        if (!knownToolNames.has(toolCall.name)) {
          unknownToolCalls.push(toolCall.name);
          const missing = [
            `Tool "${toolCall.name}" is not available in this turn.`,
            `Available tools: ${exposedToolNames.slice(0, 24).join(', ') || '(none)'}.`,
            'Do not invent results. Suggest a visible tool, slash command, or approval path.',
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
        try {
          const cachedResult = this.toolCache.get(toolCall.name, toolCall.arguments);
          if (cachedResult !== null) {
            toolResult = cachedResult;
          } else {
            const influencedByUntrustedContent = Boolean(inlineData?.length)
              || containsUntrustedContentMarker(messages)
              || containsUntrustedContentMarker(toolCall.arguments);
            const toolArguments = influencedByUntrustedContent
              ? withUntrustedInputMetadata(toolCall.arguments, 'conversation-contained-untrusted-evidence')
              : toolCall.arguments;
            toolResult = await this.toolRuntime.executeTool(toolCall.name, toolArguments);
            this.toolCache.set(toolCall.name, toolCall.arguments, toolResult);
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
        }
        toolsCalled.push(toolCall.name);
        rawToolResults.push(toolResult);
        groundingEvidenceTexts.push(`${toolCall.name}:\n${toolResult}`);
        toolReceiptCount += 1;
        toolMessages.push({
          role: 'tool',
          content: wrapToolOutputForLlm(toolCall.name, toolResult, {
            source: 'conversational_tool_result',
            tool_call_id: toolCall.id,
          }),
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
      }

      if (toolsCalled.length > 0) {
        this.usageTracker.recordTurn(
          this.sessionId || 'default',
          toolsCalled.slice(-MAX_TOOL_CALLS_PER_ROUND),
        );
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

      const followUp = await this.llmRuntime.chatDetailed(
        messages,
        conversationalTools.length > 0 ? conversationalTools : undefined,
        {
          providerName: llmStrategy.providerName,
          modelName: llmStrategy.modelName,
          allowFallback: llmStrategy.allowFallback,
          fallbackOrder: llmStrategy.fallbackOrder,
        },
      );
      providerName = followUp.providerName;
      response = followUp.response.content
        ? followUp.response
        : {
          ...followUp.response,
          content: rawToolResults.join('\n'),
        };
    }

    const toolTelemetry: ConversationalToolTelemetry = {
      exposedToolNames,
      toolRounds,
      toolsCalled: Array.from(new Set(toolsCalled)),
      unknownToolCalls: Array.from(new Set(unknownToolCalls)),
      toolFailures: Array.from(new Set(toolFailures)),
      toolReceiptCount,
    };
    logger.info(
      `[ConversationalAgent] tools rounds=${toolRounds} called=${toolTelemetry.toolsCalled.join(',') || 'none'} exposed=${exposedToolNames.length}`,
    );

    let responseText = response.content || '';
    if (!responseText.trim()) {
      if (toolFailures.length > 0) {
        responseText = `I could not complete this request cleanly. Tool failure(s): ${toolFailures.join(', ')}. I will not invent success.`;
      } else if (unknownToolCalls.length > 0) {
        responseText = `I tried unavailable tool(s): ${unknownToolCalls.join(', ')}. Visible tools include: ${exposedToolNames.slice(0, 16).join(', ') || '(none)'}.`;
      } else if (conversationalTools.length === 0) {
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
    const safeResponseText = hallucinationReview.outputText;
    const escalation = this.resolveExecutionEscalation(safeResponseText, mode, options);

    if (providerName !== llmStrategy.providerName) {
      logger.info(
        `[Fallback] Request served by ${providerName} (preferred ${llmStrategy.providerName} failed)`,
      );
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
        },
        toolTelemetry,
      };
    }

    this.schedulePostTurnLearning(
      userMessage,
      safeResponseText,
      toolReceiptCount,
      options?.surface || 'conversational',
      options?.userId,
      options?.allowLearningWrite,
    );

    return {
      text: safeResponseText,
      escalation,
      llm: {
        providerName,
        modelName: llmStrategy.modelName,
      },
      toolTelemetry,
    };
  }

  private appendToolCatalogBrain(systemInstruction: string, tools: ToolDefinition[]): string {
    if (!tools.length) {
      return [
        systemInstruction,
        '',
        '**AVAILABLE TOOLS:**',
        '- No tools are exposed for this turn. Answer from knowledge only, or say which slash/setup is needed.',
        '- Never invent tool results or external actions.',
      ].join('\n');
    }
    const lines = tools.slice(0, 40).map((tool) => {
      const desc = String(tool.description || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      return `- \`${tool.name}\`${desc ? `: ${desc}` : ''}`;
    });
    return [
      systemInstruction,
      '',
      '**AVAILABLE TOOLS:**',
      '- Prefer tools over guessing for current facts, files, teams, and side effects.',
      '- You may call tools in multiple steps: plan, act, read results, continue until done or blocked.',
      '- If a capability is missing, say so clearly. Never fake success.',
      '- Multi-agent work: use `zavorth_delegate` or `agent_manager` when visible.',
      '- If unsure which tool fits, use `capability_discovery` when visible.',
      '',
      ...lines,
      tools.length > 40 ? `- …and ${tools.length - 40} more tools` : '',
    ].filter(Boolean).join('\n');
  }

  private injectToolCatalogIntoMessages(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): ChatMessage[] {
    if (!messages.length) {
      return [{ role: 'system', content: this.appendToolCatalogBrain('', tools) }];
    }
    const cloned = messages.map((entry) => ({ ...entry }));
    const firstSystem = cloned.findIndex((entry) => entry.role === 'system');
    if (firstSystem >= 0) {
      cloned[firstSystem] = {
        ...cloned[firstSystem],
        content: this.appendToolCatalogBrain(String(cloned[firstSystem].content || ''), tools),
      };
      return cloned;
    }
    return [{ role: 'system', content: this.appendToolCatalogBrain('', tools) }, ...cloned];
  }

  private appendProductRuntimeContext(
    systemInstruction: string,
    options?: ConversationalChatOptions | null,
  ): string {
    try {
      const { getProductSurfaceRuntime } = require('../services/ZavorthProductSurfaceRuntimeService.js') as typeof import('../services/ZavorthProductSurfaceRuntimeService.js');
      return getProductSurfaceRuntime(process.cwd()).appendInjectBlocks(systemInstruction, {
        userId: options?.userId || null,
      });
    } catch {
      return systemInstruction;
    }
  }

  private schedulePostTurnLearning(
    userMessage: string,
    assistantText: string,
    toolReceiptCount: number,
    sourceSurface: string,
    userId?: string | null,
    allowLearningWrite?: boolean | null,
  ): void {
    if (!String(assistantText || '').trim()) return;
    try {
      const { getProductSurfaceRuntime } = require('../services/ZavorthProductSurfaceRuntimeService.js') as typeof import('../services/ZavorthProductSurfaceRuntimeService.js');
      getProductSurfaceRuntime(process.cwd()).scheduleSuccessfulTurn({
        userId: userId || null,
        surface: sourceSurface || 'conversational',
        userMessage: String(userMessage || ''),
        assistantText: String(assistantText || ''),
        toolCallCount: toolReceiptCount,
        allowLearningWrite,
      });
    } catch {
    }
  }

  public buildSystemInstruction(mode: ConversationalMode = 'default', styleHints?: string[]): string {
    const currentDate = new Date().toLocaleDateString('en-US');
    const platform = os.platform();
    const arch = os.arch();
    const workspace = process.cwd();
    const commandsList = TELEGRAM_COMMAND_CATALOG.map((command) => {
      const usage = command.usage ? ` ${command.usage}` : '';
      return `/${command.command}${usage} - ${command.description}`;
    }).join('\n');

    const lines = [
      'You are **Zavorth**, an intelligent, clear, and reliable personal assistant.',
      'Speak like a useful product assistant, not like an internal system. Prioritize clarity, naturalness, and objectivity.',
      'When the question is simple, answer simply. When it is technical, be technical only to the necessary level.',
      'Your priority is to feel like a reliable and pleasant assistant, not a diagnostics panel.',
      '',
      '**IDENTITY AND TONE:**',
      '- Answer as an assistant that genuinely helps with everyday work.',
      '- Avoid dumping architecture, executor names, risk labels, gateways, workflows, or internal jargon unless it is needed.',
      '- Do not call the user by a name that came only from automatic audio transcription; confirm first or use neutral wording.',
      '- Respond in English by default. Do not switch UI or product-facing language unless an explicit task requires translating user-provided content.',
      '- Do not recite the command list unless the user is asking for help, a menu, or capabilities.',
      '- For common questions, provide the answer first. Add extra context only if it genuinely helps.',
      '- If the user asks what Zavorth is, describe it briefly and warmly as an intelligent assistant/orchestrator.',
      '',
      '**MACHINE CONTEXT:**',
      `- Current date: ${currentDate}`,
      `- Current workspace: ${workspace}`,
      `- Platform: ${platform} (${arch})`,
      '',
      '**REAL CAPABILITIES:**',
      'You can converse, search, summarize, guide, and route tasks to specialized executors when that makes sense.',
      'The input channel does not limit your capabilities: voice and text requests can use the same available tools.',
      'When the user asks to list, switch, or pin an LLM provider/model, use the configure_llm_profile tool when available.',
      'When the user asks to change Zavorth configuration, operational state, or governance, use zavorth_action when available: first action.schema.lookup, then action.preview, and action.apply only with structured approval/confirmation.',
      'Do not invent slash commands, CLI commands, or shell commands for first-class Zavorth operations when an Action Harness action exists.',
      'When the request depends on current, unstable, or web-verifiable information, use web_search when available; do not say you lack real-time access without trying the tool.',
      'Use get_datetime when the answer depends on the current date/time.',
      'Use tools because they are genuinely needed, not because of fixed keywords: common recipes can be answered from general knowledge; viral recipes, prices, current positions, news, software versions, or trends require verification.',
      'For recommendations, comparisons, purchases, rankings, reports, sourced requests, and decisions that depend on external context, use source search/ranking instead of answering only from model memory.',
      'For any tool result, respect the evidence: if QUALITY_GATE, errors, weak sources, conflicting results, or insufficient data appear, state the limitation and answer only the supported part.',
      buildUntrustedContentFirewallInstruction(),
      this.hallucinationMitigation.buildInstruction(),
      'For medicine/health, law, finance, scientific research, markets, public policy, and current roles, treat the answer as evidence-sensitive: search sources when web_search is available and separate fact, interpretation, and caution.',
      'For scientific papers, prefer results with DOI, PubMed, SciELO, arXiv, journals, universities, or publishers; provide links and do not invent metadata.',
      'For law, prefer official sources, courts, legislation, case law, decisions, and dates; do not present the response as personalized legal advice.',
      'For health, prefer official sources, guidelines, PubMed/clinical trials, and reviews; do not present the response as a diagnosis or individual medical guidance.',
      'For complex requests such as reports with research, analysis, files, or charts, chain the required tools and deliver the best artifact possible.',
      'If the user asks for subagents, delegation, or specialists, decompose the task and use available specialized tools such as web search, external AI consultation, sandboxing, and file creation, then synthesize everything into a coherent final response.',
      'Destructive actions, credentials, purchases, third-party messages, dangerous shell commands, or sensitive desktop automation require clear confirmation or approval before execution.',
      'If the request is everyday work, you do not need to mention executors, gateways, workflows, risk, or internal architecture.',
      'Mention the executor used only if it genuinely helps the user understand what happened.',
      '',
      '**KNOWN COMMANDS (INTERNAL REFERENCE):**',
      commandsList,
      '',
      '**RULES:**',
      '1. Be clear and human. Avoid unnecessary jargon.',
      '2. Do not invent news, file states, or commands.',
      '3. If you do not know, say so directly.',
      '4. For task status questions, answer briefly and usefully.',
      '5. Do not turn ordinary questions into overly technical answers.',
      '6. In research and explanations, prefer clean, organized text that is easy to show to others.',
      '7. Avoid listing Zavorth internal details unless the user asked for them.',
      '',
    ];

    if (mode === 'direct') {
      const normalizedStyleHints = Array.from(
        new Set(
          (styleHints || [])
            .map((hint) => String(hint || '').trim())
            .filter(Boolean),
        ),
      );
      lines.push(
        '',
        '**DIRECT MODE:**',
        '- Answer the user directly without delegating to the autonomous engine.',
      );
      if (normalizedStyleHints.length > 0) {
        lines.push(
          '',
          '**PREFERRED FORMAT FOR THIS RESPONSE:**',
          ...normalizedStyleHints.map((hint) => `- ${hint}`),
        );
      }
    } else {
      lines.push(
        '',
        '**AUTONOMOUS DELEGATION:**',
        '- Answer the user naturally; operational routing is decided by structured policies outside the textual response.',
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
      mode === 'direct'
      || !escalation.shouldEscalate
      || escalation.target !== 'graph_runtime'
      || !escalation.taskGoal
      || escalation.requiresApproval
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
    const source: ConversationalToolPolicyInput['source'] = contextDecision
      ? 'context-engine'
      : firewallDecision
        ? 'cognitive-firewall'
        : 'none';
    const decision = contextDecision || firewallDecision || null;
    const hintProfile = decision?.toolHintProfile || null;
    const tools = hintProfile?.tools || decision?.tools || [];

    return {
      tools,
      source,
      recommendedToolNames: hintProfile?.recommendedToolNames
        || decision?.recommendedToolNames
        || tools.map((tool) => tool.name),
      toolExposureGatedByCognitiveFirewall: hintProfile?.toolExposureGatedByCognitiveFirewall === true
        || decision?.toolExposureGatedByCognitiveFirewall === true,
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
        throw new Error(
          'ContextEngine.prepareAsync e obrigatorio para conversa natural antes de chamar o LLM.',
        );
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

    return raw
      .replace(/^\s*\[Automatically transcribed audio\]\s*/i, '')
      .replace(/^\s*Detected language:\s*[^\n.]+[\n.]?\s*/i, '')
      .replace(/^\s*STT provider:\s*[^\n.]+[\n.]?\s*/i, '')
      .replace(/^\s*Use this transcript as an auditory draft[^\n.]*[\n.]?\s*/i, '')
      .replace(/^\s*Reply in the\s+same\s+language\s+as\s+the\s+transcript[^\n.]*[\n.]?\s*/i, '')
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
