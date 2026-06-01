import * as os from 'os';
import { config } from '../config/index.js';
import type { ChatMessage, ToolDefinition } from '../providers/ILlmProvider.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import {
  type WorkspaceTaskKind,
  type WorkspaceTaskSubtype,
} from '../services/WorkspaceTaskKind.js';
import { resolveWorkspaceLlmStrategy } from '../services/WorkspaceLlmProfile.js';
import { TELEGRAM_COMMAND_CATALOG } from '../telegram/commandCatalog.js';
import {
  CognitiveFirewall,
  type FirewallDecision,
  type ToolGatekeeperHintProfile,
} from '../cognitive-firewall/index.js';
import type { ContextEngine } from '../context-engine/ContextEngine.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';
import {
  createStructuredAgentRunAction,
  type AgentRunAction,
} from '../contracts/StructuredAgentRunContract.js';
import {
  ExecutionEscalationPolicy,
  type ExecutionEscalationDecision,
  type ExecutionEscalationInput,
} from '../runtime/agent/ExecutionEscalationPolicy.js';
import { EvidenceSearchRouter } from './EvidenceSearchRouter.js';
import {
  buildUntrustedContentFirewallInstruction,
  containsUntrustedContentMarker,
  wrapUntrustedContent,
  withUntrustedInputMetadata,
} from '../security/UntrustedContent.js';
import { wrapToolOutputForLlm } from '../security/ToolOutputTrust.js';
import { ZavorthHallucinationMitigationService } from '../services/ZavorthHallucinationMitigationService.js';
import {
  ZavorthSubagentAutoInvocationPolicyService,
  type ZavorthSubagentAutoInvocationInput,
} from '../services/ZavorthSubagentAutoInvocationPolicyService.js';
import { ZavorthSubagentInvocationGatewayService } from '../services/ZavorthSubagentInvocationGatewayService.js';
import type { ZavorthSubagentRuntimeSnapshot } from '../contracts/ZavorthSubagentRuntimeContract.js';

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
  toolExposureGatedByCognitiveFirewall?: false;
};
type ConversationalToolPolicyInput = {
  tools: ToolDefinition[];
  source: 'context-engine' | 'cognitive-firewall' | 'none';
  recommendedToolNames: string[];
  toolExposureGatedByCognitiveFirewall: false;
  hintGroups: string[];
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
    const primaryProvider = config.llmProvider || 'gemini';
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
      console.log(firewallStats);
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
          const influencedByUntrustedContent = Boolean(webSearchContext)
            || containsUntrustedContentMarker(messages)
            || containsUntrustedContentMarker(toolCall.arguments);
          const toolArguments = influencedByUntrustedContent
            ? withUntrustedInputMetadata(toolCall.arguments, 'conversation-contained-untrusted-evidence')
            : toolCall.arguments;
          toolResult = toolCall.name === 'web_search' && webSearchContext
            ? webSearchContext
            : await this.toolRuntime.executeTool(toolCall.name, toolArguments);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
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
      console.log(
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
      'Voce e o **Zavorth**, um assistente pessoal inteligente, claro e confiavel.',
      'Fale como um assistente util de produto, nao como um sistema interno. Priorize clareza, naturalidade e objetividade.',
      'Quando a pergunta for simples, responda de forma simples. Quando for tecnica, seja tecnica so no nivel necessario.',
      'Sua prioridade e parecer um assistente confiavel e agradavel de usar, nao um painel de diagnostico.',
      '',
      '**IDENTIDADE E TOM:**',
      '- Responda como um assistente que ajuda de verdade no dia a dia.',
      '- Evite despejar arquitetura, nomes de executores, risco, gateway, workflow ou jargao interno sem necessidade.',
      '- Nao chame o usuario por um nome que veio apenas de transcricao automatica de audio; confirme antes ou use tratamento neutro.',
      '- Respond in English by default. Do not switch UI or product-facing language unless an explicit task requires translating user-provided content.',
      '- Nao recite a lista de comandos a menos que o usuario esteja pedindo ajuda, menu ou capacidades.',
      '- Para perguntas comuns, entregue a resposta primeiro. So depois acrescente contexto extra se isso realmente ajudar.',
      '- Se o usuario perguntar o que e o Zavorth, descreva-o como um assistente/orquestrador inteligente, de forma curta e amigavel.',
      '',
      '**CONTEXTO DA MAQUINA:**',
      `- Data atual: ${currentDate}`,
      `- Workspace atual: ${workspace}`,
      `- Plataforma: ${platform} (${arch})`,
      '',
      '**CAPACIDADES REAIS:**',
      'Voce pode conversar, pesquisar, resumir, orientar e encaminhar tarefas para executores especializados quando isso fizer sentido.',
      'O canal de entrada nao limita suas capacidades: pedidos por audio e por texto podem usar as mesmas ferramentas disponiveis.',
      'Quando o usuario pedir para listar, trocar ou fixar provider/modelo LLM, use a ferramenta configure_llm_profile quando ela estiver disponivel.',
      'Quando o usuario pedir para alterar configuracao, estado operacional ou governanca do Zavorth, use zavorth_action quando ela estiver disponivel: primeiro action.schema.lookup, depois action.preview, e action.apply apenas com approval/confirmacao estruturada.',
      'Nao invente slash commands, comandos CLI ou shell para operacoes de primeira classe do Zavorth quando uma acao do Action Harness existir.',
      'Quando o pedido depender de informacao atual, instavel ou verificavel na web, use web_search quando ela estiver disponivel; nao diga que nao tem acesso em tempo real sem tentar a ferramenta.',
      'Use get_datetime quando a resposta depender da data/hora atual.',
      'Use ferramentas por necessidade real, nao por palavra-chave fixa: receita comum pode ser respondida por conhecimento geral; receita viral, preco, cargo atual, noticias, versao de software ou tendencia pedem verificacao.',
      'Para recomendacoes, comparacoes, compras, rankings, relatorios, pedidos com fontes e decisoes que dependem de contexto externo, use busca/ranking de fontes em vez de responder so pela memoria do modelo.',
      'Para qualquer resultado de ferramenta, respeite evidencia: se vier QUALITY_GATE, erro, fonte fraca, resultado conflitante ou insuficiente, diga a limitacao e responda apenas a parte sustentada.',
      buildUntrustedContentFirewallInstruction(),
      this.hallucinationMitigation.buildInstruction(),
      'Para medicina/saude, direito, financas, pesquisa cientifica, mercado, politicas publicas e cargos atuais, trate a resposta como evidence-sensitive: procure fontes quando houver web_search e separe fato, interpretacao e cautela.',
      'Para artigos cientificos, prefira resultados com DOI, PubMed, SciELO, arXiv, journal, universidade ou publisher; entregue links e nao invente metadados.',
      'Para direito, prefira fontes oficiais, tribunais, legislacao, jurisprudencia, acordaos e datas; nao apresente como aconselhamento juridico personalizado.',
      'Para saude, prefira fontes oficiais, guidelines, PubMed/clinical trials e revisoes; nao apresente como diagnostico ou orientacao medica individual.',
      'Para pedidos complexos, como relatorios com pesquisa, analise, arquivos ou graficos, encadeie as ferramentas necessarias e entregue o melhor artefato possivel.',
      'Se o usuario pedir subagentes, delegacao ou especialistas, decomponha a tarefa e use as ferramentas especializadas disponiveis, como busca web, consulta a IA externa, sandbox e criacao de arquivos, sintetizando tudo em uma resposta final coerente.',
      'Acoes destrutivas, credenciais, compras, mensagens a terceiros, shell perigoso ou automacao de desktop sensivel exigem confirmacao clara ou approval antes de executar.',
      'Se o pedido for cotidiano, nao precisa falar de executor, gateway, workflow, risco ou arquitetura interna.',
      'So mencione o executor usado se isso realmente ajudar o usuario a entender o que aconteceu.',
      '',
      '**COMANDOS CONHECIDOS (REFERENCIA INTERNA):**',
      commandsList,
      '',
      '**REGRAS:**',
      '1. Seja claro e humano. Evite jargao desnecessario.',
      '2. Nao invente noticias, estados de arquivos ou comandos.',
      '3. Se nao souber, diga isso diretamente.',
      '4. Para perguntas sobre status de tarefa, responda de forma curta e util.',
      '5. Nao transforme perguntas comuns em respostas excessivamente tecnicas.',
      '6. Em pesquisas e explicacoes, prefira texto limpo, organizado e facil de mostrar para outras pessoas.',
      '7. Evite listar detalhes internos do Zavorth se o usuario nao tiver pedido isso.',
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
        '**MODO DIRETO:**',
        '- Responda diretamente ao usuario sem delegar para o motor autonomo.',
      );
      if (normalizedStyleHints.length > 0) {
        lines.push(
          '',
          '**FORMATO PREFERENCIAL DESTA RESPOSTA:**',
          ...normalizedStyleHints.map((hint) => `- ${hint}`),
        );
      }
    } else {
      lines.push(
        '',
        '**DELEGACAO AUTONOMA:**',
        '- Responda ao usuario de forma natural; o roteamento operacional e decidido por politicas estruturadas fora da resposta textual.',
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
      if (!decision.explicitSubagentRequest) {
        return null;
      }
      const message = error instanceof Error ? error.message : String(error);
      const text = `Tentei acionar subagentes para essa tarefa, mas o runtime recusou a execucao: ${message}`;
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
      const reason = snapshot.receipts.at(-1)?.reasons.join(' ') || 'esta acao precisa de aprovacao governada';
      return [
        'Posso acionar subagentes para isso, mas este pedido cruza uma fronteira que exige aprovacao.',
        '',
        `Motivo: ${reason}`,
        'Depois da aprovacao, eu continuo pelo mesmo fluxo com recibo e limites aplicados.',
      ].join('\n');
    }

    if (snapshot.status === 'denied' || snapshot.status === 'blocked') {
      const reason = snapshot.timeline.at(-1)?.detail || 'policy broker bloqueou a execucao';
      return [
        'Nao acionei subagentes para esse pedido.',
        '',
        `Motivo: ${reason}`,
      ].join('\n');
    }

    const run = snapshot.runs.find((entry) => entry.runId === snapshot.selectedRunId) || snapshot.runs.at(-1) || null;
    const autoTelemetry = snapshot.autoInvocationTelemetry.latest;
    const workerOutputs = (run?.workerResults || [])
      .filter((worker) => worker.status === 'completed')
      .map((worker) => `- ${worker.roleId}: ${firstMeaningfulLine(worker.summary || worker.output)}`)
      .slice(0, 4);
    const output = run?.output || run?.summary || snapshot.timeline.at(-1)?.detail || 'Subagentes concluidos.';
    const lines = [
      'Acionei subagentes governados para essa tarefa.',
      `Roteamento: ${routeReason}`,
    ];
    if (autoTelemetry) {
      lines.push(
        `Decisao: ${autoTelemetry.selectedBy}; confianca ${autoTelemetry.confidence}; modo ${autoTelemetry.mode}.`,
        `Papeis: ${autoTelemetry.roles.map((role) => `${role.roleId} - ${role.whySelected}`).join('; ') || 'n/d'}.`,
      );
    }
    if (workerOutputs.length > 0) {
      lines.push('', 'Leitura dos subagentes:', ...workerOutputs);
    }
    lines.push('', 'Sintese:', output);
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
  ): ToolDefinition[] {
    const byName = new Map<string, ToolDefinition>();

    for (const tool of filteredTools || []) {
      byName.set(tool.name, tool);
    }

    for (const tool of allTools || []) {
      if (requiredToolNames.has(tool.name)) {
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
      toolExposureGatedByCognitiveFirewall: false,
      hintGroups: hintProfile?.groups || [],
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
      const message = error instanceof Error ? error.message : String(error);
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
      'Contexto recente da conversa para resolver referencias como "essa noticia", "a noticia citada", "isso" ou "mais detalhes":',
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
}

function firstMeaningfulLine(value: string, maxLength = 220): string {
  const line = String(value || '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)[0] || '';
  return line.length > maxLength ? `${line.slice(0, maxLength - 3)}...` : line;
}
