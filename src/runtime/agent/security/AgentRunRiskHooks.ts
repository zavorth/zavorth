import type {
  UniversalAgentRun,
  UniversalToolExposure,
  UniversalToolRiskLevel,
} from '../UniversalAgentRuntimeTypes.js';

export type AgentRunRiskReviewStage =
  | 'pre-executor'
  | 'post-executor'
  | 'resume'
  | 'cancelled'
  | 'interrupted';

export type AgentRunRiskReview = {
  source: 'AgentRunRiskHooks';
  stage: AgentRunRiskReviewStage;
  phase: AgentRunRiskReviewStage;
  risk: UniversalToolRiskLevel;
  blocked: boolean;
  requiresApproval: boolean;
  toolIds: string[];
  approvalRequiredToolIds: string[];
  policyTags: string[];
  summary: string;
};

export class AgentRunRiskHooks {
  public review(input: {
    run: UniversalAgentRun;
    phase: AgentRunRiskReviewStage;
  }): AgentRunRiskReview {
    const tools = input.run.toolExposure.tools || [];
    const approvalTools = tools.filter((tool) => tool.requiresApproval);
    const sensitiveTools = tools.filter((tool) =>
      tool.requiresApproval || tool.risk === 'danger' || tool.risk === 'attention');
    const risk = this.resolveRisk(sensitiveTools);
    const blocked = input.phase === 'pre-executor' && approvalTools.length > 0;
    const toolIds = sensitiveTools.map((tool) => tool.id);
    const approvalRequiredToolIds = approvalTools.map((tool) => tool.id);
    return {
      source: 'AgentRunRiskHooks',
      stage: input.phase,
      phase: input.phase,
      risk,
      blocked,
      requiresApproval: approvalTools.length > 0,
      toolIds,
      approvalRequiredToolIds,
      policyTags: this.collectPolicyTags(sensitiveTools),
      summary: this.buildSummary(input.phase, risk, blocked, toolIds, approvalRequiredToolIds),
    };
  }

  private resolveRisk(tools: UniversalToolExposure[]): UniversalToolRiskLevel {
    if (tools.some((tool) => tool.risk === 'danger')) {
      return 'danger';
    }
    if (tools.some((tool) => tool.risk === 'attention')) {
      return 'attention';
    }
    return tools.length > 0 ? 'safe' : 'safe';
  }

  private collectPolicyTags(tools: UniversalToolExposure[]): string[] {
    return Array.from(new Set(
      tools.flatMap((tool) => tool.policyTags || [])
        .map((tag) => String(tag || '').trim())
        .filter(Boolean),
    ));
  }

  private buildSummary(
    phase: AgentRunRiskReviewStage,
    risk: UniversalToolRiskLevel,
    blocked: boolean,
    toolIds: string[],
    approvalRequiredToolIds: string[],
  ): string {
    if (blocked) {
      return `Risk review ${phase}: ${approvalRequiredToolIds.length} tool(s) require approval before the executor.`;
    }
    if (toolIds.length > 0) {
      return `Risk review ${phase}: ${toolIds.length} sensitive tool(s) reviewed with risk ${risk}.`;
    }
    return `Risk review ${phase}: no sensitive tool exposed.`;
  }
}
