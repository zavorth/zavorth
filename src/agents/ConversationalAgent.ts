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
import { EvidenceSearchRouter } from './EvidenceSearchRouter.js';
import { wrapToolOutputForLlm } from '../security/ToolOutputTrust.js';
import { ZavorthSubagentInvocationGatewayService } from '../services/ZavorthSubagentInvocationGatewayService.js';

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
  wrapUntrustedContent,
  withUntrustedInputMetadata,
} from '../security/UntrustedContent.js';

import { ZavorthHallucinationMitigationService } from '../services/ZavorthHallucinationMitigationService.js';
import {
  ZavorthSubagentAutoInvocationPolicyService,
  type ZavorthSubagentAutoInvocationInput,
} from '../services/ZavorthSubagentAutoInvocationPolicyService.js';

import type { ZavorthSubagentRuntimeSnapshot } from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import { asErrorLike } from '../utils/errorLike.js';
type InlineData = Array<{ mimeType: string; data: string }>;
type ConversationalResponse = {
  text?: string;
  action?: AgentRunAction;
  escalation?: ExecutionEscalationDecision;
  llm?: { providerName: string; modelName?: string };
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
};
type ConversationalToolRuntime = {
  getToolDefinitions(): ToolDefinition[];
  executeTool(toolName: string, args: unknown): Promise<string>;
};
type ConversationalAgentRuntime = {
  llmRuntime?: LlmRuntimeService;
  toolRuntime?: ConversationalToolRuntime | null;
  contextEngine?: Pick<ContextEngine, 'prepareAsync'> | null;
  subagentAutoInvocationPolicy?: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'> | null;
  subagentInvocationGateway?: Pick<ZavorthSubagentInvocationGatewayService, 'invokeFromTask' | 'renderReport'> | null;
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
const AUTO_WEB_SEARCH_LIMIT = 8;
const MAX_CONVERSATIONAL_TOOL_ROUNDS = 5;
const MAX_TOOL_CALLS_PER_ROUND = 8;

export class ConversationalAgent {
  private readonly llmRuntime: LlmRuntimeService;
  private readonly toolRuntime: ConversationalToolRuntime | null;
  private readonly contextEngine: Pick<ContextEngine, 'prepareAsync'> | null;
  private readonly cognitiveFirewall = new CognitiveFirewall();
  private readonly evidenceSearchRouter = new EvidenceSearchRouter();
  private readonly executionEscalationPolicy = new ExecutionEscalationPolicy();
  private readonly hallucinationMitigation = new ZavorthHallucinationMitigationService();
  private readonly subagentAutoInvocationPolicy: Pick<ZavorthSubagentAutoInvocationPolicyService, 'decide'> | null;
  private readonly subagentInvocationGateway: Pick<ZavorthSubagentInvocationGatewayService, 'invokeFromTask' | 'renderReport'> | null;

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
      this.subagentAutoInvocationPolicy = new ZavorthSubagentAutoInvocationPolicyService();
      this.subagentInvocationGateway = new ZavorthSubagentInvocationGatewayService();
      return;
    }

    this.llmRuntime = runtime.llmRuntime || new LlmRuntimeService();
    this.toolRuntime = runtime.toolRuntime || null;
    this.contextEngine = runtime.contextEngine || null;
    this.subagentAutoInvocationPolicy = runtime.subagentAutoInvocationPolicy === null
      ? null
      : runtime.subagentAutoInvocationPolicy || new ZavorthSubagentAutoInvocationPolicyService();
    this.subagentInvocationGateway = runtime.subagentInvocationGateway === null
      ? null
      : runtime.subagentInvocationGateway || new ZavorthSubagentInvocationGatewayService({
        toolRuntime: this.toolRuntime || null,
      });
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

    const naturalSubagentResponse = await this.maybeRunNaturalLiveSubagents(
      userMessage,
      inlineData,
      mode,
      options,
      {
        providerName: llmStrategy.providerName,
        modelName: llmStrategy.modelName,
      },
    );
    if (naturalSubagentResponse) {
      return naturalSubagentResponse;
    }

    const allTools = this.getConversationalToolDefinitions();
    const systemInstruction = this.buildSystemInstruction(mode, options?.styleHints);
    const contextDecision = await this.prepareContextDecision(
      userMessage,
      allTools,
      systemInstruction,
      inlineData,
      options,
    );
    const webSearchContext = await this.buildAutomaticWebSearchContext(
      userMessage,
      allTools,
      contextDecision?.messages,
    );
    const requiredToolNames = webSearchContext
      ? new Set(['web_search', 'get_datetime', 'query_external_ai'])
      : new Set<string>();
    const firewallDecision = contextDecision
      ? null
      : this.cognitiveFirewall.evaluate(userMessage, allTools);
    const toolPolicyInput = this.resolveConversationalToolPolicyInput(
      contextDecision,
      firewallDecision,
    );
    const conversationalTools = this.mergeToolDefinitions(
      toolPolicyInput.tools,
      allTools,
      requiredToolNames,
      new Set(toolPolicyInput.quarantinedToolNames),
    );
    const messages: ChatMessage[] = contextDecision
      ? [...contextDecision.messages]
      : [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userMessage, inlineData },
      ];

    if (webSearchContext) {
      messages.splice(1, 0, { role: 'system', content: webSearchContext });
    }
    const groundingEvidenceTexts: string[] = [];
    let toolReceiptCount = 0;
    if (webSearchContext) {
      groundingEvidenceTexts.push(`web_search:\n${webSearchContext}`);
      toolReceiptCount += 1;
    }

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

      const toolMessages: ChatMessage[] = [];
      const rawToolResults: string[] = [];
      const knownToolNames = new Set(conversationalTools.map((tool) => tool.name));
      for (const toolCall of response.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND)) {
        if (!knownToolNames.has(toolCall.name)) {
          continue;
        }

        let toolResult = '';
        try {
          // Check cache first (Improvement E: Tool Result Caching)
          const cachedResult = this.toolCache.get(toolCall.name, toolCall.arguments);
          if (cachedResult !== null) {
            toolResult = cachedResult;
          } else {
            const influencedByUntrustedContent = Boolean(webSearchContext)
              || Boolean(inlineData?.length)
              || containsUntrustedContentMarker(messages)
              || containsUntrustedContentMarker(toolCall.arguments);
            const toolArguments = influencedByUntrustedContent
              ? withUntrustedInputMetadata(toolCall.arguments, 'conversation-contained-untrusted-evidence')
              : toolCall.arguments;
            toolResult = toolCall.name === 'web_search' && webSearchContext
              ? webSearchContext
              : await this.toolRuntime.executeTool(toolCall.name, toolArguments);
            // Store in cache (Improvement E)
            this.toolCache.set(toolCall.name, toolCall.arguments, toolResult);
          }
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn('[Conversational Agent] process execution failed', error);
    const message = error instanceof Error ? err.message : String(error);
          toolResult = `Tool ${toolCall.name} failed: ${message}`;
  }
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

      // Record tool usage for predictive loading (Improvement A)
      if (rawToolResults.length > 0) {
        const toolNames = response.toolCalls
          .slice(0, MAX_TOOL_CALLS_PER_ROUND)
          .map((tc) => tc.name)
          .filter((name) => knownToolNames.has(name));
        if (toolNames.length > 0) {
          this.usageTracker.recordTurn(this.sessionId || 'default', toolNames);
        }
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

    const responseText = response.content || '';
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
        `[Fallback] Requisicao servida por ${providerName} (preferencial ${llmStrategy.providerName} falhou)`,
      );
    }

    const autonomousAction = this.buildAutonomousActionFromEscalation(escalation, mode);
    if (autonomousAction) {
      return {
        text: 'Acionando o motor autonomo para alterar o sistema...',
        action: autonomousAction,
        escalation,
        llm: {
          providerName,
          modelName: llmStrategy.modelName,
        },
      };
    }

    return {
      text: safeResponseText,
      escalation,
      llm: {
        providerName,
        modelName: llmStrategy.modelName,
      },
    };
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

  private async maybeRunNaturalLiveSubagents(
    userMessage: string,
    inlineData: InlineData | undefined,
    mode: ConversationalMode,
    options: ConversationalChatOptions | undefined,
    llm: { providerName: string; modelName?: string },
  ): Promise<ConversationalResponse | null> {
    if (!this.subagentAutoInvocationPolicy || !this.subagentInvocationGateway) {
      return null;
    }

    const decisionInput: ZavorthSubagentAutoInvocationInput = {
      text: userMessage,
      channel: options?.surface || 'conversation',
      mode,
      taskKind: options?.taskKind || null,
      taskSubtype: options?.taskSubtype || null,
      hasInlineData: Boolean(inlineData?.length),
      allowImplicit: true,
    };
    const decision = this.subagentAutoInvocationPolicy.decide(decisionInput);
    if (!decision.shouldInvoke) {
      return null;
    }

    try {
      const snapshot = await this.subagentInvocationGateway.invokeFromTask({
        text: userMessage,
        channel: options?.surface || 'conversation',
        actorId: options?.userId || null,
        threadId: options?.chatId || null,
        mode: decision.mode,
        roleIds: decision.roleIds,
        live: decision.live,
        providerName: llm.providerName,
        modelName: llm.modelName,
        maxLiveWorkers: decision.maxLiveWorkers,
        autoInvocation: decision.telemetry,
        persistState: false,
      });
      const text = this.renderNaturalSubagentResponse(snapshot, decision.telemetry.publicRationale);
      return {
        text,
        escalation: this.resolveExecutionEscalation(text, mode, options),
        llm,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (!decision.explicitSubagentRequest) {
        return null;
      }
      const message = error instanceof Error ? err.message : String(error);
      const text = `I tried to start subagents for this task, but the runtime rejected execution: ${message}`;
      return {
        text,
        escalation: this.resolveExecutionEscalation(text, mode, options),
        llm,
      };
    }
  }

  private renderNaturalSubagentResponse(
    snapshot: ZavorthSubagentRuntimeSnapshot,
    routeReason: string,
  ): string {
    if (snapshot.status === 'approval-required') {
      const reason = snapshot.receipts.at(-1)?.reasons.join(' ') || 'this action requires governed approval';
      return [
        'I can start subagents for this, but this request crosses a boundary that requires approval.',
        '',
        `Reason: ${reason}`,
        'After approval, I will continue through the same flow with receipts and limits applied.',
      ].join('\n');
    }

    if (snapshot.status === 'denied' || snapshot.status === 'blocked') {
      const reason = snapshot.timeline.at(-1)?.detail || 'policy broker blocked execution';
      return [
        'I did not start subagents for this request.',
        '',
        `Reason: ${reason}`,
      ].join('\n');
    }

    const run = snapshot.runs.find((entry) => entry.runId === snapshot.selectedRunId) || snapshot.runs.at(-1) || null;
    const autoTelemetry = snapshot.autoInvocationTelemetry.latest;
    const workerOutputs = (run?.workerResults || [])
      .filter((worker) => worker.status === 'completed')
      .map((worker) => `- ${worker.roleId}: ${firstMeaningfulLine(worker.summary || worker.output)}`)
      .slice(0, 4);
    const output = run?.output || run?.summary || snapshot.timeline.at(-1)?.detail || 'Subagents completed.';
    const lines = [
      'I started governed subagents for this task.',
      `Routing: ${routeReason}`,
    ];
    if (autoTelemetry) {
      lines.push(
        `Decision: ${autoTelemetry.selectedBy}; confidence ${autoTelemetry.confidence}; mode ${autoTelemetry.mode}.`,
        `Roles: ${autoTelemetry.roles.map((role) => `${role.roleId} - ${role.whySelected}`).join('; ') || 'n/a'}.`,
      );
    }
    if (workerOutputs.length > 0) {
      lines.push('', 'Subagent readout:', ...workerOutputs);
    }
    lines.push('', 'Synthesis:', output);
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

  private async buildAutomaticWebSearchContext(
    message: string,
    tools: ToolDefinition[],
    contextMessages?: ChatMessage[],
  ): Promise<string | null> {
    if (!this.toolRuntime || !tools.some((tool) => tool.name === 'web_search')) {
      return null;
    }

    const searchInput = this.buildSearchInputWithRecentContext(message, contextMessages);
    const webSearchNeed = this.evidenceSearchRouter.detect(searchInput);
    if (!webSearchNeed) {
      return null;
    }

    const query = searchInput !== message
      ? searchInput.slice(0, 900)
      : this.evidenceSearchRouter.buildQuery(searchInput, webSearchNeed);
    try {
      const searchResult = await this.toolRuntime.executeTool('web_search', {
        query,
        limit: AUTO_WEB_SEARCH_LIMIT,
        domainProfile: webSearchNeed.domain,
        deep: true,
        extractPages: true,
      });
      return [
        'Automatic web search context for this web-backed/evidence-sensitive request.',
        `Query: ${query}`,
        searchInput !== message ? `Current user request: ${message}` : '',
        `Detected need: ${webSearchNeed.reason}; domain: ${webSearchNeed.domain}; fresh: ${webSearchNeed.fresh ? 'yes' : 'no'}.`,
        'Use these sourced and ranked results for current, unstable, high-stakes, scientific, legal, medical, financial, or link-requested facts. Cite source/date when useful. Do not infer office holders, institutional roles, prices, discoveries, papers, cases, releases, scores, or breaking facts from model memory. Do not expose internal search windows or implementation limits as user-facing capability limits. If results include QUALITY_GATE or an error, state the limitation naturally and answer only what is supported.',
        buildUntrustedContentFirewallInstruction(),
        this.evidenceSearchRouter.buildContextGuidance(webSearchNeed),
        this.evidenceSearchRouter.buildAnswerPolicyGuidance(webSearchNeed),
        wrapUntrustedContent('untrusted_web_evidence', searchResult, {
          source: 'automatic_web_search',
          query,
        }),
      ].filter(Boolean).join('\n\n');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return [
        'Automatic web search failed for this recency-sensitive request.',
        `Error: ${message}`,
        'If the answer requires live information, explain that the search failed. If the request is stable general knowledge, you may still answer from general knowledge and disclose that live verification was unavailable.',
      ].join('\n');
    }
  }

  private buildSearchInputWithRecentContext(
    message: string,
    contextMessages?: ChatMessage[],
  ): string {
    const currentMessage = String(message || '').trim();
    if (!currentMessage || !this.isFollowUpEvidenceRequest(currentMessage)) {
      return currentMessage;
    }

    const recentContext = (contextMessages || [])
      .filter((entry) => entry.role === 'assistant' || entry.role === 'user')
      .slice(-6)
      .map((entry) => String(entry.content || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');

    if (!recentContext) {
      return currentMessage;
    }

    return [
      currentMessage,
      '',
      'Recent conversation context for resolving references such as "that news", "the cited story", "that", or "more details":',
      recentContext.slice(-2600),
    ].join('\n');
  }

  private isFollowUpEvidenceRequest(message: string): boolean {
    const normalized = String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const referenceMarker =
      /\b(essa|esse|isso|dessa|desse|sobre\s+ela|sobre\s+ele|que\s+voce\s+citou|que\s+citou|citada|citado|mencionada|mencionado|noticia\s+que|news\s+you\s+mentioned|that\s+story|that\s+news)\b/.test(normalized);
    const deepenMarker =
      /\b(explique|explica|detalhe|detalhes|aprofund[ae]|fale\s+mais|saiba\s+mais|resuma\s+melhor|contexto|por\s+que|impacto|consequencias?|more\s+details|explain|deep\s+dive)\b/.test(normalized);
    const evidenceMarker =
      /\b(noticia|noticias|news|fonte|fontes|link|links|artigo|caso|decisao|paper|estudo|descoberta)\b/.test(normalized);
    return (referenceMarker && (deepenMarker || evidenceMarker)) || (deepenMarker && evidenceMarker);
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

function firstMeaningfulLine(value: string, maxLength = 220): string {
  const line = String(value || '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)[0] || '';
  return line.length > maxLength ? `${line.slice(0, maxLength - 3)}...` : line;
}
