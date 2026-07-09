import { randomUUID } from 'node:crypto';
import type { SwarmRole, SwarmSnapshot } from '../../../runtime/sessions/v2/SwarmOrchestrator.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  type SubagentBudgetInput,
  type SubagentResultReceipt,
} from '../../../runtime/agent/subagents/index.js';
import { CanonicalExecutionPipelineService } from '../../../services/CanonicalExecutionPipelineService.js';

import { SwarmV2Service } from '../../../services/SwarmV2Service.js';

export type DynamicHierarchyComplexity = 'low' | 'medium' | 'high';

export type DynamicHierarchyRoleNode = {
  nodeId: string;
  parentNodeId: string | null;
  depth: number;
  roleId: string;
  label: string;
  systemPrompt: string;
  lineage: string[];
  children: DynamicHierarchyRoleNode[];
};

export type DynamicHierarchyPlan = {
  hierarchyId: string;
  objective: string;
  complexity: DynamicHierarchyComplexity;
  maxDepth: number;
  maxLeafRoles: number;
  rootNodes: DynamicHierarchyRoleNode[];
  leafRoles: SwarmRole[];
  totalNodes: number;
  traceId: string;
  runId: string;
  sessionId: string | null;
  execution_lifecycle: unknown[];
  subagentReceipts: SubagentResultReceipt[];
};

export type DynamicHierarchyLaunchResult = {
  plan: DynamicHierarchyPlan;
  snapshot: SwarmSnapshot;
};

type DynamicHierarchyRequest = {
  hierarchyId?: string | null;
  objective: string;
  roles?: SwarmRole[];
  complexity?: DynamicHierarchyComplexity | null;
  maxDepth?: number | null;
  maxLeafRoles?: number | null;
  requestedBy?: string | null;
  surface?: string | null;
  subagentBudget?: SubagentBudgetInput | null;
};

type ChildRoleTemplate = {
  roleIdSuffix: string;
  label: string;
  systemPrompt: string;
};

type SwarmLauncher = Pick<SwarmV2Service, 'launchSwarm'> & Partial<Pick<SwarmV2Service, 'waitForSwarm'>>;

const DEFAULT_ROOT_ROLES: SwarmRole[] = [
  {
    id: 'planner',
    label: 'Planner',
    systemPrompt: 'Quebre o objetivo em trilhas claras, riscos e checkpoints acionaveis.',
  },
  {
    id: 'implementer',
    label: 'Implementer',
    systemPrompt: 'Conduza a implementacao principal e destaque dependencias concretas.',
  },
  {
    id: 'verifier',
    label: 'Verifier',
    systemPrompt: 'Valide riscos, regressao, testes e aceite operacional.',
  },
];

export class DynamicHierarchySwarmService {
  private readonly canonicalExecution: CanonicalExecutionPipelineService;
  private readonly swarmLauncher: SwarmLauncher;

  constructor(options: {
    canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
    swarmLauncher?: SwarmLauncher;
  } = {}) {
    this.canonicalExecution = options.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
    this.swarmLauncher = options.swarmLauncher || new SwarmV2Service();
  }

  public planHierarchy(input: DynamicHierarchyRequest): DynamicHierarchyPlan {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('objective obrigatorio para o swarm hierarquico.');
    }

    const hierarchyId = String(input.hierarchyId || '').trim() || randomUUID();
    const rootRoles = (Array.isArray(input.roles) && input.roles.length > 0
      ? input.roles
      : DEFAULT_ROOT_ROLES
    ).map((role) => ({
      ...role,
      id: String(role.id || '').trim() || `role-${randomUUID().slice(0, 8)}`,
      label: String(role.label || '').trim() || 'Role',
      systemPrompt: String(role.systemPrompt || '').trim() || 'Conduza a sub-missao com foco no objetivo principal.',
    }));
    const maxDepth = Math.max(1, Number(input.maxDepth || 2));
    const maxLeafRoles = Math.max(rootRoles.length, Number(input.maxLeafRoles || 6));
    const complexity = input.complexity || this.deriveComplexity(objective, rootRoles);
    let leafBudget = rootRoles.length;

    const rootNodes = rootRoles.map((role) => this.buildNode({
      role,
      depth: 0,
      parentNodeId: null,
      lineage: [role.label],
    }));

    for (const node of rootNodes) {
      leafBudget = this.expandNode(node, {
        complexity,
        maxDepth,
        maxLeafRoles,
        leafBudget,
      });
    }

