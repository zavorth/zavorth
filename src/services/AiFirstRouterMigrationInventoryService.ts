export type AiFirstRouterMigrationDecision =
  | 'promote-ai-first'
  | 'keep-policy-guardrail'
  | 'keep-tool-or-action'
  | 'keep-fallback'
  | 'compatibility-only'
  | 'needs-owner-decision';

export type AiFirstRouterInventoryEntry = {
  id: string;
  label: string;
  filePath: string;
  currentRole: string;
  currentDecisionStyle:
    | 'command-switch'
    | 'regex-heuristic'
    | 'llm-assisted'
    | 'policy-guardrail'
    | 'tool-action'
    | 'transport-router'
    | 'control-plane';
  migrationDecision: AiFirstRouterMigrationDecision;
  phaseTarget: 'checkpoint-1' | 'checkpoint-2' | 'checkpoint-3' | 'checkpoint-4' | 'checkpoint-5' | 'checkpoint-7' | 'keep';
  reason: string;
  aiFirstRole: string;
  evidence: string[];
};

export type AiFirstRouterMessagePathStep = {
  order: number;
  id: string;
  label: string;
  role: string;
};

export type AiFirstRouterMigrationInventorySnapshot = {
  generatedAt: string;
  source: 'AiFirstRouterMigrationInventoryService';
  summary: {
    totalEntries: number;
    promoteAiFirst: number;
    policyGuardrails: number;
    fallbacks: number;
    compatibilityOnly: number;
    toolOrAction: number;
    needsOwnerDecision: number;
  };
  entries: AiFirstRouterInventoryEntry[];
  currentDefaultMessagePath: AiFirstRouterMessagePathStep[];
  targetDefaultMessagePath: AiFirstRouterMessagePathStep[];
  gates: Array<{
    id: string;
    label: string;
    status: 'passed';
    detail: string;
  }>;
};

type AiFirstRouterMigrationInventoryRuntime = {
  now?: () => Date;
};

