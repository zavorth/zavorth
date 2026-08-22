import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  type SubagentResultReceipt,
} from './subagents/index.js';

export type ExecutionEscalationTarget =
  | 'none'
  | 'graph_runtime'
  | 'swarm'
  | 'mode_escalation'
  | 'manual_review';

export type ExecutionEscalationSource =
  | 'none'
  | 'structured'
  | 'complex_objective'
  | 'mode_escalation_request';

export type ExecutionEscalationReason =
  | 'none'
  | 'structured-target'
  | 'graph-runtime-required'
  | 'swarm-requested'
  | 'complex-objective-swarm'
  | 'mode-escalation-pending';

export type ExecutionEscalationAction = {
  type?: string | null;
  payload?: unknown;
  metadata?: Record<string, unknown>;
};

export type ExecutionEscalationModeRequest = {
  id?: string | null;
  requiredMode?: unknown;
  reason?: string | null;
  summary?: string | null;
};

export type ExecutionEscalationInput = {
  responseText?: string | null;
  mode?: string | null;
  action?: ExecutionEscalationAction | null;
  target?: string | null;
  requestedTarget?: string | null;
  taskGoal?: string | null;
  payload?: string | null;
  requiresGraphRuntime?: boolean | null;
  complexObjective?: boolean | null;
  suggestedSubagents?: readonly string[] | null;
  requiresApproval?: boolean | null;
  modeEscalationRequest?: ExecutionEscalationModeRequest | null;
  metadata?: Record<string, unknown>;
};

export type ExecutionEscalationDecision = {
  shouldEscalate: boolean;
  target: ExecutionEscalationTarget;
  source: ExecutionEscalationSource;
  reason: ExecutionEscalationReason;
  taskGoal: string | null;
  requiresApproval: boolean;
  summary: string;
  policyTags: string[];
  subagentReceipts: SubagentResultReceipt[];
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}


function normalizeTarget(value: unknown): ExecutionEscalationTarget | null {
  const normalized = normalizeText(value).toLowerCase().replace(/-/g, '_');
  if (!normalized) {
    return null;
  }
  if (normalized === 'graph' || normalized === 'graph_runtime') {
    return 'graph_runtime';
  }
  if (normalized === 'swarm' || normalized === 'subagents' || normalized === 'sub_agents') {
    return 'swarm';
  }
  if (normalized === 'mode_escalation' || normalized === 'mode') {
    return 'mode_escalation';
  }
  if (normalized === 'manual_review' || normalized === 'operator_review' || normalized === 'human_review') {
    return 'manual_review';
  }
  if (normalized === 'none') {
    return 'none';
  }
  return null;
}

function structuredReasonForTarget(target: ExecutionEscalationTarget): ExecutionEscalationReason {
  if (target === 'graph_runtime') {
    return 'graph-runtime-required';
  }
  if (target === 'swarm') {
    return 'swarm-requested';
  }
  return 'structured-target';
}

function firstBoolean(...values: Array<boolean | null | undefined>): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return null;
}

function policyTags(decision: Pick<
  ExecutionEscalationDecision,
  'shouldEscalate' | 'target' | 'source' | 'reason' | 'taskGoal' | 'requiresApproval'
>): string[] {
  return [
    `escalation:${decision.target}`,
    `source:${decision.source}`,
    `reason:${decision.reason}`,
    decision.shouldEscalate ? 'should-escalate' : 'stay-in-agent-run',
    decision.requiresApproval ? 'approval-required' : 'approval-not-required',
    decision.taskGoal ? 'task-goal-present' : 'task-goal-absent',
  ];
}

type BuildDecisionInput = {
  target: ExecutionEscalationTarget;
  source: ExecutionEscalationSource;
  reason: ExecutionEscalationReason;
  taskGoal?: string | null;
  requiresApproval?: boolean | null;
  input: ExecutionEscalationInput;
  modeEscalationRequestId?: string | null;
  subagentReceipts?: SubagentResultReceipt[];
};

