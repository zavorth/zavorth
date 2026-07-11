import { createHash } from 'node:crypto';
import type {
  ZavorthCapabilityOsRouteDecision,
  ZavorthCapabilityOsService,
} from './ZavorthCapabilityOsService.js';
import type {
  ZavorthTaskOperatingSystemService,
  ZavorthTaskOsSnapshot,
} from './ZavorthTaskOperatingSystemService.js';
import type { TaskLedgerTaskSnapshot } from './TaskLedgerService.js';

export type ZavorthSupervisorGraphNodeId =
  | 'intake'
  | 'planner'
  | 'risk_classifier'
  | 'executor_picker'
  | 'researcher'
  | 'coder'
  | 'critic'
  | 'sandbox_runner'
  | 'artifact_builder'
  | 'final_reviewer'
  | 'delivery';

export type ZavorthSupervisorGraphMode = 'linear' | 'graph';
export type ZavorthSupervisorGraphStatus = 'ready' | 'paused';
export type ZavorthSupervisorGraphNodeStatus = 'planned' | 'skipped' | 'paused';

export type ZavorthSupervisorGraphBudget = {
  maxRetries: number;
  maxCost: number;
  estimatedCost: number;
  spentCost: number;
  remainingCost: number;
  exceeded: boolean;
  pauseReason: string | null;
};

export type ZavorthSupervisorGraphNode = {
  id: ZavorthSupervisorGraphNodeId;
  label: string;
  role: string;
  status: ZavorthSupervisorGraphNodeStatus;
  mutates: boolean;
  capability: string | null;
  requiresApproval: boolean;
  evidenceRequired: boolean;
};

export type ZavorthSupervisorGraphEdge = {
  from: ZavorthSupervisorGraphNodeId;
  to: ZavorthSupervisorGraphNodeId;
  reason: string;
  guardrail: string;
};

export type ZavorthSupervisorGraphLedgerEntry = {
  step: number;
  from: ZavorthSupervisorGraphNodeId | 'start';
  to: ZavorthSupervisorGraphNodeId | 'paused';
  decision: string;
  evidence: {
    kind: string;
    summary: string;
    inputDigest: string;
    sensitiveData: 'redacted';
  };
};

export type ZavorthSupervisorGraphCorrectionAttempt = {
  attempt: number;
  from: ZavorthSupervisorGraphNodeId;
  to: ZavorthSupervisorGraphNodeId;
  reason: string;
  retryBudgetRemaining: number;
};