const INVENTORY_ENTRIES: AiFirstRouterInventoryEntry[] = [
  {
    id: 'telegram-command-parser',
    label: 'Telegram command parser',
    filePath: 'src/telegram/CommandParser.ts',
    currentRole: 'Transforma texto livre em /task e comandos com barra em command_type explicito.',
    currentDecisionStyle: 'command-switch',
    migrationDecision: 'compatibility-only',
    phaseTarget: 'checkpoint-7',
    reason: 'Comandos com barra continuam uteis como atalho, mas texto livre nao deve depender deles como cerebro principal.',
    aiFirstRole: 'Compatibilidade e entrada legada para usuarios que preferem comandos explicitos.',
    evidence: ['text.startsWith("/")', 'command_type="/task"', 'references_last_task por includes'],
  },
  {
    id: 'legacy-intent-router',
    label: 'Legacy intent router',
    filePath: 'src/orchestrator/IntentRouter.ts',
    currentRole: 'Mapeia ParsedCommand para intent/target/executor por switch e registry.',
    currentDecisionStyle: 'command-switch',
    migrationDecision: 'keep-fallback',
    phaseTarget: 'checkpoint-7',
    reason: 'Pode resolver comandos explicitos e rotas conhecidas quando o AI-first router falhar.',
    aiFirstRole: 'Fallback deterministico para comandos antigos e capacidades explicitamente declaradas.',
    evidence: ['switch(parsed.command_type)', 'findByCommand', 'matchImplicit'],
  },
  {
    id: 'capability-os-router',
    label: 'Capability OS router',
    filePath: 'src/orchestrator/IntentRouterV2.ts',
    currentRole: 'Encaminha texto para explainRoute do Capability OS.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'keep-fallback',
    phaseTarget: 'checkpoint-2',
    reason: 'Ja centraliza rotas por capacidade; deve virar comparador em shadow mode e fallback.',
    aiFirstRole: 'Explica rota legada em paralelo ao plano IA para medir divergencias.',
    evidence: ['capabilityOsService.explainRoute', 'sourceSurface="intent-router-v2"'],
  },
  {
    id: 'intent-classifier',
    label: 'Local intent classifier',
    filePath: 'src/cognitive-firewall/IntentClassifier.ts',
    currentRole: 'Classifica conversa, arquivo, execucao, configuracao, memoria, desktop e pesquisa por regex.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-2',
    reason: 'Nao deve ser o cerebro padrao; classificacao por palavra-chave perde linguagem natural real.',
    aiFirstRole: 'Hint barato, teste de regressao e fallback quando IA estiver indisponivel.',
    evidence: ['TRIVIAL_CHAT_PATTERNS', 'FILE_PATTERNS', 'EXECUTION_PATTERNS', 'CONFIG_PATTERNS'],
  },
  {
    id: 'natural-language-router',
    label: 'Natural language router',
    filePath: 'src/cognitive-firewall/NaturalLanguageRouter.ts',
    currentRole: 'Enriquece texto livre com categoria local e comando interno sugerido.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-5',
    reason: 'O nome e natural, mas a decisao ainda nasce do classifier local; deve chamar o planner IA-first.',
    aiFirstRole: 'Adaptador fino: recebe texto, chama AI-first planner e anexa hints legados como contexto.',
    evidence: ['CognitiveFirewall.evaluate', 'INTENT_TO_INTERNAL_COMMAND', 'TRIVIAL_CHAT_PATTERNS'],
  },
  {
    id: 'tool-gatekeeper',
    label: 'Tool gatekeeper',
    filePath: 'src/cognitive-firewall/ToolGatekeeper.ts',
    currentRole: 'Reduz ferramentas expostas ao LLM por categoria de intencao.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Nao deve escolher objetivo do usuario, mas e util como sugestao e limite de exposicao.',
    aiFirstRole: 'Policy/hint: valida o plano IA e reduz ferramentas sem virar autoridade semantica final.',
    evidence: ['DEFAULT_INTENT_TOOL_MAP', 'toolExposureGatedByCognitiveFirewall=false', 'isHardGate=false'],
  },
  {
    id: 'surface-operational-intent',
    label: 'Surface operational intent',
    filePath: 'src/services/SurfaceOperationalIntentService.ts',
    currentRole: 'Decide conversa vs operacao por sinais estruturais e classificador semantico opcional.',
    currentDecisionStyle: 'llm-assisted',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-2',
    reason: 'Ja tem uma porta semantica; deve virar o primeiro ponto de shadow mode antes do default.',
    aiFirstRole: 'Comparador e depois ponte oficial entre mensagem natural, plano IA e response decision.',
    evidence: ['classifyWithSemantic', 'LlmRuntimeService.chat', 'toResponseDecision'],
  },
  {
    id: 'universal-intent-service',
    label: 'Universal intent service',
    filePath: 'src/runtime/uni/UniversalIntentService.ts',
    currentRole: 'Combina safety, clarificacao, permissao, trust slider e narrativa.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Esta camada deve continuar deterministica: IA propoe, UniversalIntent decide se precisa perguntar, aprovar ou bloquear.',
    aiFirstRole: 'Policy owner para risco, permissao, abstracao do usuario e proxima acao segura.',
    evidence: ['IntentSafetyClassifier', 'ConversationalPermissionService', 'TrustSliderPolicyService'],
  },
  {
    id: 'intent-safety-classifier',
    label: 'Intent safety classifier',
    filePath: 'src/runtime/uni/IntentSafetyClassifier.ts',
    currentRole: 'Infere risco e efeito colateral por tools, sinais e regex.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Risco, destruicao, shell e side effect precisam de regras duras mesmo no mundo AI-first.',
    aiFirstRole: 'Validador deterministico do plano IA; nunca deve ser substituido por persuasao do modelo.',
    evidence: ['mutation', 'shell', 'externalSideEffect', 'destructive', 'operatorRequired'],
  },
  {
    id: 'universal-agent-request-heuristics',
    label: 'Universal agent request heuristics',
    filePath: 'src/runtime/agent/UniversalAgentRequestHeuristics.ts',
    currentRole: 'Infere ferramentas solicitadas por padroes de texto.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-2',
    reason: 'Ferramentas devem vir do plano IA validado, nao de palavras isoladas.',
    aiFirstRole: 'Sinal auxiliar e fallback para auditoria de divergencia.',
    evidence: ['inferUniversalAgentRequestedTools', 'addIfMatches', 'fallbackTool'],
  },
  {
    id: 'natural-capability-discovery',
    label: 'Natural capability discovery',
    filePath: 'src/runtime/agent/NaturalCapabilityDiscoveryService.ts',
    currentRole: 'Descobre capacidades e ferramentas por padroes de linguagem natural.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-2',
    reason: 'Deve virar catalogo consultado pela IA e nao roteador principal por regex.',
    aiFirstRole: 'Fornece catalogo, riscos e alternativas para o planner IA-first montar plano.',
    evidence: ['CATEGORY_PATTERNS', 'NaturalCapabilityDiscoveryRecommendation', 'toolHintProfile'],
  },
  {
    id: 'universal-preview-mode',
    label: 'Universal preview mode',
    filePath: 'src/runtime/agent/UniversalPreviewModeService.ts',
    currentRole: 'Transforma ferramentas expostas em plano preview-first sem executar.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Preview e receipt sao guardrails centrais para execucao governada.',
    aiFirstRole: 'Converte plano IA aprovado em preview humano antes de qualquer mutacao.',
    evidence: ['noExecutionPerformed=true', 'naturalLanguageDoesNotBypassPolicy=true', 'executorBlockedInPreviewMode'],
  },
  {
    id: 'agent-run-service',
    label: 'Agent run service',
    filePath: 'src/runtime/agent/AgentRunService.ts',
    currentRole: 'Compoe execução universal, approvals, preview, tools, LLM runtime e fallbacks.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'keep-tool-or-action',
    phaseTarget: 'checkpoint-4',
    reason: 'Deve executar planos aprovados, nao decidir sozinho o significado principal do pedido.',
    aiFirstRole: 'Executor governado para planos AI-first normalizados.',
    evidence: ['ToolExposurePolicy', 'UniversalPreviewModeService', 'AgentRunLlmRuntimeExecutor'],
  },
  {
    id: 'skill-router',
    label: 'Skill router',
    filePath: 'src/skills/SkillRouter.ts',
    currentRole: 'Seleciona skills por heuristicas fortes e LLM quando necessario.',
    currentDecisionStyle: 'llm-assisted',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-5',
    reason: 'Ja usa LLM, mas ainda permite heuristica forte vencer antes do modelo.',
    aiFirstRole: 'Skill selection vira subdecisao dentro do plano IA; heuristicas ficam fallback.',
    evidence: ['routeWithHeuristics', 'routeWithLlm', 'mergeSelections'],
  },
  {
    id: 'evidence-search-router',
    label: 'Evidence search router',
    filePath: 'src/agents/EvidenceSearchRouter.ts',
    currentRole: 'Decide quando buscar evidencias externas por dominio, atualidade e risco.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Regras de evidencia e dominios sensiveis devem continuar obrigatorias; IA pode propor busca adicional.',
    aiFirstRole: 'Policy de evidencia minima para perguntas atuais, high-stakes ou que exigem fonte.',
    evidence: ['isHighStakesDomain', 'currentMarker', 'explicitSearchIntent', 'buildContextGuidance'],
  },
  {
    id: 'natural-channel-setup-turn',
    label: 'Natural channel setup turn',
    filePath: 'src/services/NaturalChannelSetupTurnService.ts',
    currentRole: 'Extrai canal, modo, valores e acao de setup por regex e labels.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-5',
    reason: 'E exatamente o tipo de arvore que deve ser rebaixada: IA entende o pedido, esta classe aplica fallback/extracao segura.',
    aiFirstRole: 'Fallback de extracao e executor de setup recebido do plano IA validado.',
    evidence: ['CHANNEL_MODE_PATTERNS', 'extractEntries', 'wantsApply', 'wantsDoctor', 'wantsTest'],
  },
  {
    id: 'channel-setup-assistant',
    label: 'Channel setup assistant',
    filePath: 'src/services/ChannelSetupAssistantService.ts',
    currentRole: 'Monta estado de setup, aplica scaffold e roda doctor de canal.',
    currentDecisionStyle: 'tool-action',
    migrationDecision: 'keep-tool-or-action',
    phaseTarget: 'checkpoint-4',
    reason: 'E uma capacidade de execucao/estado, nao o cerebro semantico.',
    aiFirstRole: 'Ferramenta acionada pelo executor depois que o plano IA passou por policy.',
    evidence: ['buildSession', 'apply', 'runDoctor', 'resolveStatus'],
  },
  {
    id: 'natural-setup-control-plane',
    label: 'Natural setup control plane',
    filePath: 'src/services/ZavorthNaturalSetupControlPlaneService.ts',
    currentRole: 'Gera snapshot preview-first e mutation plan para setup natural.',
    currentDecisionStyle: 'control-plane',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Deve continuar garantindo preview-first, approval e redacao de secrets.',
    aiFirstRole: 'Control plane de validacao e recibos para configuracoes propostas pela IA.',
    evidence: ['previewOnly=true', 'approvalRequiredForMutation=true', 'rawIntentStored=false'],
  },
  {
    id: 'telegram-natural-capability-routing',
    label: 'Telegram natural capability routing',
    filePath: 'src/telegram/TelegramNaturalCapabilityRoutingService.ts',
    currentRole: 'Intercepta texto livre no Telegram e desvia para controllers por heuristica.',
    currentDecisionStyle: 'transport-router',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-5',
    reason: 'Superficies devem chamar o mesmo AI-first router padrao, nao ter cerebros locais diferentes.',
    aiFirstRole: 'Adaptador de transporte que envia texto para o router padrao e respeita decisoes de policy.',
    evidence: ['shouldHandleFreeForm', 'looksLikeAutomationIntent', 'NaturalLanguageRouter.route'],
  },
  {
    id: 'automation-intent-service',
    label: 'Automation intent service',
    filePath: 'src/services/ZavorthAutomationIntentService.ts',
    currentRole: 'Extrai agenda, entrega e prompt por regex simples.',
    currentDecisionStyle: 'regex-heuristic',
    migrationDecision: 'promote-ai-first',
    phaseTarget: 'checkpoint-5',
    reason: 'Automacoes em linguagem natural precisam de raciocinio de tempo e confirmacao; regex fica fallback.',
    aiFirstRole: 'Validador/fallback de schedule depois que o plano IA identificar a automacao.',
    evidence: ['extractSchedule', 'extractDelivery', 'cleanupPrompt'],
  },
  {
    id: 'shared-surface-agent-first',
    label: 'Shared surface agent-first free text',
    filePath: 'src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.ts',
    currentRole: 'Telegram free text goes to agent; slash and callback_data stay deterministic.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-7',
    reason: 'Free-text intent-regex packs removed; agent + slash/callback is the product path.',
    aiFirstRole: 'Gate free text to agent gateway; no phrase dictionary.',
    evidence: ['isSurfaceAgentFirstEnabled', 'shouldPassNaturalTextToAgent', 'preDispatchSharedSurfaceCommand'],
  },
  {
    id: 'provider-compatibility-classifier',
    label: 'Provider compatibility classifier',
    filePath: 'src/services/providers/catalog/ProviderCompatibilityClassifier.ts',
    currentRole: 'Classifica rotas de modelos e compatibilidade de adaptador por fatos/catalogo.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Compatibilidade de runtime e credencial deve continuar deterministica.',
    aiFirstRole: 'Valida se um plano IA de modelo/rota pode usar adaptador suportado.',
    evidence: ['FIRST_CLASS_PROVIDERS', 'isGateway', 'isLocal', 'isAnthropic', 'isOpenAiCompatible'],
  },
  {
    id: 'risk-classifier',
    label: 'Command risk classifier',
    filePath: 'src/orchestrator/RiskClassifier.ts',
    currentRole: 'Classifica risco de comandos e executores legados.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Bloqueio de termos destrutivos e aprovacao de risco continuam fora do poder da IA.',
    aiFirstRole: 'Guardrail legado para comandos com barra e rotas antigas.',
    evidence: ['DANGEROUS_TERMS', 'requires_approval', 'risk_level'],
  },
  {
    id: 'shell-safety-classifier',
    label: 'Shell safety classifier',
    filePath: 'src/services/ShellSafetyClassifier.ts',
    currentRole: 'Classifica comandos shell por padroes perigosos, cwd e approval.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Shell deve continuar governado por regras duras antes de qualquer execucao.',
    aiFirstRole: 'Validador obrigatorio para qualquer plano IA que solicite terminal.',
    evidence: ['DANGEROUS_PATTERNS', 'ATTENTION_PATTERNS', 'cwdAllowed', 'approvalRequired'],
  },
  {
    id: 'tool-exposure-policy',
    label: 'Tool exposure policy',
    filePath: 'src/runtime/agent/ToolExposurePolicy.ts',
    currentRole: 'Classifica ferramentas por risco, approvals e bloqueios.',
    currentDecisionStyle: 'policy-guardrail',
    migrationDecision: 'keep-policy-guardrail',
    phaseTarget: 'checkpoint-3',
    reason: 'Ferramentas expostas devem ser filtradas por policy, nao pela vontade do modelo.',
    aiFirstRole: 'Contrato central entre plano IA e executor de tools.',
    evidence: ['DEFAULT_SAFE_TOOLS', 'DEFAULT_DANGER_TOOLS', 'requiresApproval', 'blockedTools'],
  },
  {
    id: 'fallback-router',
    label: 'Planner fallback router',
    filePath: 'src/agents/FallbackRouter.ts',
    currentRole: 'Tenta gerar plano com redundancia e retry.',
    currentDecisionStyle: 'tool-action',
    migrationDecision: 'keep-fallback',
    phaseTarget: 'checkpoint-4',
    reason: 'Retry e fallback de planner continuam uteis quando runtime IA falha.',
    aiFirstRole: 'Fallback operacional para falha transitoria do planner padrao.',
    evidence: ['planWithRedundancy', 'retries=2', 'fallback_used=true'],
  },
];

