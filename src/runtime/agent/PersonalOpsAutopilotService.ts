import { queryUniversalAgentRuns } from './RunObservatory.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION = '2026-05-03.personal-ops' as const;

export type PersonalOpsAutopilotStatus = 'idle' | 'suggesting' | 'waiting-approval' | 'blocked';

export type PersonalOpsAutopilotCategory =
  | 'provider'
  | 'budget'
  | 'memory'
  | 'artifact-memory'
  | 'capability'
  | 'skill'
  | 'watch-mode'
  | 'node-mesh'
  | 'channel'
  | 'safety'
  | 'runtime'
  | 'automation';

export type PersonalOpsAutopilotSuggestion = {
  id: string;
  category: PersonalOpsAutopilotCategory;
  title: string;
  cause: string;
  impact: string;
  nextStep: string;
  severity: 'info' | 'warning' | 'danger';
  confidence: number;
  requiresApproval: boolean;
  previewAvailable: boolean;
  mutableAction: boolean;
  evidence: Array<{
    source: string;
    ref: string | null;
    detail: string;
    receiptId?: string;
  }>;
  relatedArtifactIds: string[];
  relatedToolIds: string[];
  actions: {
    previewCommand: string;
    approvalCommand: string;
    runCommand: string;
    dismissCommand: string;
  };
};

export type PersonalOpsAutopilotReceipt = {
  id: string;
  kind:
    | 'run-observatory'
    | 'natural-capability-discovery'
    | 'budget'
    | 'provider-arena'
    | 'artifact-memory'
    | 'skill-quarantine'
    | 'approval'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-review' | 'missing';
};