export type ZavorthSupervisorGraphSnapshot = {
  generatedAt: string;
  gate: 'supervisor-graph';
  surface: 'supervisor-graph';
  objective: {
    preview: string;
    digest: string;
  };
  mode: ZavorthSupervisorGraphMode;
  status: ZavorthSupervisorGraphStatus;
  taskBinding: {
    requestedTaskId: string | null;
    task: TaskLedgerTaskSnapshot | null;
    source: 'task-os' | 'objective-only';
  };
  route: ZavorthCapabilityOsRouteDecision | null;
  complexity: {
    score: number;
    threshold: number;
    reasons: string[];
  };
  budget: ZavorthSupervisorGraphBudget;
  nodes: ZavorthSupervisorGraphNode[];
  edges: ZavorthSupervisorGraphEdge[];
  ledger: ZavorthSupervisorGraphLedgerEntry[];
  reflexion: {
    enabled: boolean;
    maxRetries: number;
    attemptsUsed: number;
    correctionLoop: ZavorthSupervisorGraphCorrectionAttempt[];
    reason: string;
  };
  contracts: {
    graphOnlyWhenComplex: boolean;
    simpleFlowRemainsLinear: boolean;
    maxRetriesAndCostRequired: boolean;
    everyTransitionHasEvidence: boolean;
    supervisorDoesNotMutate: true;
    executorInsideAuthorizedCapability: boolean;
    criticBeforeDelivery: boolean;
    sandboxBeforeRiskyDelivery: boolean;
    sensitiveDataRedacted: boolean;
  };
  finalResponseContract: {
    includesTests: boolean;
    includesLimits: boolean;
    includesPendingItems: boolean;
    summary: string;
  };
  commands: {
    plan: string;
    simulateFailure: string;
    budgetPreview: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthSupervisorGraphPlanInput = {
  objective?: string | null;
  taskId?: string | null;
  userId?: string | null;
  forceGraph?: boolean;
  simulateTestFailure?: boolean;
  maxRetries?: number | null;
  maxCost?: number | null;
  spentCost?: number | null;
};

type SupervisorCapabilityRouteService = Pick<ZavorthCapabilityOsService, 'explainRoute'>;
type SupervisorTaskOsService = Pick<ZavorthTaskOperatingSystemService, 'buildSnapshot'>;

type ZavorthSupervisorGraphRuntime = {
  now?: () => Date;
  capabilityOsService?: SupervisorCapabilityRouteService | null;
  taskOperatingSystemService?: SupervisorTaskOsService | null;
};

const NODE_LIBRARY: Record<ZavorthSupervisorGraphNodeId, Omit<ZavorthSupervisorGraphNode, 'status' | 'capability' | 'requiresApproval'>> = {
  intake: {
    id: 'intake',
    label: 'Intake',
    role: 'Normaliza objetivo, escopo e vinculo com task/conversa.',
    mutates: false,
    evidenceRequired: true,
  },
  planner: {
    id: 'planner',
    label: 'Planner',
    role: 'Splits complex tasks into steps and acceptance criteria.',
    mutates: false,
    evidenceRequired: true,
  },
  risk_classifier: {
    id: 'risk_classifier',
    label: 'Risk classifier',
    role: 'Classifica risco, permissao e necessidade de sandbox.',
    mutates: false,
    evidenceRequired: true,
  },
  executor_picker: {
    id: 'executor_picker',
    label: 'Executor picker',
    role: 'Escolhe capability/executor autorizado e fallback.',
    mutates: false,
    evidenceRequired: true,
  },
  researcher: {
    id: 'researcher',
    label: 'Researcher',
    role: 'Collects context when the task depends on external information or broad reading.',
    mutates: false,
    evidenceRequired: true,
  },
  coder: {
    id: 'coder',
    label: 'Coder',
    role: 'Prepara patch ou acao tecnica dentro da capability autorizada.',
    mutates: true,
    evidenceRequired: true,
  },
  critic: {
    id: 'critic',
    label: 'Critic',
    role: 'Revisa saida antes de validar ou entregar.',
    mutates: false,
    evidenceRequired: true,
  },
  sandbox_runner: {
    id: 'sandbox_runner',
    label: 'Sandbox runner',
    role: 'Validates code, dangerous commands, or tests in a controlled environment.',
    mutates: false,
    evidenceRequired: true,
  },
  artifact_builder: {
    id: 'artifact_builder',
    label: 'Artifact builder',
    role: 'Empacota patch, logs, relatorio ou fontes como artefatos rastreaveis.',
    mutates: false,
    evidenceRequired: true,
  },
  final_reviewer: {
    id: 'final_reviewer',
    label: 'Final reviewer',
    role: 'Confere testes, limites e pendencias antes da resposta final.',
    mutates: false,
    evidenceRequired: true,
  },
  delivery: {
    id: 'delivery',
    label: 'Delivery',
    role: 'Entrega resposta final com evidencias e proximos passos.',
    mutates: false,
    evidenceRequired: true,
  },
};

const FULL_NODE_ORDER: ZavorthSupervisorGraphNodeId[] = [
  'intake',
  'planner',
  'risk_classifier',
  'executor_picker',
  'researcher',
  'coder',
  'critic',
  'sandbox_runner',
  'artifact_builder',
  'final_reviewer',
  'delivery',
];

export class ZavorthSupervisorGraphService {
  private readonly now: () => Date;
  private readonly capabilityOsService: SupervisorCapabilityRouteService | null;
  private readonly taskOperatingSystemService: SupervisorTaskOsService | null;

  constructor(runtime: ZavorthSupervisorGraphRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityOsService = runtime.capabilityOsService || null;
    this.taskOperatingSystemService = runtime.taskOperatingSystemService || null;
  }

  public async buildSnapshot(input: ZavorthSupervisorGraphPlanInput = {}): Promise<ZavorthSupervisorGraphSnapshot> {
    const generatedAt = this.now().toISOString();
    const taskBinding = await this.resolveTaskBinding(input);
    const objective = this.resolveObjective(input.objective, taskBinding.task);
    const objectivePreview = this.redactText(objective);
    const inputDigest = this.digest(objective);
    const route = this.capabilityOsService
      ? this.capabilityOsService.explainRoute(objective, {
          commandType: '/task',
          sourceSurface: 'supervisor-graph',
          writeLedger: false,
        })
      : null;
    const complexity = this.classifyComplexity(objective, route, Boolean(input.forceGraph));
    const mode: ZavorthSupervisorGraphMode = complexity.score >= complexity.threshold || input.forceGraph
      ? 'graph'
      : 'linear';
    const maxRetries = this.positiveInteger(input.maxRetries, 1);
    const maxCost = this.positiveNumber(input.maxCost, 8);
    const spentCost = Math.max(0, Number(input.spentCost || 0));
    const activeNodes = this.resolveActiveNodes(mode, objective, route);
    const estimatedCost = this.estimateCost(activeNodes, {
      maxRetries,
      simulateTestFailure: Boolean(input.simulateTestFailure),
    });
    const budget = this.buildBudget({
      maxRetries,
      maxCost,
      spentCost,
      estimatedCost,
      simulateTestFailure: Boolean(input.simulateTestFailure),
    });
    const status: ZavorthSupervisorGraphStatus = budget.exceeded ? 'paused' : 'ready';
    const nodes = this.buildNodes(activeNodes, route, status);
    const edges = status === 'paused'
      ? this.buildPausedEdges(activeNodes)
      : this.buildEdges(activeNodes, route);
    const correctionLoop = this.buildCorrectionLoop({
      simulateTestFailure: Boolean(input.simulateTestFailure),
      maxRetries,
      status,
    });
    const ledger = this.buildLedger({
      activeNodes,
      edges,
      status,
      budget,
      route,
      inputDigest,
      correctionLoop,
    });

    return {
      generatedAt,
      gate: 'supervisor-graph',
      surface: 'supervisor-graph',
      objective: {
        preview: objectivePreview,
        digest: inputDigest,
      },
      mode,
      status,
      taskBinding,
      route,
      complexity,
      budget,
      nodes,
      edges,
      ledger,
      reflexion: {
        enabled: mode === 'graph',
        maxRetries,
        attemptsUsed: correctionLoop.length,
        correctionLoop,
        reason: this.buildReflexionReason(mode, correctionLoop, maxRetries, status),
      },
      contracts: this.buildContracts({
        mode,
        complexity,
        activeNodes,
        nodes,
        edges,
        ledger,
        route,
        budget,
      }),
      finalResponseContract: this.buildFinalResponseContract(mode, status, budget, correctionLoop),
      commands: {
        plan: `zavorth supervisor plan "${objectivePreview}" --json`,
        simulateFailure: `zavorth supervisor plan "${objectivePreview}" --simulate-test-failure --json`,
        budgetPreview: `zavorth supervisor plan "${objectivePreview}" --max-cost ${Math.max(1, Math.floor(maxCost / 2))} --json`,
      },
      narrative: this.buildNarrative(mode, status, activeNodes, budget, correctionLoop),
    };
  }

  private async resolveTaskBinding(input: ZavorthSupervisorGraphPlanInput): Promise<ZavorthSupervisorGraphSnapshot['taskBinding']> {
    const requestedTaskId = this.firstText([input.taskId]);
    if (!this.taskOperatingSystemService || !requestedTaskId) {
      return {
        requestedTaskId: requestedTaskId || null,
        task: null,
        source: 'objective-only',
      };
    }

    const snapshot = await this.taskOperatingSystemService.buildSnapshot({
      taskId: requestedTaskId,
      userId: input.userId || null,
      limit: 20,
    }) as ZavorthTaskOsSnapshot;
    const task = snapshot.taskLedger.selected
      || snapshot.taskLedger.tasks.find((entry) => entry.taskId === requestedTaskId)
      || null;

    return {
      requestedTaskId,
      task,
      source: task ? 'task-os' : 'objective-only',
    };
  }

  private resolveObjective(objective: string | null | undefined, task: TaskLedgerTaskSnapshot | null): string {
    return this.firstText([
      objective,
      task?.summary,
      task?.intent,
      'plan a complex task with review, validation, and auditable delivery',
    ]) || 'plan a complex task with review, validation, and auditable delivery';
  }

  private classifyComplexity(
    objective: string,
    route: ZavorthCapabilityOsRouteDecision | null,
    forceGraph: boolean,
  ): ZavorthSupervisorGraphSnapshot['complexity'] {
    const normalized = objective.toLowerCase();
    const reasons: string[] = [];
    let score = 0.15;

    if (forceGraph) {
      score += 0.7;
      reasons.push('graph solicitado explicitamente');
    }
    if (route?.selected?.routing.requiresPlanning) {
      score += 0.35;
      reasons.push('capability sinalizou requiresPlanning');
    }
    if (route?.decision.requiresApproval) {
      score += 0.22;
      reasons.push('capability requires approval');
    }
    if (route?.decision.riskLevel === 'high') {
      score += 0.22;
      reasons.push('risco alto no Capability OS');
    } else if (route?.decision.riskLevel === 'medium') {
      score += 0.14;
      reasons.push('risco medio no Capability OS');
    }
    if (/\b(corrija|implemente|refatore|bug|codigo|teste|build|deploy|patch|arquivo|repo|workspace)\b/i.test(normalized)) {
      score += 0.22;
      reasons.push('technical task with possible workspace change');
    }
    if (/\b(pesquise|investigue|compare|fontes|noticias|web|documentacao)\b/i.test(normalized)) {
      score += 0.12;
      reasons.push('task may require research or broad reading');
    }
    if (/\b(e|depois|entao|tambem|multi|workflow|pipeline|valid(e|a)|rode|execute)\b/i.test(normalized)) {
      score += 0.12;
      reasons.push('pedido composto ou com validacao explicita');
    }

    if (reasons.length === 0) {
      reasons.push('pedido simples permanece no fluxo linear');
    }

    return {
      score: Math.min(1, Number(score.toFixed(2))),
      threshold: 0.55,
      reasons,
    };
  }

  private resolveActiveNodes(
    mode: ZavorthSupervisorGraphMode,
    objective: string,
    route: ZavorthCapabilityOsRouteDecision | null,
  ): ZavorthSupervisorGraphNodeId[] {
    if (mode === 'linear') {
      return ['intake', 'executor_picker', 'delivery'];
    }

    const normalized = objective.toLowerCase();
    const needsResearch = route?.selected?.type === 'research'
      || /\b(pesquise|investigue|fontes|noticias|web|documentacao|compare)\b/i.test(normalized);
    const needsCoder = route?.selected?.type === 'executor'
      || route?.selected?.type === 'workflow'
      || /\b(corrija|implemente|refatore|bug|codigo|teste|build|patch|arquivo|repo|workspace)\b/i.test(normalized);

    return FULL_NODE_ORDER.filter((nodeId) => {
      if (nodeId === 'researcher') {
        return needsResearch || !needsCoder;
      }
      if (nodeId === 'coder') {
        return needsCoder || !needsResearch;
      }
      return true;
    });
  }

  private estimateCost(
    activeNodes: ZavorthSupervisorGraphNodeId[],
    options: { maxRetries: number; simulateTestFailure: boolean },
  ): number {
    const nodeCost = activeNodes.length * 0.42;
    const retryCost = options.simulateTestFailure ? Math.min(options.maxRetries, 1) * 0.65 : 0;
    return Number((nodeCost + retryCost + 0.5).toFixed(2));
  }

  private buildBudget(input: {
    maxRetries: number;
    maxCost: number;
    spentCost: number;
    estimatedCost: number;
    simulateTestFailure: boolean;
  }): ZavorthSupervisorGraphBudget {
    const remainingCost = Number((input.maxCost - input.spentCost - input.estimatedCost).toFixed(2));
    const exceeded = remainingCost < 0 || (input.simulateTestFailure && input.maxRetries < 1);
    const retryPause = input.simulateTestFailure && input.maxRetries < 1
      ? 'Simulated failure requires correction, but maxRetries is zero.'
      : null;
    const costPause = remainingCost < 0
      ? `Budget insuficiente: estimativa ${input.estimatedCost} excede limite restante ${Number((input.maxCost - input.spentCost).toFixed(2))}.`
      : null;
    return {
      maxRetries: input.maxRetries,
      maxCost: input.maxCost,
      estimatedCost: input.estimatedCost,
      spentCost: input.spentCost,
      remainingCost,
      exceeded,
      pauseReason: retryPause || costPause,
    };
  }

  private buildNodes(
    activeNodes: ZavorthSupervisorGraphNodeId[],
    route: ZavorthCapabilityOsRouteDecision | null,
    status: ZavorthSupervisorGraphStatus,
  ): ZavorthSupervisorGraphNode[] {
    const active = new Set(activeNodes);
    const capability = route?.selected?.id || route?.decision.executorPreference || null;
    const requiresApproval = Boolean(route?.decision.requiresApproval);
    return FULL_NODE_ORDER.map((nodeId) => {
      const base = NODE_LIBRARY[nodeId];
      return {
        ...base,
        status: active.has(nodeId)
          ? status === 'paused' && nodeId !== 'intake' && nodeId !== 'planner' && nodeId !== 'risk_classifier'
            ? 'paused'
            : 'planned'
          : 'skipped',
        capability: nodeId === 'executor_picker' || nodeId === 'coder' || nodeId === 'researcher'
          ? capability
          : null,
        requiresApproval: (nodeId === 'executor_picker' || nodeId === 'coder') && requiresApproval,
      };
    });
  }

  private buildEdges(
    activeNodes: ZavorthSupervisorGraphNodeId[],
    route: ZavorthCapabilityOsRouteDecision | null,
  ): ZavorthSupervisorGraphEdge[] {
    const edges: ZavorthSupervisorGraphEdge[] = [];
    for (let index = 0; index < activeNodes.length - 1; index += 1) {
      const from = activeNodes[index];
      const to = activeNodes[index + 1];
      edges.push({
        from,
        to,
        reason: this.transitionReason(from, to, route),
        guardrail: this.transitionGuardrail(from, to),
      });
    }
    return edges;
  }

  private buildPausedEdges(activeNodes: ZavorthSupervisorGraphNodeId[]): ZavorthSupervisorGraphEdge[] {
    const safePrefix = activeNodes.filter((node) => ['intake', 'planner', 'risk_classifier'].includes(node));
    return this.buildEdges(safePrefix.length >= 2 ? safePrefix : ['intake', 'risk_classifier'], null);
  }

  private buildCorrectionLoop(input: {
    simulateTestFailure: boolean;
    maxRetries: number;
    status: ZavorthSupervisorGraphStatus;
  }): ZavorthSupervisorGraphCorrectionAttempt[] {
    if (!input.simulateTestFailure || input.status === 'paused' || input.maxRetries < 1) {
      return [];
    }
    return [
      {
        attempt: 1,
        from: 'sandbox_runner',
        to: 'coder',
        reason: 'Test failure returns once for correction before delivery.',
        retryBudgetRemaining: Math.max(0, input.maxRetries - 1),
      },
    ];
  }

  private buildLedger(input: {
    activeNodes: ZavorthSupervisorGraphNodeId[];
    edges: ZavorthSupervisorGraphEdge[];
    status: ZavorthSupervisorGraphStatus;
    budget: ZavorthSupervisorGraphBudget;
    route: ZavorthCapabilityOsRouteDecision | null;
    inputDigest: string;
    correctionLoop: ZavorthSupervisorGraphCorrectionAttempt[];
  }): ZavorthSupervisorGraphLedgerEntry[] {
    const entries: ZavorthSupervisorGraphLedgerEntry[] = [
      this.ledgerEntry(1, 'start', 'intake', 'Objetivo normalizado e dados sensiveis redigidos.', 'intake', input.inputDigest),
    ];

    for (const edge of input.edges) {
      entries.push(this.ledgerEntry(
        entries.length + 1,
        edge.from,
        edge.to,
        edge.reason,
        edge.guardrail,
        input.inputDigest,
      ));
    }

    for (const attempt of input.correctionLoop) {
      entries.push(this.ledgerEntry(
        entries.length + 1,
        attempt.from,
        attempt.to,
        attempt.reason,
        'reflexion-retry-budget',
        input.inputDigest,
      ));
    }

    if (input.status === 'paused') {
      entries.push(this.ledgerEntry(
        entries.length + 1,
        input.edges.at(-1)?.to || 'risk_classifier',
        'paused',
        input.budget.pauseReason || 'Fluxo pausado por budget ou retries.',
        'budget-stop',
        input.inputDigest,
      ));
    }

    return entries;
  }

  private buildContracts(input: {
    mode: ZavorthSupervisorGraphMode;
    complexity: ZavorthSupervisorGraphSnapshot['complexity'];
    activeNodes: ZavorthSupervisorGraphNodeId[];
    nodes: ZavorthSupervisorGraphNode[];
    edges: ZavorthSupervisorGraphEdge[];
    ledger: ZavorthSupervisorGraphLedgerEntry[];
    route: ZavorthCapabilityOsRouteDecision | null;
    budget: ZavorthSupervisorGraphBudget;
  }): ZavorthSupervisorGraphSnapshot['contracts'] {
    const activeSet = new Set(input.activeNodes);
    const deliveryIndex = input.activeNodes.indexOf('delivery');
    const criticIndex = input.activeNodes.indexOf('critic');
    const sandboxIndex = input.activeNodes.indexOf('sandbox_runner');
    const risky = input.route?.decision.riskLevel === 'high'
      || input.route?.decision.requiresApproval
      || activeSet.has('coder');

    return {
      graphOnlyWhenComplex: input.mode === 'graph'
        ? input.complexity.score >= input.complexity.threshold
        : true,
      simpleFlowRemainsLinear: input.mode === 'linear'
        ? input.activeNodes.join('>') === 'intake>executor_picker>delivery'
        : true,
      maxRetriesAndCostRequired: input.budget.maxRetries >= 0 && input.budget.maxCost > 0,
      everyTransitionHasEvidence: input.ledger.every((entry) =>
        Boolean(entry.evidence.summary) && Boolean(entry.evidence.inputDigest)),
      supervisorDoesNotMutate: true,
      executorInsideAuthorizedCapability: input.nodes
        .filter((node) => node.mutates && node.status !== 'skipped')
        .every((node) => Boolean(node.capability) || Boolean(input.route)),
      criticBeforeDelivery: input.mode === 'linear'
        ? true
        : criticIndex >= 0 && deliveryIndex >= 0 && criticIndex < deliveryIndex,
      sandboxBeforeRiskyDelivery: !risky
        ? true
        : sandboxIndex >= 0 && deliveryIndex >= 0 && sandboxIndex < deliveryIndex,
      sensitiveDataRedacted: input.ledger.every((entry) => entry.evidence.sensitiveData === 'redacted'),
    };
  }

  private buildFinalResponseContract(
    mode: ZavorthSupervisorGraphMode,
    status: ZavorthSupervisorGraphStatus,
    budget: ZavorthSupervisorGraphBudget,
    correctionLoop: ZavorthSupervisorGraphCorrectionAttempt[],
  ): ZavorthSupervisorGraphSnapshot['finalResponseContract'] {
    const testText = mode === 'graph'
      ? 'Resposta final deve citar plano, critica e validacao/sandbox.'
      : 'Linear response must cite applicable validation or state that no test was run.';
    const pendingText = status === 'paused'
      ? `Pendente: ${budget.pauseReason || 'aprovar mais budget/retries.'}`
      : correctionLoop.length > 0
        ? 'Pending: report that a correction occurred after simulated test failure.'
        : 'Pendente: listar limites conhecidos antes de encerrar.';
    return {
      includesTests: true,
      includesLimits: true,
      includesPendingItems: true,
      summary: `${testText} ${pendingText}`,
    };
  }

  private buildReflexionReason(
    mode: ZavorthSupervisorGraphMode,
    correctionLoop: ZavorthSupervisorGraphCorrectionAttempt[],
    maxRetries: number,
    status: ZavorthSupervisorGraphStatus,
  ): string {
    if (status === 'paused') {
      return 'Reflexion paused because the flow does not have enough budget/retries.';
    }
    if (mode === 'linear') {
      return 'Simple flow does not activate reflexion to avoid unnecessary cost and latency.';
    }
    if (correctionLoop.length > 0) {
      return `Critico/sandbox devolvem para correcao uma vez; limite configurado: ${maxRetries}.`;
    }
    return `Critico e sandbox revisam antes de delivery; retry maximo configurado: ${maxRetries}.`;
  }

  private buildNarrative(
    mode: ZavorthSupervisorGraphMode,
    status: ZavorthSupervisorGraphStatus,
    activeNodes: ZavorthSupervisorGraphNodeId[],
    budget: ZavorthSupervisorGraphBudget,
    correctionLoop: ZavorthSupervisorGraphCorrectionAttempt[],
  ): ZavorthSupervisorGraphSnapshot['narrative'] {
    if (status === 'paused') {
      return {
        headline: 'Supervisor Graph pausou antes de gastar budget.',
        operatorSummary: budget.pauseReason || 'Budget/retries insuficientes para continuar.',
      };
    }
    return {
      headline: mode === 'graph'
        ? `DAG supervisionada pronta com ${activeNodes.length} nodos ativos.`
        : 'Fluxo simples mantido linear.',
      operatorSummary: correctionLoop.length > 0
        ? 'Simulated test failure returns once for correction before delivery.'
        : 'Supervisor registra evidencias, escolhe executor autorizado e revisa antes de entregar quando ha risco.',
    };
  }

  private transitionReason(
    from: ZavorthSupervisorGraphNodeId,
    to: ZavorthSupervisorGraphNodeId,
    route: ZavorthCapabilityOsRouteDecision | null,
  ): string {
    if (from === 'executor_picker' && route?.selected) {
      return `Executor escolhido via Capability OS: ${route.selected.id}.`;
    }
    if (to === 'critic') {
      return 'Saida passa por critica antes de validacao ou entrega.';
    }
    if (to === 'sandbox_runner') {
      return 'Risky code/command requires sandbox validation.';
    }
    if (to === 'delivery') {
      return 'Entrega so acontece depois dos guardrails aplicaveis.';
    }
    return `${NODE_LIBRARY[from].label} libera ${NODE_LIBRARY[to].label}.`;
  }

  private transitionGuardrail(from: ZavorthSupervisorGraphNodeId, to: ZavorthSupervisorGraphNodeId): string {
    if (from === 'risk_classifier' || to === 'risk_classifier') {
      return 'risk-and-permission-check';
    }
    if (to === 'sandbox_runner') {
      return 'sandbox-validation';
    }
    if (to === 'final_reviewer') {
      return 'tests-limits-pending-review';
    }
    if (to === 'delivery') {
      return 'final-response-contract';
    }
    return 'evidence-required';
  }

  private ledgerEntry(
    step: number,
    from: ZavorthSupervisorGraphLedgerEntry['from'],
    to: ZavorthSupervisorGraphLedgerEntry['to'],
    decision: string,
    kind: string,
    inputDigest: string,
  ): ZavorthSupervisorGraphLedgerEntry {
    return {
      step,
      from,
      to,
      decision,
      evidence: {
        kind,
        summary: decision,
        inputDigest,
        sensitiveData: 'redacted',
      },
    };
  }

  private redactText(value: string, maxLength = 120): string {
    const redacted = String(value || '')
      .replace(/\b(sk|pk|api|token|secret)[_-]?[A-Za-z0-9_-]{8,}\b/gi, '[redacted-secret]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[redacted-number]')
      .replace(/\s+/g, ' ')
      .trim();
    return redacted.length <= maxLength
      ? redacted
      : `${redacted.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  private digest(value: string): string {
    return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
  }

  private positiveInteger(value: number | null | undefined, fallback: number): number {
    if (value === null || value === undefined) {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }

  private positiveNumber(value: number | null | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Number(parsed.toFixed(2));
  }

  private firstText(values: Array<string | null | undefined>): string | null {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }
}