const CURRENT_DEFAULT_MESSAGE_PATH: AiFirstRouterMessagePathStep[] = [
  { order: 1, id: 'surface-input', label: 'Mensagem entra por uma superficie', role: 'Web, CLI, Telegram ou outro adaptador recebe texto.' },
  { order: 2, id: 'surface-router', label: 'Roteador da superficie interpreta sinais', role: 'Cada surface pode ter parse local, command parser ou heuristicas proprias.' },
  { order: 3, id: 'intent-hints', label: 'Heuristicas inferem categoria/tools', role: 'Classifiers e regex geram hints de intencao e ferramentas.' },
  { order: 4, id: 'control-plane', label: 'Control plane decide path', role: 'Response decision, capability OS ou command routing escolhem caminho.' },
  { order: 5, id: 'policy', label: 'Policy aplica gates', role: 'Risco, approval, sandbox e tool exposure reduzem impacto.' },
  { order: 6, id: 'executor', label: 'Executor roda ou responde', role: 'AgentRunService, controllers ou tools executam o caminho escolhido.' },
];

const TARGET_DEFAULT_MESSAGE_PATH: AiFirstRouterMessagePathStep[] = [
  { order: 1, id: 'surface-input', label: 'Mensagem entra por qualquer superficie', role: 'Texto livre e comandos explicitos chegam no mesmo envelope.' },
  { order: 2, id: 'ai-first-plan', label: 'AI-first router entende e planeja', role: 'IA interpreta objetivo, nivel da pessoa, informacoes faltantes, plano e riscos.' },
  { order: 3, id: 'normalization', label: 'Contrato normaliza o plano', role: 'Plano vira schema estavel: objetivo, acoes propostas, tools, riscos e perguntas.' },
  { order: 4, id: 'policy', label: 'Policy valida o plano', role: 'Regras duras aprovam, pedem clarificacao, exigem approval ou bloqueiam.' },
  { order: 5, id: 'executor', label: 'Executor governado atua', role: 'Apenas ferramentas aprovadas executam em sandbox/cwd/secret policy corretos.' },
  { order: 6, id: 'receipt', label: 'Resposta e receipt', role: 'Usuario recebe linguagem natural; auditoria recebe artifact/receipt sem secrets.' },
];