    const leafRoles = this.collectLeafRoles(rootNodes);
    const subagentReceipts = this.createPlanReceipts({
      objective,
      hierarchyId,
      leafRoles,
      budgetInput: input.subagentBudget,
    });
    const link = this.canonicalExecution.buildLink({
      engine: 'swarm',
      kind: 'plan',
      status: 'planned',
      id: hierarchyId,
      objective,
      summary: `Dynamic hierarchy plan ready with ${leafRoles.length} leaf role(s).`,
      requestedBy: String(input.requestedBy || '').trim() || 'operator',
      surface: String(input.surface || '').trim() || 'swarm-dynamic-hierarchy',
      traceId: hierarchyId,
      runId: hierarchyId,
      metadata: {
        complexity,
        maxDepth,
        maxLeafRoles,
        rootRoles: rootRoles.map((role) => role.label),
        subagentReceiptCount: subagentReceipts.length,
        subagentReceiptStatuses: subagentReceipts.map((receipt) => ({
          roleId: receipt.roleId,
          status: receipt.status,
          approvalRequired: receipt.approvalBoundary.requiresApproval,
        })),
      },
    });

    return {
      hierarchyId,
      objective,
      complexity,
      maxDepth,
      maxLeafRoles,
      rootNodes,
      leafRoles,
      totalNodes: this.countNodes(rootNodes),
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      execution_lifecycle: link.lifecycle,
      subagentReceipts,
    };
  }

  public launchHierarchy(input: DynamicHierarchyRequest): DynamicHierarchyLaunchResult {
    const plan = this.planHierarchy(input);
    const snapshot = this.swarmLauncher.launchSwarm({
      swarmId: plan.hierarchyId,
      objective: `${plan.objective}\n\n[dynamic-hierarchy:${plan.complexity}]`,
      roles: plan.leafRoles,
      subagentReceipts: plan.subagentReceipts,
      subagentBudget: input.subagentBudget,
    });
    return { plan, snapshot };
  }

  public async launchHierarchyAndWait(input: DynamicHierarchyRequest): Promise<DynamicHierarchyLaunchResult> {
    const launchResult = this.launchHierarchy(input);
    if (!this.swarmLauncher.waitForSwarm) {
      return launchResult;
    }
    const finalSnapshot = await this.swarmLauncher.waitForSwarm(
      launchResult.snapshot.swarmId || launchResult.plan.hierarchyId,
    );
    return {
      plan: launchResult.plan,
      snapshot: finalSnapshot,
    };
  }

  private deriveComplexity(objective: string, roles: SwarmRole[]): DynamicHierarchyComplexity {
    const normalized = objective.toLowerCase();
    const signalCount = [
      /\brefactor\b/,
      /\bmigrate\b/,
      /\bcross-surface\b/,
      /\bwatch mode\b/,
      /\bbrowser\b/,
      /\biot\b/,
      /\bsandbox\b/,
      /\bhousekeeping\b/,
      /\bapproval\b/,
      /\bqa\b/,
    ].filter((pattern) => pattern.test(normalized)).length;

    if (signalCount >= 3 || roles.length >= 4 || normalized.length >= 220) {
      return 'high';
    }
    if (signalCount >= 1 || roles.length >= 3 || normalized.length >= 120) {
      return 'medium';
    }
    return 'low';
  }

  private buildNode(input: {
    role: SwarmRole;
    depth: number;
    parentNodeId: string | null;
    lineage: string[];
  }): DynamicHierarchyRoleNode {
    return {
      nodeId: randomUUID(),
      parentNodeId: input.parentNodeId,
      depth: input.depth,
      roleId: input.role.id,
      label: input.role.label,
      systemPrompt: input.role.systemPrompt,
      lineage: input.lineage,
      children: [],
    };
  }

  private expandNode(
    node: DynamicHierarchyRoleNode,
    context: {
      complexity: DynamicHierarchyComplexity;
      maxDepth: number;
      maxLeafRoles: number;
      leafBudget: number;
    },
  ): number {
    if (node.depth >= context.maxDepth - 1) {
      return context.leafBudget;
    }
    const shouldExpand = node.depth === 0
      ? context.complexity !== 'low'
      : context.complexity === 'high';
    if (!shouldExpand) {
      return context.leafBudget;
    }

    const templates = this.resolveChildTemplates(node);
    const extraLeafSlots = Math.max(0, context.maxLeafRoles - context.leafBudget);
    const childCount = Math.min(templates.length, 1 + extraLeafSlots);
    if (childCount <= 1) {
      return context.leafBudget;
    }

    context.leafBudget += childCount - 1;
    node.children = templates.slice(0, childCount).map((template) => this.buildNode({
      role: {
        id: `${node.roleId}.${template.roleIdSuffix}`,
        label: template.label,
        systemPrompt: `${template.systemPrompt}\n\nContexto pai: ${node.label}.`,
      },
      depth: node.depth + 1,
      parentNodeId: node.nodeId,
      lineage: [...node.lineage, template.label],
    }));

    for (const child of node.children) {
      context.leafBudget = this.expandNode(child, context);
    }

    return context.leafBudget;
  }

  private resolveChildTemplates(node: DynamicHierarchyRoleNode): ChildRoleTemplate[] {
    const label = `${node.roleId} ${node.label}`.toLowerCase();
    if (label.includes('plan')) {
      return [
        {
          roleIdSuffix: 'scope',
          label: 'Scope Scout',
          systemPrompt: 'Descubra subtarefas, dependencias e pontos de integracao para a missao.',
        },
        {
          roleIdSuffix: 'risk',
          label: 'Risk Mapper',
          systemPrompt: 'Mapeie riscos, rollback e gates de aceite antes da execucao.',
        },
      ];
    }
    if (label.includes('implement') || label.includes('coder') || label.includes('patch')) {
      return [
        {
          roleIdSuffix: 'patch',
          label: 'Patch Worker',
          systemPrompt: 'Concentre-se na mudanca principal, mantendo o patch pequeno e explicito.',
        },
        {
          roleIdSuffix: 'integration',
          label: 'Integration Guard',
          systemPrompt: 'Cheque contratos, compatibilidade e impactos cross-surface da mudanca.',
        },
      ];
    }
    if (label.includes('verify') || label.includes('qa') || label.includes('test')) {
      return [
        {
          roleIdSuffix: 'smoke',
          label: 'Smoke Auditor',
          systemPrompt: 'Planeje e confira smokes/fixtures que validam o comportamento final.',
        },
        {
          roleIdSuffix: 'regression',
          label: 'Regression Auditor',
          systemPrompt: 'Busque regressao, risco operacional e lacunas de cobertura.',
        },
      ];
    }
    return [
      {
        roleIdSuffix: 'analysis',
        label: 'Analysis Worker',
        systemPrompt: 'Aprofunde um recorte concreto da missao com foco em clareza e evidencias.',
      },
      {
        roleIdSuffix: 'synthesis',
        label: 'Synthesis Worker',
        systemPrompt: 'Consolide o recorte com foco em proximo passo objetivo e sinal alto.',
      },
    ];
  }

  private collectLeafRoles(nodes: DynamicHierarchyRoleNode[]): SwarmRole[] {
    const leaves: SwarmRole[] = [];
    const visit = (node: DynamicHierarchyRoleNode) => {
      if (node.children.length === 0) {
        leaves.push({
          id: node.roleId,
          label: node.lineage.join(' / '),
          systemPrompt: [
            `Voce representa o ramo: ${node.lineage.join(' -> ')}.`,
            node.systemPrompt,
            'Entregue saida objetiva, sem ruido de shell desnecessario.',
          ].join('\n'),
        });
        return;
      }
      node.children.forEach(visit);
    };
    nodes.forEach(visit);
    return leaves;
  }

  private countNodes(nodes: DynamicHierarchyRoleNode[]): number {
    return nodes.reduce((sum, node) => sum + 1 + this.countNodes(node.children), 0);
  }

  private createPlanReceipts(input: {
    objective: string;
    hierarchyId: string;
    leafRoles: SwarmRole[];
    budgetInput?: SubagentBudgetInput | null;
  }): SubagentResultReceipt[] {
    return input.leafRoles.map((role) => {
      const scope = createSubagentCapabilityScope({
        roleId: role.id,
        mode: 'tool_limited',
        allowedTools: role.command ? [role.command] : ['swarm-session'],
        allowedPaths: [],
        requiresApproval: true,
        metadata: {
          hierarchyId: input.hierarchyId,
          objective: input.objective,
          roleLabel: role.label,
        },
      });
      const budget = createSubagentBudget({
        maxToolCalls: input.budgetInput?.maxToolCalls ?? 0,
        maxWallClockMs: input.budgetInput?.maxWallClockMs ?? 120000,
        maxOutputBytes: input.budgetInput?.maxOutputBytes ?? 65536,
        policyTags: [
          ...(input.budgetInput?.policyTags ?? []),
          'dynamic-hierarchy-subagent-budget',
        ],
        metadata: {
          ...(input.budgetInput?.metadata ?? {}),
          hierarchyId: input.hierarchyId,
          objective: input.objective,
          roleLabel: role.label,
        },
      });
      const approvalBoundary = createSubagentApprovalBoundary({
        scope,
        budget,
        risk: 'attention',
        approvalReason: 'Dynamic hierarchy swarm role requires the existing swarm approval boundary before execution.',
        metadata: {
          hierarchyId: input.hierarchyId,
          objective: input.objective,
          roleLabel: role.label,
        },
      });

      return createSubagentResultReceipt({
        roleId: role.id,
        status: 'planned',
        summary: `Dynamic hierarchy subagent ${role.label} planned for existing SwarmV2 execution.`,
        scope,
        budget,
        approvalBoundary,
        risks: ['approval-boundary-required'],
        policyTags: ['dynamic-hierarchy-subagent-receipt'],
        metadata: {
          hierarchyId: input.hierarchyId,
          objective: input.objective,
          roleLabel: role.label,
        },
      });
    });
  }
}
