import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION = '2026-05-03.track-42' as const;

export type AskBeforeAssumptionPolicyStatus = 'clear' | 'needs-question' | 'blocked';

export type AskBeforeAssumptionCategory =
  | 'missing-scope'
  | 'missing-target'
  | 'missing-permission'
  | 'missing-data'
  | 'risky-tool'
  | 'channel-handoff'
  | 'provider-route'
  | 'memory-write'
  | 'selfmod'
  | 'workspace-mutation';

export type AskBeforeAssumption = {
  id: string;
  category: AskBeforeAssumptionCategory;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'danger';
  confidence: number;
  missingInput: string[];
  inferredFrom: string[];
  affectedActions: string[];
  requiresAnswer: boolean;
  questionId: string;
};

export type AskBeforeAssumptionQuestion = {
  id: string;
  priority: 'low' | 'medium' | 'high';
  question: string;
  reason: string;
  options: string[];
  blocksMutation: boolean;
  defaultAction: 'ask' | 'preview' | 'skip';
};

export type AskBeforeAssumptionReceipt = {
  id: string;
  kind:
    | 'universal-preview'
    | 'capability-negotiation'
    | 'tool-exposure'
    | 'safety-narrative'
    | 'risk-audit'
    | 'cross-channel-continuity'
    | 'agent-team-compiler'
    | 'personal-ops-autopilot'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-answer' | 'missing';
};

export type AskBeforeAssumptionPolicySnapshot = {
  contractVersion: typeof ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION;
  source: 'AskBeforeAssumptionPolicyService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: AskBeforeAssumptionPolicyStatus;
  summary: {
    assumptionCount: number;
    questionCount: number;
    blockerCount: number;
    mutableActionBlockedCount: number;
    highestSeverity: 'info' | 'warning' | 'danger';
    previewLinked: boolean;
    capabilityNegotiationLinked: boolean;
    safetyNarrativeLinked: boolean;
  };
  assumptions: AskBeforeAssumption[];
  questions: AskBeforeAssumptionQuestion[];
  receipts: AskBeforeAssumptionReceipt[];
  policy: {
    noAssumptionActedOn: true;
    noMutationExecuted: true;
    asksBeforeMutation: true;
    previewBeforeRiskyAction: true;
    approvalStillRequired: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    askHint: string;
    previewHint: string;
  };
  nextSafeAction: string;
};

export type AskBeforeAssumptionPolicyInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

type AssumptionSeed = Omit<AskBeforeAssumption, 'id' | 'questionId'> & {
  question: Omit<AskBeforeAssumptionQuestion, 'id'>;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'assumption'): string {
  return (
    normalizeText(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as LooseRecord) : null;
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const record = recordOrNull(entry);
        return record ? [record] : [];
      })
    : [];
}

function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function redactText(value: unknown, fallback = '', maxLength = 260): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function severityRank(severity: AskBeforeAssumption['severity']): number {
  if (severity === 'danger') {
    return 3;
  }
  if (severity === 'warning') {
    return 2;
  }
  return 1;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(2));
}