export class AiFirstRouterMigrationInventoryService {
  private readonly now: () => Date;

  constructor(runtime: AiFirstRouterMigrationInventoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): AiFirstRouterMigrationInventorySnapshot {
    const entries = INVENTORY_ENTRIES.map((entry) => ({
      ...entry,
      evidence: [...entry.evidence],
    }));
    const summary = {
      totalEntries: entries.length,
      promoteAiFirst: this.count(entries, 'promote-ai-first'),
      policyGuardrails: this.count(entries, 'keep-policy-guardrail'),
      fallbacks: this.count(entries, 'keep-fallback'),
      compatibilityOnly: this.count(entries, 'compatibility-only'),
      toolOrAction: this.count(entries, 'keep-tool-or-action'),
      needsOwnerDecision: this.count(entries, 'needs-owner-decision'),
    };

    return {
      generatedAt: this.now().toISOString(),
      source: 'AiFirstRouterMigrationInventoryService',
      summary,
      entries,
      currentDefaultMessagePath: CURRENT_DEFAULT_MESSAGE_PATH.map((step) => ({ ...step })),
      targetDefaultMessagePath: TARGET_DEFAULT_MESSAGE_PATH.map((step) => ({ ...step })),
      gates: [
        {
          id: 'checkpoint-0-no-runtime-change',
          label: 'Sem mudanca runtime',
          status: 'passed',
          detail: 'Security contract so inventaria e classifica; nenhuma rota existente foi alterada.',
        },
        {
          id: 'checkpoint-0-policy-preserved',
          label: 'Policy preservada',
          status: 'passed',
          detail: 'Risco, shell, tool exposure, preview e approvals permanecem como guardrails deterministas.',
        },
        {
          id: 'checkpoint-0-ai-first-candidates',
          label: 'Candidatos AI-first identificados',
          status: 'passed',
          detail: `${summary.promoteAiFirst} superficies ou roteadores devem deixar de ser cerebro baseado em regex/comando.`,
        },
      ],
    };
  }