export class ExecutionEscalationPolicy {
  public resolve(input: ExecutionEscalationInput = {}): ExecutionEscalationDecision {
    const modeEscalationRequestId = normalizeText(input.modeEscalationRequest?.id) || null;
    if (modeEscalationRequestId) {
      return this.buildDecision({
        target: 'mode_escalation',
        source: 'mode_escalation_request',
        reason: 'mode-escalation-pending',
        taskGoal: normalizeText(input.modeEscalationRequest?.summary, normalizeText(input.modeEscalationRequest?.reason)) || null,
        requiresApproval: true,
        input,
        modeEscalationRequestId,
      });
    }

    const explicitTarget = normalizeTarget(input.target) || normalizeTarget(input.requestedTarget);
    if (explicitTarget && explicitTarget !== 'none') {
      return this.buildDecision({
        target: explicitTarget,
        source: 'structured',
        reason: structuredReasonForTarget(explicitTarget),
        taskGoal: normalizeText(input.taskGoal, normalizeText(input.payload)) || null,
        input,
        subagentReceipts:
          explicitTarget === 'swarm'
            ? this.buildSwarmProposalReceipts(
                input,
                normalizeText(input.taskGoal, normalizeText(input.payload)) || null,
              )
            : [],
      });
    }

    if (input.requiresGraphRuntime) {
      return this.buildDecision({
        target: 'graph_runtime',
        source: 'structured',
        reason: 'graph-runtime-required',
        taskGoal: normalizeText(input.taskGoal, normalizeText(input.payload)) || null,
        input,
      });
    }

    if (input.complexObjective) {
      const taskGoal =
        normalizeText(input.taskGoal, normalizeText(input.payload, normalizeText(input.responseText))) ||
        null;

      return this.buildDecision({
        target: 'swarm',
        source: 'complex_objective',
        reason: 'complex-objective-swarm',
        taskGoal,
        requiresApproval: true,
        input,
        subagentReceipts: this.buildSwarmProposalReceipts(input, taskGoal),
      });
    }

    return this.buildDecision({
      target: 'none',
      source: 'none',
      reason: 'none',
      taskGoal: null,
      input,
    });
  }

  private buildDecision(options: BuildDecisionInput): ExecutionEscalationDecision {
    const shouldEscalate = options.target !== 'none';
    const requestedApproval = firstBoolean(
      options.requiresApproval,
      options.input.requiresApproval,
    );
    const requiresApproval =
      options.target === 'swarm'
        ? true
        : requestedApproval ?? (options.target === 'mode_escalation' || options.target === 'manual_review');
    const taskGoal = normalizeText(options.taskGoal) || null;
    const subagentReceipts = options.subagentReceipts ?? [];
    const core = {
      shouldEscalate,
      target: options.target,
      source: options.source,
      reason: options.reason,
      taskGoal,
      requiresApproval,
      summary: shouldEscalate ? `Escalaction estruturada para ${options.target}: ${options.reason}.`
        : `No execution escalation: ${options.reason}.`,
      subagentReceipts,
    };

    return {
      ...core,
      policyTags: [
        ...policyTags(core),
        ...(subagentReceipts.length > 0 ? ['subagent-receipts-present'] : ['subagent-receipts-absent']),
      ],
      metadata: {
        ...(options.input.metadata || {}),
        source: 'ExecutionEscalationPolicy',
        structuredEscalationDecision: true,
        swarmProposal: options.target === 'swarm',
        subagentContractsApplied: subagentReceipts.length > 0,
        graphRuntimeServiceCalled: false,
        approvalGateReplaced: false,
        canonicalEscalationPath: 'structured-policy',
        modeEscalationRequestId: options.modeEscalationRequestId || null,
        requiredMode: normalizeText(options.input.modeEscalationRequest?.requiredMode) || null,
      },
    };
  }

  private buildSwarmProposalReceipts(
    input: ExecutionEscalationInput,
    taskGoal: string | null,
  ): SubagentResultReceipt[] {
    const roleIds = normalizeList(input.suggestedSubagents);
    const proposedRoles = roleIds.length > 0 ? roleIds : ['planner', 'implementer', 'verifier'];

    return proposedRoles.map((roleId) => {
      const scope = createSubagentCapabilityScope({
        roleId,
        mode: 'blocked',
        requiresApproval: true,
        metadata: {
          proposedBy: 'ExecutionEscalationPolicy',
          taskGoal,
        },
      });
      const budget = createSubagentBudget({
        maxToolCalls: 0,
        maxWallClockMs: 0,
        maxOutputBytes: 0,
        metadata: {
          proposedBy: 'ExecutionEscalationPolicy',
          taskGoal,
        },
      });
      const approvalBoundary = createSubagentApprovalBoundary({
        scope,
        budget,
        risk: 'attention',
        approvalReason: 'Swarm proposal requires approval before subagent execution.',
        metadata: {
          proposedBy: 'ExecutionEscalationPolicy',
          taskGoal,
        },
      });

      return createSubagentResultReceipt({
        roleId,
        status: 'planned',
        summary: `Subagent ${roleId} is proposed for swarm escalation and remains blocked until approval.`,
        scope,
        budget,
        approvalBoundary,
        metadata: {
          proposedBy: 'ExecutionEscalationPolicy',
          taskGoal,
          target: 'swarm',
        },
      });
    });
  }
}

function normalizeList(values?: readonly string[] | null): string[] {
  return Array.from(new Set((values ?? []).map((value) => normalizeText(value)).filter(Boolean))).sort();
}
