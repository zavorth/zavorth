import type { CommitPlan } from './CommitPlan.js';

export type CommitExecutorResult = {
  status: 'not_ready' | 'ready_to_commit';
  commitAllowed: boolean;
  reasons: string[];
};

export class CommitExecutor {
  public evaluate(plan: CommitPlan): CommitExecutorResult {
    if (plan.status !== 'ready') {
      return {
        status: 'not_ready',
        commitAllowed: false,
        reasons: [
          `Commit plan is ${plan.status}.`,
          ...plan.blockers,
        ],
      };
    }
    return {
      status: 'ready_to_commit',
      commitAllowed: true,
      reasons: ['Commit plan is ready; caller must still execute through an approved host adapter.'],
    };
  }
}
