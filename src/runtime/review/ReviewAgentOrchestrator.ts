import { AgentTeamCompilerService, type AgentTeamCompilerRoleKind } from '../agent/AgentTeamCompilerService.js';
import type {
  UniversalAgentRun,
  UniversalToolExposureProfile,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  GovernedReviewAgentRole,
  GovernedReviewAgentRuntimePlan,
  GovernedReviewContext,
  GovernedReviewMode,
} from './GovernedReviewTypes.js';

export class ReviewAgentOrchestrator {
  private readonly teamCompiler: AgentTeamCompilerService;
  private readonly now: () => Date;

  constructor(runtime: {
    teamCompiler?: AgentTeamCompilerService;
    now?: () => Date;
  } = {}) {
    this.now = runtime.now || (() => new Date());
    this.teamCompiler = runtime.teamCompiler || new AgentTeamCompilerService({ now: this.now });
  }

  public compile(input: {
    reviewId: string;
    mode: GovernedReviewMode;
    objective: string;
    context: GovernedReviewContext;
    agentPlan: GovernedReviewAgentRole[];
  }): GovernedReviewAgentRuntimePlan {
    const generatedAt = this.now().toISOString();
    const run = this.buildSyntheticRun({ ...input, generatedAt });
    const teamCompiler = this.teamCompiler.buildSnapshot({
      run,
      generatedAt,
    });
    const roleLinks = teamCompiler.roles.map((role) => ({
      reviewRoleId: normalizeReviewRoleId(role.roleId, input.agentPlan),
      compilerRoleId: role.id,
      roleId: role.roleId,
      scopeMode: role.scope.mode,
      approvalRequired: role.approval.required,
      budgetZero: role.budget.maxToolCalls === 0
        && role.budget.maxWallClockMs === 0
        && role.budget.maxOutputBytes === 0,
    }));

    return {
      source: 'ReviewAgentOrchestrator',
      status: teamCompiler.status,
      reviewId: input.reviewId,
      runId: run.id,
      teamCompiler,
      subagentReceipts: teamCompiler.roles.map((role) => role.subagentReceipt),
      roleLinks,
      policy: {
        noSubagentsLaunched: true,
        compilerOnly: true,
        budgetsDefaultToZero: true,
        approvalRequiredBeforeLaunch: true,
        reviewAgentsReadOnly: true,
      },
      nextSafeAction: teamCompiler.nextSafeAction,
    };
  }

  private buildSyntheticRun(input: {
    reviewId: string;
    mode: GovernedReviewMode;
    objective: string;
    context: GovernedReviewContext;
    agentPlan: GovernedReviewAgentRole[];
    generatedAt: string;
  }): UniversalAgentRun {
    const runId = `governed-review:${input.reviewId}`;
    return {
      id: runId,
      traceId: `${runId}:trace`,
      requestId: `${runId}:request`,
      sessionId: `${runId}:session`,
      userId: 'governed-review',
      channel: 'api',
      title: `Governed ${input.mode}`,
      input: `compile multiagente governed review: ${input.objective}`,
      workspace: input.context.workspace,
      status: 'queued',
      createdAt: input.generatedAt,
      updatedAt: input.generatedAt,
      summary: `Read-only governed review team plan for ${input.mode}.`,
      events: [],
      toolExposure: this.buildToolExposure(input.mode),
      replyPorts: [],
      modelProfile: {
        providerLabel: 'local-runtime',
        modelLabel: 'review-agent-orchestrator',
        routingPolicy: 'unknown',
      },
      approvals: [],
      artifacts: [],
      memorySignals: [],
      metadata: {
        governedReview: {
          reviewId: input.reviewId,
          mode: input.mode,
          contextFileCount: input.context.files.length,
          readOnlyPhase: true,
        },
        agentTeamCompiler: {
          source: 'GovernedReviewService',
          requested: true,
          objective: input.objective,
          roles: input.agentPlan.map((role) => ({
            roleId: role.id,
            kind: compilerKindForReviewRole(role),
            label: role.label,
            objective: role.objective,
            toolIds: toolsForReviewRole(role),
            capabilityIds: capabilitiesForReviewRole(role),
          })),
        },
        suggestedSubagents: input.agentPlan.map((role) => role.id),
      },
    };
  }

  private buildToolExposure(mode: GovernedReviewMode): UniversalToolExposureProfile {
    return {
      mode: 'restricted',
      summary: 'Governed review phase 2 exposes read-only planning only; launch requires approval.',
      tools: [
        {
          id: 'workspace.read',
          label: 'Workspace read',
          risk: 'safe',
          requiresApproval: false,
          policyTags: ['governed-review', 'read-only'],
        },
        {
          id: 'runtime.check',
          label: 'Runtime check',
          risk: 'safe',
          requiresApproval: false,
          policyTags: ['governed-review', 'read-only'],
        },
        {
          id: mode === 'security-review' ? 'safety.review' : 'review.plan',
          label: mode === 'security-review' ? 'Safety review' : 'Review planning',
          risk: 'attention',
          requiresApproval: true,
          policyTags: ['governed-review', 'approval-before-launch'],
        },
      ],
      blockedTools: [
        {
          id: 'workspace.write',
          label: 'Workspace write',
          reason: 'Phase 4 compiles and surfaces review output but does not launch mutations.',
        },
        {
          id: 'github.comment',
          label: 'GitHub comment',
          reason: 'External posting requires a later approval-gated phase.',
        },
      ],
    };
  }
}

function compilerKindForReviewRole(role: GovernedReviewAgentRole): AgentTeamCompilerRoleKind {
  switch (role.kind) {
    case 'context':
      return 'researcher';
    case 'security-review':
    case 'policy-review':
      return 'safety-reviewer';
    case 'bug-review':
    case 'regression-review':
    case 'verifier':
    default:
      return 'verifier';
  }
}

function toolsForReviewRole(role: GovernedReviewAgentRole): string[] {
  switch (role.kind) {
    case 'security-review':
      return ['workspace.read', 'safety.review'];
    case 'policy-review':
      return ['workspace.read', 'approval.review'];
    case 'verifier':
      return ['workspace.read', 'runtime.check'];
    case 'context':
    case 'bug-review':
    case 'regression-review':
    default:
      return ['workspace.read'];
  }
}

function capabilitiesForReviewRole(role: GovernedReviewAgentRole): string[] {
  switch (role.kind) {
    case 'security-review':
      return ['safety.narrative', 'tool.exposure.policy'];
    case 'policy-review':
      return ['capability.negotiation', 'approval.review'];
    case 'verifier':
      return ['runtime.validation', 'run.observatory'];
    case 'context':
      return ['run.observatory', 'memory.with.receipts'];
    case 'bug-review':
    case 'regression-review':
    default:
      return ['runtime.validation'];
  }
}

function normalizeReviewRoleId(roleId: string, agentPlan: GovernedReviewAgentRole[]): string {
  return agentPlan.find((role) => role.id === roleId)?.id || roleId;
}
