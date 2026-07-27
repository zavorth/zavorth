import type {
  WorkflowRunActionableStageSnapshot,
  WorkflowRunResumeStageSnapshot,
  WorkflowRunSnapshot,
} from '../WorkflowRunService.js';

export class WorkflowRunStageStateSupport {
  public static syncRunDerivedState(run: WorkflowRunSnapshot): void {
    if (run.operator_state === 'closed') {
      run.resume_stage = null;
      run.actionable_stages = [];
      run.resume_prompt = null;
      if (run.status === 'running' || run.status === 'approval_pending') {
        run.status = 'blocked';
      }
      return;
    }

    run.resume_stage = this.resolveResumeStage(run);
    run.actionable_stages = this.resolveActionableStages(run);
    run.resume_prompt = run.resume_stage ? this.buildResumePrompt(run, run.resume_stage) : null;

    if (run.phases.length > 0 && run.phases.every((entry) => entry.status === 'completed')) {
      run.status = 'completed';
      run.resume_stage = null;
      run.resume_prompt = null;
      return;
    }

    if (run.resume_stage?.status === 'approval_pending') {
      run.status = 'approval_pending';
      return;
    }
    if (run.resume_stage?.status === 'blocked') {
      run.status = 'blocked';
      return;
    }
    if (run.resume_stage?.status === 'failed') {
      run.status = 'failed';
      return;
    }

    run.status = 'running';
  }

  public static resolveResumeStage(run: WorkflowRunSnapshot): WorkflowRunResumeStageSnapshot | null {
    const stage = run.phases.find((entry) => {
      const status = String(entry?.status || '').trim();
      return status === 'approval_pending' || status === 'blocked' || status === 'failed';
    });
    if (!stage) {
      return null;
    }

    return {
      id: stage.id,
      label: stage.label,
      executor: stage.executor,
      strategy_note: stage.strategy_note || null,
      status: stage.status as WorkflowRunResumeStageSnapshot['status'],
      index: Number.isFinite(stage.index) ? Number(stage.index) : 0,
      attempt_count: Math.max(0, Number(stage.attempt_count || 0)),
      task_id: stage.task_id || null,
      objective: stage.objective || null,
      handoff_summary: stage.handoff_summary || null,
      result_summary: stage.result_summary || null,
      reason: this.describeResumeStageReason(stage.status as WorkflowRunResumeStageSnapshot['status']),
    };
  }

  public static resolveStageByDecisionReference(
    run: WorkflowRunSnapshot,
    input: {
      stageId?: string | null;
      taskId?: string | null;
    },
  ): WorkflowRunSnapshot['phases'][number] | null {
    const stageId = String(input.stageId || '').trim();
    if (stageId) {
      const byStageId = run.phases.find((stage) => stage.id === stageId);
      if (byStageId) {
        return byStageId;
      }
    }

    const taskId = String(input.taskId || '').trim();
    if (taskId) {
      const byTaskId = run.phases.find((stage) => String(stage.task_id || '').trim() === taskId);
      if (byTaskId) {
        return byTaskId;
      }
    }

    if (run.resume_stage?.id) {
      return run.phases.find((stage) => stage.id === run.resume_stage?.id) || null;
    }

    return null;
  }

  public static describeResumeStageReason(status: WorkflowRunResumeStageSnapshot['status']): string {
    if (status === 'approval_pending') {
      return 'waits for your confirmation before continuing';
    }
    if (status === 'blocked') {
      return 'was blocked and needs to be unlocked';
    }
    return 'failed e pode ser resumption a partir daqui';
  }

  public static resolveActionableStages(run: WorkflowRunSnapshot): WorkflowRunActionableStageSnapshot[] {
    return run.phases
      .filter((stage) => {
        const status = String(stage?.status || '').trim();
        return status === 'approval_pending'
          || status === 'blocked'
          || status === 'failed'
          || status === 'completed';
      })
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
      .map((stage) => ({
        id: stage.id,
        label: stage.label,
        executor: stage.executor,
        status: stage.status as WorkflowRunActionableStageSnapshot['status'],
        index: Number.isFinite(stage.index) ? Number(stage.index) : 0,
        task_id: stage.task_id || null,
        objective: stage.objective || null,
        handoff_summary: stage.handoff_summary || null,
        result_summary: stage.result_summary || null,
        reason: this.describeActionableStageReason(stage),
        action: this.describeActionableStageAction(stage.status as WorkflowRunActionableStageSnapshot['status']),
      }));
  }

  public static describeActionableStageReason(
    stage: WorkflowRunSnapshot['phases'][number],
  ): string {
    const summary = String(stage?.result_summary || stage?.handoff_summary || stage?.objective || '').trim();
    if (summary) {
      return summary;
    }
    if (stage.status === 'completed') {
      return 'stage completed and ready for rerun';
    }
    return this.describeResumeStageReason(
      stage.status as WorkflowRunResumeStageSnapshot['status'],
    );
  }

  public static describeActionableStageAction(
    status: WorkflowRunActionableStageSnapshot['status'],
  ): WorkflowRunActionableStageSnapshot['action'] {
    if (status === 'approval_pending') {
      return 'continue';
    }
    if (status === 'blocked') {
      return 'unlock';
    }
    if (status === 'failed') {
      return 'retry';
    }
    return 'rerun';
  }

  public static buildResumePrompt(
    run: WorkflowRunSnapshot,
    stage: WorkflowRunResumeStageSnapshot,
  ): string {
    const parts = [
      `Resume workflow ${run.workflow_name} for run ${run.workflow_run_id} at step ${stage.label}.`,
      stage.objective ? `Objective: ${stage.objective}.` : '',
      stage.strategy_note ? `Original strategy: ${stage.strategy_note}.` : '',
      stage.handoff_summary ? `Previous context: ${stage.handoff_summary}.` : '',
      stage.result_summary ? `Current state: ${stage.result_summary}.` : '',
    ].filter(Boolean);
    return parts.join(' ');
  }
}