export class AskBeforeAssumptionPolicyService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: AskBeforeAssumptionPolicyInput): AskBeforeAssumptionPolicySnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const seeds = this.buildSeeds(run)
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
      .slice(0, 12);
    const assumptions = seeds.map((seed, index) => this.toAssumption(run, seed, index));
    const questions = assumptions.map((assumption, index) => this.toQuestion(seeds[index], assumption));
    const status = this.resolveStatus(assumptions);
    const receipts = this.buildReceipts(run, assumptions);
    const highestSeverity = assumptions[0]?.severity || 'info';

    return {
      contractVersion: ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION,
      source: 'AskBeforeAssumptionPolicyService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        assumptionCount: assumptions.length,
        questionCount: questions.length,
        blockerCount: assumptions.filter((assumption) => assumption.severity === 'danger').length,
        mutableActionBlockedCount: assumptions.filter(
          (assumption) => assumption.affectedActions.length > 0 && assumption.requiresAnswer,
        ).length,
        highestSeverity,
        previewLinked: Boolean(recordOrNull(run.metadata.universalPreviewMode)),
        capabilityNegotiationLinked: Boolean(recordOrNull(run.metadata.capabilityNegotiation)),
        safetyNarrativeLinked: Boolean(recordOrNull(run.metadata.safetyNarrative)),
      },
      assumptions,
      questions,
      receipts,
      policy: {
        noAssumptionActedOn: true,
        noMutationExecuted: true,
        asksBeforeMutation: true,
        previewBeforeRiskyAction: true,
        approvalStillRequired: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth assumptions "${redactText(run.input, 'pedido', 80)}"`,
        zavorthControlPath: '/zavorthControl?sector=config',
        askHint: 'Pergunte antes de assumir alvo, escopo, permissao ou canal.',
        previewHint: 'Use preview quando a resposta puder gerar mutacao ou handoff.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, questions),
    };
  }

  private buildSeeds(run: UniversalAgentRun): AssumptionSeed[] {
    const explicit = this.explicitAssumptions(run);
    return this.dedupeSeeds([
      ...explicit,
      ...this.vagueTargetAssumptions(run),
      ...this.mutableToolAssumptions(run),
      ...this.previewAssumptions(run),
      ...this.capabilityAssumptions(run),
      ...this.crossChannelAssumptions(run),
      ...this.agentTeamAssumptions(run),
      ...this.providerAssumptions(run),
      ...this.memoryAssumptions(run),
    ]);
  }

  private explicitAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const raw = recordOrNull(run.metadata.askBeforeAssumptionPolicy);
    return listRecords(raw?.assumptions).map((entry) =>
      this.seed({
        category: this.normalizeCategory(entry.category),
        title: normalizeText(entry.title, 'Assuncao declarada'),
        detail: redactText(entry.detail ?? entry.reason, 'Metadata declarou uma lacuna a confirmar.'),
        severity: this.normalizeSeverity(entry.severity),
        confidence: Number(entry.confidence) || 0.8,
        missingInput: listStrings(entry.missingInput),
        inferredFrom: ['metadata.askBeforeAssumptionPolicy'],
        affectedActions: listStrings(entry.affectedActions),
        requiresAnswer: entry.requiresAnswer !== false,
        question: {
          priority: this.normalizePriority(entry.priority),
          question: normalizeText(entry.question, 'Pode confirmar esta escolha antes de continuar?'),
          reason: redactText(entry.reason ?? entry.detail, 'Confirmacao declarada por metadata.'),
          options: listStrings(entry.options),
          blocksMutation: entry.blocksMutation !== false,
          defaultAction: 'ask',
        },
      }),
    );
  }

  private vagueTargetAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const text = normalizeSearchText(run.input);
    const vague = /\b(isso|isto|aquilo|essa|esse|aquela|aquele|do jeito certo|melhore|arrume|corrija|ajuste)\b/.test(
      text,
    );
    const mutating = /\b(apague|delete|deleta|remova|publique|envie|deploy|commit|grave|escreva|altere|mude)\b/.test(
      text,
    );
    if (!vague && !mutating) {
      return [];
    }
    return [
      this.seed({
        category: mutating ? 'missing-target' : 'missing-scope',
        title: mutating ? 'Alvo de mutacao nao confirmado' : 'Escopo ambiguo',
        detail: mutating
          ? 'O pedido sugere acao mutavel, mas o alvo/criterio exato nao esta totalmente confirmado.'
          : 'O pedido contem referencia vaga; responder sem perguntar pode assumir escopo indevido.',
        severity: mutating ? 'danger' : 'warning',
        confidence: mutating ? 0.9 : 0.72,
        missingInput: mutating ? ['alvo exato', 'criterio de sucesso', 'permissao'] : ['escopo desejado'],
        inferredFrom: ['run.input'],
        affectedActions: mutating ? ['workspace mutation', 'external publish'] : [],
        requiresAnswer: true,
        question: {
          priority: mutating ? 'high' : 'medium',
          question: mutating
            ? 'Qual alvo exato posso alterar e qual resultado voce espera?'
            : 'Qual escopo voce quer que eu considere antes de seguir?',
          reason: 'Evitar assumir alvo ou criterio a partir de texto ambiguo.',
          options: mutating
            ? ['explicar primeiro', 'preparar preview', 'aguardar alvo']
            : ['perguntar', 'seguir leitura', 'resumir opcoes'],
          blocksMutation: mutating,
          defaultAction: mutating ? 'ask' : 'preview',
        },
      }),
    ];
  }

  private mutableToolAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const riskyTools = (run.toolExposure.tools || [])
      .filter((tool) => tool.requiresApproval || tool.risk === 'danger' || tool.risk === 'attention')
      .slice(0, 8);
    if (riskyTools.length === 0) {
      return [];
    }
    return [
      this.seed({
        category: 'risky-tool',
        title: 'Ferramentas de risco exigem confirmacao',
        detail: `${riskyTools.length} ferramenta(s) pedem approval ou risco elevado.`,
        severity: riskyTools.some((tool) => tool.risk === 'danger') ? 'danger' : 'warning',
        confidence: 0.93,
        missingInput: ['approval explicito', 'escopo da ferramenta'],
        inferredFrom: riskyTools.map((tool) => `tool:${tool.id}`),
        affectedActions: riskyTools.map((tool) => tool.id),
        requiresAnswer: true,
        question: {
          priority: riskyTools.some((tool) => tool.risk === 'danger') ? 'high' : 'medium',
          question: 'Voce aprova esse escopo de ferramenta antes de executar algo mutavel?',
          reason: 'Ferramentas de risco nao podem ser acionadas por suposicao.',
          options: ['aprovar escopo', 'pedir preview', 'bloquear'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private previewAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const preview = recordOrNull(run.metadata.universalPreviewMode);
    const risk = recordOrNull(preview?.risk);
    if (!preview || risk?.previewRequired !== true) {
      return [];
    }
    return [
      this.seed({
        category: 'missing-permission',
        title: 'Preview requerido antes de continuar',
        detail: 'Universal Preview Mode marcou que o plano precisa de preview antes da acao real.',
        severity: risk.requiresApproval === true ? 'danger' : 'warning',
        confidence: 0.95,
        missingInput: ['confirmacao do preview'],
        inferredFrom: ['universalPreviewMode.risk'],
        affectedActions: listStrings(risk.previewRequiredToolIds),
        requiresAnswer: true,
        question: {
          priority: risk.requiresApproval === true ? 'high' : 'medium',
          question: 'Quer que eu mostre o preview antes de qualquer execucao real?',
          reason: 'A policy de preview deve vencer qualquer inferencia de linguagem natural.',
          options: ['mostrar preview', 'ajustar escopo', 'cancelar'],
          blocksMutation: true,
          defaultAction: 'preview',
        },
      }),
    ];
  }

  private capabilityAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const negotiation = recordOrNull(run.metadata.capabilityNegotiation);
    if (!negotiation || normalizeText(negotiation.status) !== 'waiting-approval') {
      return [];
    }
    return [
      this.seed({
        category: 'missing-permission',
        title: 'Capability aguardando permissao',
        detail: 'Capability Negotiation indica que ainda existe escopo a aprovar.',
        severity: 'warning',
        confidence: 0.9,
        missingInput: ['capability aprovada', 'limites de escopo'],
        inferredFrom: ['capabilityNegotiation.status'],
        affectedActions: ['capability execution'],
        requiresAnswer: true,
        question: {
          priority: 'medium',
          question: 'Qual capability e escopo voce aprova para este pedido?',
          reason: 'A execucao nao deve assumir permissoes alem do negociado.',
          options: ['aprovar minimo', 'pedir preview', 'bloquear'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private crossChannelAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const continuity = recordOrNull(run.metadata.crossChannelContinuity);
    if (!continuity || normalizeText(continuity.status) !== 'handoff-ready') {
      return [];
    }
    return [
      this.seed({
        category: 'channel-handoff',
        title: 'Handoff de canal precisa confirmacao',
        detail: 'Cross-Channel Continuity preparou handoff, mas nenhuma mensagem deve ser enviada sem approval.',
        severity: 'warning',
        confidence: 0.92,
        missingInput: ['canal destino', 'approval do handoff'],
        inferredFrom: ['crossChannelContinuity.status'],
        affectedActions: ['cross-channel notification'],
        requiresAnswer: true,
        question: {
          priority: 'medium',
          question: 'Para qual canal devo preparar o handoff e voce aprova o envio?',
          reason: 'Mudanca de canal nao deve acontecer por suposicao.',
          options: ['manter canal atual', 'preparar preview', 'aprovar handoff'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private agentTeamAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const team = recordOrNull(run.metadata.agentTeamCompiler);
    if (!team || normalizeText(team.status) !== 'waiting-approval') {
      return [];
    }
    return [
      this.seed({
        category: 'missing-permission',
        title: 'Equipe de agentes aguardando approval',
        detail: 'Agent Team Compiler compilou roles, mas launch de subagentes precisa confirmacao.',
        severity: 'warning',
        confidence: 0.9,
        missingInput: ['approval de roles', 'budget de subagentes'],
        inferredFrom: ['agentTeamCompiler.status'],
        affectedActions: ['subagent launch'],
        requiresAnswer: true,
        question: {
          priority: 'medium',
          question: 'Do you approve the roles and budget before launching subagents?',
          reason: 'Subagentes nao devem ser abertos por inferencia.',
          options: ['revisar roles', 'aprovar minimo', 'cancelar'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private providerAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const arena = recordOrNull(run.metadata.providerArena);
    const summary = recordOrNull(arena?.summary);
    if (!summary || summary.fallbackUsed !== true) {
      return [];
    }
    return [
      this.seed({
        category: 'provider-route',
        title: 'Fallback de provider precisa visibilidade',
        detail:
          'Provider Arena detectou fallback; nao assumir que o usuario aceita custo/latencia/rota sem explicitar.',
        severity: 'info',
        confidence: 0.82,
        missingInput: ['preferencia de provider/modelo'],
        inferredFrom: ['providerArena.summary.fallbackUsed'],
        affectedActions: ['model route'],
        requiresAnswer: false,
        question: {
          priority: 'low',
          question: 'Quer manter o provider/modelo recomendado ou escolher outro?',
          reason: 'Fallback deve ficar visivel antes de decisoes caras ou repetidas.',
          options: ['manter recomendado', 'comparar arena', 'escolher outro'],
          blocksMutation: false,
          defaultAction: 'preview',
        },
      }),
    ];
  }

  private memoryAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const artifactMemory = recordOrNull(run.metadata.artifactMemory);
    const summary = recordOrNull(artifactMemory?.summary);
    const memoryWithReceipts = recordOrNull(run.metadata.memoryWithReceipts);
    const memoryWriteLikely = /memorize|lembre|salve na memoria|grave na memoria/i.test(run.input);
    if (!memoryWriteLikely && Number(summary?.reusableCount || 0) <= 0 && !memoryWithReceipts) {
      return [];
    }
    return [
      this.seed({
        category: 'memory-write',
        title: 'Memoria requer origem e consentimento',
        detail: 'Promover informacao para memoria deve citar origem e depender de acao explicita.',
        severity: memoryWriteLikely ? 'warning' : 'info',
        confidence: memoryWriteLikely ? 0.85 : 0.68,
        missingInput: ['o que lembrar', 'origem/receipt', 'escopo de memoria'],
        inferredFrom: ['artifactMemory', 'memoryWithReceipts', 'run.input'],
        affectedActions: ['memory write'],
        requiresAnswer: memoryWriteLikely,
        question: {
          priority: memoryWriteLikely ? 'medium' : 'low',
          question: 'O que exatamente devo lembrar e qual receipt devo citar?',
          reason: 'Memoria sem origem vira suposicao persistente.',
          options: ['citar artifact', 'salvar procedural', 'nao salvar'],
          blocksMutation: memoryWriteLikely,
          defaultAction: memoryWriteLikely ? 'ask' : 'preview',
        },
      }),
    ];
  }

  private seed(seed: AssumptionSeed): AssumptionSeed {
    return {
      ...seed,
      detail: redactText(seed.detail),
      confidence: clampConfidence(seed.confidence),
      missingInput: Array.from(new Set(seed.missingInput.filter(Boolean))),
      inferredFrom: Array.from(new Set(seed.inferredFrom.filter(Boolean))),
      affectedActions: Array.from(new Set(seed.affectedActions.filter(Boolean))),
      question: {
        ...seed.question,
        reason: redactText(seed.question.reason),
        options: Array.from(new Set(seed.question.options.filter(Boolean))).slice(0, 5),
      },
    };
  }

  private toAssumption(run: UniversalAgentRun, seed: AssumptionSeed, index: number): AskBeforeAssumption {
    const id = `ask-assumption:${run.id}:${normalizeKey(seed.category)}:${index + 1}`;
    return {
      id,
      category: seed.category,
      title: seed.title,
      detail: seed.detail,
      severity: seed.severity,
      confidence: seed.confidence,
      missingInput: [...seed.missingInput],
      inferredFrom: [...seed.inferredFrom],
      affectedActions: [...seed.affectedActions],
      requiresAnswer: seed.requiresAnswer,
      questionId: `${id}:question`,
    };
  }

  private toQuestion(seed: AssumptionSeed | undefined, assumption: AskBeforeAssumption): AskBeforeAssumptionQuestion {
    return {
      id: assumption.questionId,
      priority: seed?.question.priority || (assumption.severity === 'danger' ? 'high' : 'medium'),
      question: seed?.question.question || 'Pode confirmar antes de seguir?',
      reason: seed?.question.reason || assumption.detail,
      options: seed?.question.options.length ? seed.question.options : ['perguntar', 'preview', 'cancelar'],
      blocksMutation: seed?.question.blocksMutation ?? assumption.requiresAnswer,
      defaultAction: seed?.question.defaultAction || 'ask',
    };
  }

  private buildReceipts(run: UniversalAgentRun, assumptions: AskBeforeAssumption[]): AskBeforeAssumptionReceipt[] {
    return [
      {
        id: `ask-policy-receipt:${run.id}:preview`,
        kind: 'universal-preview',
        source: 'UniversalPreviewModeService',
        detail: recordOrNull(run.metadata.universalPreviewMode)
          ? 'Universal Preview Mode disponivel para perguntas com risco.'
          : 'Universal Preview Mode ausente neste snapshot.',
        status: recordOrNull(run.metadata.universalPreviewMode) ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:capability`,
        kind: 'capability-negotiation',
        source: 'CapabilityNegotiationService',
        detail: recordOrNull(run.metadata.capabilityNegotiation)
          ? 'Capability Negotiation disponivel para escopo/permissao.'
          : 'Capability Negotiation ausente ou nao necessario.',
        status: recordOrNull(run.metadata.capabilityNegotiation) ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:tool-exposure`,
        kind: 'tool-exposure',
        source: 'ToolExposurePolicy',
        detail: `${run.toolExposure.tools.length} tool(s) observadas no perfil de exposicao.`,
        status: run.toolExposure.tools.length > 0 ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:safety`,
        kind: 'safety-narrative',
        source: 'SafetyNarrativeService',
        detail: recordOrNull(run.metadata.safetyNarrative)
          ? 'Safety Narrative disponivel para explicar bloqueios.'
          : 'Safety Narrative ainda nao anexada.',
        status: recordOrNull(run.metadata.safetyNarrative) ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:questions`,
        kind: 'policy',
        source: 'AskBeforeAssumptionPolicyService',
        detail: `${assumptions.length} pergunta(s)/assuncao(oes) preparadas sem executar acao.`,
        status: assumptions.length > 0 ? 'needs-answer' : 'ready',
      },
      {
        id: `ask-policy-receipt:${run.id}:surface`,
        kind: 'surface',
        source: 'CLI/ZavorthControl',
        detail: 'Perguntas expostas por CLI read-only e ZavorthControl.',
        status: 'ready',
      },
    ];
  }

  private dedupeSeeds(seeds: AssumptionSeed[]): AssumptionSeed[] {
    const seen = new Set<string>();
    return seeds.filter((seed) => {
      const key = `${seed.category}:${seed.title}:${seed.detail}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private resolveStatus(assumptions: AskBeforeAssumption[]): AskBeforeAssumptionPolicyStatus {
    if (assumptions.some((assumption) => assumption.severity === 'danger' && assumption.requiresAnswer)) {
      return 'blocked';
    }
    if (assumptions.some((assumption) => assumption.requiresAnswer)) {
      return 'needs-question';
    }
    return 'clear';
  }

  private resolveNextSafeAction(
    status: AskBeforeAssumptionPolicyStatus,
    questions: AskBeforeAssumptionQuestion[],
  ): string {
    if (status === 'blocked') {
      return 'Perguntar antes de qualquer mutacao, handoff, provider switch ou launch.';
    }
    if (status === 'needs-question') {
      return questions[0]?.question || 'Fazer pergunta de clarificacao antes de seguir.';
    }
    return 'Sem pergunta obrigatoria; seguir respeitando preview, approval e tool policy.';
  }

  private normalizeCategory(value: unknown): AskBeforeAssumptionCategory {
    const raw = normalizeText(value).toLowerCase();
    if (
      raw === 'missing-scope' ||
      raw === 'missing-target' ||
      raw === 'missing-permission' ||
      raw === 'missing-data' ||
      raw === 'risky-tool' ||
      raw === 'channel-handoff' ||
      raw === 'provider-route' ||
      raw === 'memory-write' ||
      raw === 'selfmod' ||
      raw === 'workspace-mutation'
    ) {
      return raw;
    }
    return 'missing-scope';
  }

  private normalizeSeverity(value: unknown): AskBeforeAssumption['severity'] {
    const raw = normalizeText(value).toLowerCase();
    if (raw === 'danger' || raw === 'warning' || raw === 'info') {
      return raw;
    }
    return 'warning';
  }

  private normalizePriority(value: unknown): AskBeforeAssumptionQuestion['priority'] {
    const raw = normalizeText(value).toLowerCase();
    if (raw === 'high' || raw === 'medium' || raw === 'low') {
      return raw;
    }
    return 'medium';
  }
}