  public renderMarkdown(snapshot = this.buildSnapshot()): string {
    const lines = [
      '# Zavorth AI-First Router - Security contract Inventory',
      '',
      `Gerado em: ${snapshot.generatedAt}`,
      '',
      '## Resumo',
      '',
      `- Total inventariado: ${snapshot.summary.totalEntries}`,
      `- Promover para AI-first: ${snapshot.summary.promoteAiFirst}`,
      `- Manter como policy/guardrail: ${snapshot.summary.policyGuardrails}`,
      `- Manter como fallback: ${snapshot.summary.fallbacks}`,
      `- Manter como ferramenta/acao: ${snapshot.summary.toolOrAction}`,
      `- Compatibilidade apenas: ${snapshot.summary.compatibilityOnly}`,
      `- Precisa decisao do dono: ${snapshot.summary.needsOwnerDecision}`,
      '',
      '## Caminho Atual',
      '',
      ...snapshot.currentDefaultMessagePath.map((step) => `${step.order}. ${step.label}: ${step.role}`),
      '',
      '## Caminho Alvo',
      '',
      ...snapshot.targetDefaultMessagePath.map((step) => `${step.order}. ${step.label}: ${step.role}`),
      '',
      '## Inventario',
      '',
      ...snapshot.entries.map((entry) => [
        `### ${entry.label}`,
        `- Arquivo: ${entry.filePath}`,
        `- Papel atual: ${entry.currentRole}`,
        `- Estilo atual: ${entry.currentDecisionStyle}`,
        `- Decisao: ${entry.migrationDecision}`,
        `- Etapa alvo: ${entry.phaseTarget}`,
        `- Papel AI-first: ${entry.aiFirstRole}`,
        `- Motivo: ${entry.reason}`,
        `- Evidencia: ${entry.evidence.join('; ')}`,
        '',
      ].join('\n')),
      '## Gates',
      '',
      ...snapshot.gates.map((gate) => `- ${gate.label}: ${gate.status} - ${gate.detail}`),
      '',
      '## Proxima Etapa Recomendada',
      '',
      'Intent model: criar o contrato do plano IA, sem executar nada ainda.',
    ];

    return lines.join('\n');
  }

  private count(entries: AiFirstRouterInventoryEntry[], decision: AiFirstRouterMigrationDecision): number {
    return entries.filter((entry) => entry.migrationDecision === decision).length;
  }
}
