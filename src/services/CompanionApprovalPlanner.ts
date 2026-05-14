import type {
  CompanionActionId,
  CompanionActionPlan,
  CompanionDescriptor,
  CompanionId,
} from '../contracts/CompanionControlContract.js';

type CompanionApprovalPlannerRuntime = {
  now?: () => Date;
};

export class CompanionApprovalPlanner {
  private readonly now: () => Date;

  constructor(runtime: CompanionApprovalPlannerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public plan(input: {
    companionId: CompanionId;
    actionId: CompanionActionId;
    companion: CompanionDescriptor;
    dryRun?: boolean;
  }): CompanionActionPlan {
    const action = input.companion.actions.find((entry) => entry.actionId === input.actionId);

    if (!action) {
      return {
        generatedAt: this.now().toISOString(),
        companionId: input.companionId,
        actionId: input.actionId,
        ok: false,
        allowed: false,
        requiresApproval: false,
        safety: 'approval-required',
        executed: false,
        dryRun: input.dryRun === true,
        summary: `A acao ${input.actionId} nao esta disponivel para ${input.companion.label}.`,
        reason: 'Acao nao suportada neste companion.',
        command: null,
        companion: input.companion,
        resourceImpact: null,
      };
    }

    return {
      generatedAt: this.now().toISOString(),
      companionId: input.companionId,
      actionId: input.actionId,
      ok: action.available,
      allowed: action.available,
      requiresApproval: action.requiresApproval,
      safety: action.safety,
      executed: false,
      dryRun: input.dryRun === true,
      summary: action.description,
      reason: action.reason,
      command: action.command,
      companion: input.companion,
      resourceImpact: null,
    };
  }
}