export type PersonalOpsAutopilotSnapshot = {
  contractVersion: typeof PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION;
  source: 'PersonalOpsAutopilotService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: PersonalOpsAutopilotStatus;
  summary: {
    suggestionCount: number;
    attentionCount: number;
    approvalRequiredCount: number;
    previewAvailableCount: number;
    mutableActionCount: number;
    providerIssueCount: number;
    budgetIssueCount: number;
    artifactOpportunityCount: number;
    naturalIntentObserved: boolean;
    runObservatoryLinked: boolean;
  };
  suggestions: PersonalOpsAutopilotSuggestion[];
  receipts: PersonalOpsAutopilotReceipt[];
  policy: {
    noMutableActionExecuted: true;
    noAutorepairStarted: true;
    approvalsRequiredForMutation: true;
    previewBeforeAutorepair: true;
    naturalLanguageDoesNotBypassPolicy: true;
    usesReceiptsForSuggestions: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    previewHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type PersonalOpsAutopilotInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'ops'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
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

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactText(value: unknown, fallback = '', maxLength = 260): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function severityRank(severity: PersonalOpsAutopilotSuggestion['severity']): number {
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

export class PersonalOpsAutopilotService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: PersonalOpsAutopilotInput): PersonalOpsAutopilotSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const observatory = queryUniversalAgentRuns({
      runs: [run],
      query: {
        runId: run.id,
        limit: 1,
      },
      generatedAt,
    });
    const suggestions = this.buildSuggestions(run, observatory.receipts.length > 0)
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
      .slice(0, 12);
    const status = this.resolveStatus(run, suggestions);
    const receipts = this.buildReceipts(run, suggestions, observatory.receipts.length);

    return {
      contractVersion: PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION,
      source: 'PersonalOpsAutopilotService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        suggestionCount: suggestions.length,
        attentionCount: suggestions.filter((suggestion) => suggestion.severity !== 'info').length,
        approvalRequiredCount: suggestions.filter((suggestion) => suggestion.requiresApproval).length,
        previewAvailableCount: suggestions.filter((suggestion) => suggestion.previewAvailable).length,
        mutableActionCount: suggestions.filter((suggestion) => suggestion.mutableAction).length,
        providerIssueCount: suggestions.filter((suggestion) => suggestion.category === 'provider').length,
        budgetIssueCount: suggestions.filter((suggestion) => suggestion.category === 'budget').length,
        artifactOpportunityCount: suggestions.filter((suggestion) => suggestion.category === 'artifact-memory').length,
        naturalIntentObserved: Boolean(recordOrNull(run.metadata.naturalCapabilityDiscovery)),
        runObservatoryLinked: observatory.receipts.length > 0,
      },
      suggestions,
      receipts,
      policy: {
        noMutableActionExecuted: true,
        noAutorepairStarted: true,
        approvalsRequiredForMutation: true,
        previewBeforeAutorepair: true,
        naturalLanguageDoesNotBypassPolicy: true,
        usesReceiptsForSuggestions: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth personal-ops run ${run.id} --json`,
        zavorthControlPath: '/zavorthControl?sector=overview',
        previewHint: 'Use preview antes de qualquer autorepair, reconnect, provider switch ou channel repair.',
        approvalHint: 'Acoes mutaveis exigem approval explicito do operador.',
      },
      nextSafeAction: this.nextSafeAction(status, suggestions),
    };
  }

  private buildSuggestions(run: UniversalAgentRun, runObservatoryLinked: boolean): PersonalOpsAutopilotSuggestion[] {
    return [
      ...this.providerSuggestions(run),
      ...this.budgetSuggestions(run),
      ...this.artifactMemorySuggestions(run),
      ...this.capabilitySuggestions(run),
      ...this.skillSuggestions(run),
      ...this.safetySuggestions(run),
      ...this.approvalSuggestions(run),
      ...this.runtimeSuggestions(run, runObservatoryLinked),
    ];
  }

  private providerSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const providerArena = recordOrNull(run.metadata.providerArena);
    const summary = recordOrNull(providerArena?.summary);
    const selected = recordOrNull(providerArena?.selected);
    const candidates = listRecords(providerArena?.candidates);
    const fallbackUsed = summary?.fallbackUsed === true
      || recordOrNull(run.metadata.llmRuntimeRoute)?.fallbackUsed === true;
    const readyCandidateCount = numberOrNull(summary?.readyCandidateCount) ?? candidates.filter((candidate) => candidate.ready === true).length;
    const unhealthy = candidates.filter((candidate) => normalizeText(candidate.healthStatus).toLowerCase() === 'unhealthy');
    const recommendedProvider = normalizeText(summary?.recommendedProviderLabel || selected?.providerLabel);
    const recommendedModel = normalizeText(summary?.recommendedModelLabel || selected?.modelLabel);
    if (!fallbackUsed && readyCandidateCount > 0 && unhealthy.length === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'provider-route-review',
        category: 'provider',
        title: 'Revisar rota de provider/modelo',
        cause: fallbackUsed
          ? 'Run usou fallback ou rota observada degradada.'
          : readyCandidateCount === 0
            ? 'Provider Arena nao encontrou candidato pronto.'
            : `${unhealthy.length} candidato(s) aparecem como unhealthy.`,
        impact: 'Respostas podem ficar mais lentas, caras ou falhar em runs semelhantes.',
        nextStep: recommendedProvider
          ? `Comparar ${recommendedProvider}${recommendedModel ? `/${recommendedModel}` : ''} com a rota configurada antes de trocar.`
          : 'Abrir Provider Arena e validar saude antes de alterar rota.',
        severity: readyCandidateCount === 0 ? 'danger' : 'warning',
        confidence: providerArena ? 0.86 : 0.62,
        requiresApproval: true,
        mutableAction: true,
        evidence: [
          {
            source: 'ProviderArenaService',
            ref: 'providerArena',
            detail: redactText(summary?.decisionSource, 'Provider Arena publicou evidencia de rota.'),
          },
        ],
        relatedToolIds: ['provider.route.preview'],
        run,
      }),
    ];
  }

  private budgetSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const budget = recordOrNull(run.metadata.runBudget);
    if (!budget) {
      return [];
    }
    const estimated = numberOrNull(budget.estimatedCostUnits);
    const max = numberOrNull(budget.maxEstimatedCostUnits);
    const degraded = budget.degraded === true
      || normalizeText(budget.status).toLowerCase() === 'exceeded'
      || (estimated !== null && max !== null && estimated > max);
    const reason = redactText(budget.reason || budget.summary || budget.policyReason);
    if (!degraded && !reason) {
      return [];
    }
    return [
      this.suggestion({
        id: 'budget-review',
        category: 'budget',
        title: 'Revisar budget/custo do run',
        cause: reason || 'Run publicou sinal de custo acima do esperado.',
        impact: 'Autonomia pode consumir mais quota ou degradar provider sem visibilidade.',
        nextStep: 'Abrir preview de reducao de custo antes de mudar provider, modelo ou profundidade.',
        severity: degraded ? 'warning' : 'info',
        confidence: 0.82,
        requiresApproval: true,
        mutableAction: true,
        evidence: [
          {
            source: 'RunBudgetPolicy',
            ref: 'runBudget',
            detail: estimated !== null && max !== null ? `estimado=${estimated}; max=${max}` : reason || 'budget observado',
          },
        ],
        relatedToolIds: ['budget.preview'],
        run,
      }),
    ];
  }

  private artifactMemorySuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const artifactMemory = recordOrNull(run.metadata.artifactMemory);
    if (!artifactMemory) {
      return [];
    }
    const summary = recordOrNull(artifactMemory.summary) || {};
    const status = normalizeText(artifactMemory.status).toLowerCase();
    const reusableCount = numberOrNull(summary.reusableCount) ?? 0;
    const linkedMemoryReceiptCount = numberOrNull(summary.linkedMemoryReceiptCount) ?? 0;
    const memoryEntryCount = numberOrNull(summary.memoryEntryCount) ?? 0;
    const entries = listRecords(artifactMemory.entries);
    if (reusableCount === 0 && status !== 'needs-index') {
      return [];
    }
    return [
      this.suggestion({
        id: 'artifact-memory-reuse',
        category: 'artifact-memory',
        title: status === 'needs-index' ? 'Indexar Artifact Memory com receipts' : 'Usar artifacts reutilizaveis com citacao',
        cause: status === 'needs-index'
          ? 'Artifact Memory tem entradas sem indexacao completa ou receipts faltantes.'
          : `${reusableCount} artifact(s) reutilizaveis foram publicados.`,
        impact: 'Planos, diffs e reports podem ser reaproveitados sem perder origem.',
        nextStep: linkedMemoryReceiptCount < memoryEntryCount
          ? 'Promover receipts faltantes somente por comando explicito.'
          : 'Reutilizar artifacts citando artifactId, runId e receipt.',
        severity: status === 'needs-index' ? 'warning' : 'info',
        confidence: 0.88,
        requiresApproval: status === 'needs-index',
        mutableAction: status === 'needs-index',
        evidence: entries.slice(0, 3).map((entry) => ({
          source: 'ArtifactMemoryService',
          ref: normalizeText(entry.artifactId, 'artifact'),
          detail: redactText(entry.title, 'artifact indexado'),
        })),
        relatedArtifactIds: entries.map((entry) => normalizeText(entry.artifactId)).filter(Boolean).slice(0, 6),
        relatedToolIds: ['artifact-memory.preview'],
        run,
      }),
    ];
  }

  private capabilitySuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const discovery = recordOrNull(run.metadata.naturalCapabilityDiscovery);
    const negotiation = recordOrNull(run.metadata.capabilityNegotiation);
    const safety = recordOrNull(discovery?.safety) || {};
    const recommendations = listRecords(discovery?.recommendations);
    const negotiationStatus = normalizeText(negotiation?.status).toLowerCase();
    const approvalRequired = safety.requiresApproval === true
      || negotiationStatus === 'waiting-approval'
      || negotiationStatus === 'proposal';
    const previewRequired = safety.previewRequired === true;
    if (!approvalRequired && !previewRequired && recommendations.length === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'capability-scope-review',
        category: 'capability',
        title: 'Revisar escopo de capability',
        cause: approvalRequired
          ? 'Discovery ou Capability Negotiation indicou approval/escopo pendente.'
          : 'Natural Capability Discovery encontrou capabilities candidatas.',
        impact: 'Ferramentas podem ficar bloqueadas ou amplas demais se o escopo nao for revisado.',
        nextStep: 'Gerar preview de escopo e pedir approval apenas para tools necessarias.',
        severity: approvalRequired ? 'warning' : 'info',
        confidence: 0.8,
        requiresApproval: approvalRequired,
        mutableAction: approvalRequired,
        evidence: recommendations.slice(0, 3).map((entry) => ({
          source: 'NaturalCapabilityDiscoveryService',
          ref: normalizeText(entry.id || entry.capabilityId),
          detail: redactText(entry.reason || entry.label, 'capability candidata'),
        })),
        relatedToolIds: listStrings(safety.approvalRequiredToolIds).concat(listStrings(safety.previewRequiredToolIds)).slice(0, 8),
        run,
      }),
    ];
  }

  private skillSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const quarantine = recordOrNull(run.metadata.skillMcpQuarantine);
    const summary = recordOrNull(quarantine?.summary) || {};
    const reviewRequired = numberOrNull(summary.reviewRequired) ?? 0;
    const quarantined = numberOrNull(summary.quarantined) ?? 0;
    if (reviewRequired === 0 && quarantined === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'skill-quarantine-review',
        category: 'skill',
        title: 'Revisar Skills/MCP em quarentena',
        cause: `${quarantined} import(s) em quarentena; ${reviewRequired} exigem review.`,
        impact: 'Capabilities importadas podem ficar ocultas ou inseguras se promovidas sem inspecao.',
        nextStep: 'Inspecionar origem e risco antes de promover qualquer skill/MCP.',
        severity: reviewRequired > 0 ? 'warning' : 'info',
        confidence: 0.84,
        requiresApproval: true,
        mutableAction: true,
        evidence: listRecords(quarantine?.entries).slice(0, 3).map((entry) => ({
          source: 'SkillMcpQuarantineService',
          ref: normalizeText(entry.id),
          detail: redactText(entry.riskLevel || entry.trustState, 'entrada em quarentena'),
        })),
        relatedToolIds: ['skill.review', 'mcp.review'],
        run,
      }),
    ];
  }

  private safetySuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const safety = recordOrNull(run.metadata.safetyNarrative);
    if (!safety) {
      return [];
    }
    const status = normalizeText(safety.status).toLowerCase();
    if (status !== 'blocked' && status !== 'waiting-approval' && safety.highRiskBlockPresent !== true) {
      return [];
    }
    return [
      this.suggestion({
        id: 'safety-resolution',
        category: 'safety',
        title: 'Resolver bloqueio de seguranca',
        cause: redactText(safety.summary || safety.userMessage, 'Safety Narrative publicou bloqueio ou approval pendente.'),
        impact: 'Run nao deve prosseguir com acao sensivel ate existir alternativa segura.',
        nextStep: 'Escolher alternativa segura ou aprovar escopo minimo depois de preview.',
        severity: status === 'blocked' ? 'danger' : 'warning',
        confidence: 0.9,
        requiresApproval: true,
        mutableAction: true,
        evidence: listRecords(safety.reasons).slice(0, 3).map((entry) => ({
          source: 'SafetyNarrativeService',
          ref: normalizeText(entry.id),
          detail: redactText(entry.title || entry.detail, 'motivo de safety'),
        })),
        relatedToolIds: listRecords(safety.reasons).flatMap((entry) => listStrings(entry.toolIds)).slice(0, 8),
        run,
      }),
    ];
  }

  private approvalSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const pendingApprovals = run.approvals.filter((approval) => approval.status === 'pending');
    if (pendingApprovals.length === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'pending-approvals',
        category: 'runtime',
        title: 'Aprovacoes pendentes',
        cause: `${pendingApprovals.length} approval(s) aguardam decisao do operador.`,
        impact: 'Runs podem ficar parados ate approval, reject ou ajuste de escopo.',
        nextStep: 'Revisar causa, risco e escopo antes de aprovar.',
        severity: 'warning',
        confidence: 0.95,
        requiresApproval: true,
        mutableAction: true,
        evidence: pendingApprovals.slice(0, 3).map((approval) => ({
          source: 'AgentRunService',
          ref: approval.id,
          detail: redactText(approval.title || approval.reason, 'approval pendente'),
        })),
        relatedToolIds: pendingApprovals.flatMap((approval) => {
          const approvalRecord = recordOrNull(approval) || {};
          const metadata = recordOrNull(approvalRecord.metadata) || {};
          return [
            ...listStrings(approvalRecord.toolIds),
            ...listStrings(metadata.toolIds),
          ];
        }).slice(0, 8),
        run,
      }),
    ];
  }

  private runtimeSuggestions(run: UniversalAgentRun, runObservatoryLinked: boolean): PersonalOpsAutopilotSuggestion[] {
    if (run.status !== 'failed' && runObservatoryLinked) {
      return [];
    }
    if (run.status === 'failed') {
      return [
        this.suggestion({
          id: 'runtime-failure-diagnosis',
          category: 'runtime',
          title: 'Diagnosticar falha do run',
          cause: redactText(run.summary, 'Run finalizou com falha.'),
          impact: 'Falhas repetidas podem afetar canais, providers ou automacoes futuras.',
          nextStep: 'Abrir diagnostico read-only antes de qualquer autorepair.',
          severity: 'danger',
          confidence: 0.82,
          requiresApproval: true,
          mutableAction: true,
          evidence: [
            {
              source: 'RunObservatory',
              ref: run.id,
              detail: runObservatoryLinked ? 'run presente no observatory' : 'observatory sem receipt para este run',
            },
          ],
          relatedToolIds: ['runtime.doctor', 'autorepair.preview'],
          run,
        }),
      ];
    }
    if (!runObservatoryLinked) {
      return [
        this.suggestion({
          id: 'observatory-receipt-gap',
          category: 'runtime',
          title: 'Completar receipts de observability',
          cause: 'Run Observatory nao retornou receipts para o run atual.',
          impact: 'Auditoria e replay ficam menos confiaveis.',
          nextStep: 'Gerar diagnostico de observability sem executar reparo automatico.',
          severity: 'info',
          confidence: 0.6,
          requiresApproval: false,
          mutableAction: false,
          evidence: [
            {
              source: 'RunObservatory',
              ref: run.id,
              detail: 'receipt ausente ou vazio',
            },
          ],
          relatedToolIds: ['observatory.inspect'],
          run,
        }),
      ];
    }
    return [];
  }

  private suggestion(input: {
    id: string;
    category: PersonalOpsAutopilotCategory;
    title: string;
    cause: string;
    impact: string;
    nextStep: string;
    severity: PersonalOpsAutopilotSuggestion['severity'];
    confidence: number;
    requiresApproval: boolean;
    mutableAction: boolean;
    evidence: PersonalOpsAutopilotSuggestion['evidence'];
    relatedArtifactIds?: string[];
    relatedToolIds?: string[];
    run: UniversalAgentRun;
  }): PersonalOpsAutopilotSuggestion {
    const id = `personal-ops:${normalizeKey(input.id)}`;
    return {
      id,
      category: input.category,
      title: redactText(input.title),
      cause: redactText(input.cause),
      impact: redactText(input.impact),
      nextStep: redactText(input.nextStep),
      severity: input.severity,
      confidence: clampConfidence(input.confidence),
      requiresApproval: input.requiresApproval,
      previewAvailable: true,
      mutableAction: input.mutableAction,
      evidence: input.evidence.length > 0
        ? input.evidence.map((entry, index) => ({
          source: redactText(entry.source, 'runtime'),
          ref: normalizeText(entry.ref) || null,
          detail: redactText(entry.detail, `evidencia ${index + 1}`),
          ...(entry.receiptId ? { receiptId: entry.receiptId } : {}),
        }))
        : [{
          source: 'PersonalOpsAutopilotService',
          ref: input.run.id,
          detail: 'Sugestao derivada do snapshot atual do run.',
        }],
      relatedArtifactIds: Array.from(new Set(input.relatedArtifactIds || [])).slice(0, 8),
      relatedToolIds: Array.from(new Set(input.relatedToolIds || [])).slice(0, 8),
      actions: {
        previewCommand: `zavorth personal-ops preview ${normalizeKey(input.id)} --run ${input.run.id}`,
        approvalCommand: input.requiresApproval
          ? `zavorth personal-ops approve ${normalizeKey(input.id)} --run ${input.run.id}`
          : `zavorth personal-ops review ${normalizeKey(input.id)} --run ${input.run.id}`,
        runCommand: input.mutableAction
          ? `zavorth personal-ops run ${normalizeKey(input.id)} --requires-approval`
          : `zavorth personal-ops inspect ${normalizeKey(input.id)}`,
        dismissCommand: `zavorth personal-ops dismiss ${normalizeKey(input.id)} --run ${input.run.id}`,
      },
    };
  }

  private buildReceipts(
    run: UniversalAgentRun,
    suggestions: PersonalOpsAutopilotSuggestion[],
    observatoryReceiptCount: number,
  ): PersonalOpsAutopilotReceipt[] {
    const receipts: PersonalOpsAutopilotReceipt[] = [
      {
        id: 'personal-ops:receipt:run-observatory',
        kind: 'run-observatory',
        source: 'RunObservatory',
        detail: `${observatoryReceiptCount} observability receipt(s) usados para contexto.`,
        status: observatoryReceiptCount > 0 ? 'ready' : 'missing',
      },
      {
        id: 'personal-ops:receipt:policy',
        kind: 'policy',
        source: 'PersonalOpsAutopilotService',
        detail: 'Autopilot apenas sugere; mutacoes exigem preview e approval.',
        status: 'ready',
      },
      {
        id: 'personal-ops:receipt:surface',
        kind: 'surface',
        source: '/zavorthControl',
        detail: 'Personal Ops Autopilot projetado em /zavorthControl e CLI.',
        status: 'ready',
      },
    ];
    if (recordOrNull(run.metadata.naturalCapabilityDiscovery)) {
      receipts.push({
        id: 'personal-ops:receipt:natural-capability-discovery',
        kind: 'natural-capability-discovery',
        source: 'NaturalCapabilityDiscoveryService',
        detail: 'Discovery usado para sugerir escopo operacional.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.runBudget)) {
      receipts.push({
        id: 'personal-ops:receipt:budget',
        kind: 'budget',
        source: 'RunBudgetPolicy',
        detail: 'Budget/custo usado como evidencia de autopilot.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.providerArena)) {
      receipts.push({
        id: 'personal-ops:receipt:provider-arena',
        kind: 'provider-arena',
        source: 'ProviderArenaService',
        detail: 'Provider Arena usada para recomendacao de rota.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.artifactMemory)) {
      receipts.push({
        id: 'personal-ops:receipt:artifact-memory',
        kind: 'artifact-memory',
        source: 'ArtifactMemoryService',
        detail: 'Artifact Memory usada para oportunidades de reuso.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.skillMcpQuarantine)) {
      receipts.push({
        id: 'personal-ops:receipt:skill-quarantine',
        kind: 'skill-quarantine',
        source: 'SkillMcpQuarantineService',
        detail: 'Quarentena usada para sugerir review.',
        status: 'ready',
      });
    }
    if (suggestions.some((suggestion) => suggestion.requiresApproval)) {
      receipts.push({
        id: 'personal-ops:receipt:approval',
        kind: 'approval',
        source: 'AgentRunService',
        detail: 'Uma ou mais sugestoes exigem approval antes de mutacao.',
        status: 'needs-review',
      });
    }
    return receipts;
  }

  private resolveStatus(
    run: UniversalAgentRun,
    suggestions: PersonalOpsAutopilotSuggestion[],
  ): PersonalOpsAutopilotStatus {
    if (run.status === 'failed' && suggestions.some((suggestion) => suggestion.severity === 'danger')) {
      return 'blocked';
    }
    if (suggestions.some((suggestion) => suggestion.requiresApproval)) {
      return 'waiting-approval';
    }
    if (suggestions.length > 0) {
      return 'suggesting';
    }
    return 'idle';
  }

  private nextSafeAction(
    status: PersonalOpsAutopilotStatus,
    suggestions: PersonalOpsAutopilotSuggestion[],
  ): string {
    if (status === 'blocked') {
      return 'Abrir diagnostico read-only e escolher preview antes de qualquer autorepair.';
    }
    if (status === 'waiting-approval') {
      return 'Revisar sugestoes com approval requerido; nenhuma acao mutavel foi executada.';
    }
    if (status === 'suggesting') {
      const first = suggestions[0];
      return first
        ? `Rodar preview: ${first.actions.previewCommand}`
        : 'Revisar sugestoes operacionais em modo read-only.';
    }
    return 'Nenhuma correcao operacional sugerida agora; continuar observando o runtime.';
  }
}
