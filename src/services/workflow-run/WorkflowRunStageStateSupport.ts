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
    const phase = run.phases.find((entry) => {
      const status = String(entry?.status || '').trim();
      return status === 'approval_pending' || status === 'blocked' || status === 'failed';
    });
    if (!phase) {
      return null;
    }

    return {
      id: phase.id,
      label: phase.label,
      executor: phase.executor,
      strategy_note: phase.strategy_note || null,
      status: phase.status as WorkflowRunResumeStageSnapshot['status'],
      index: Number.isFinite(phase.index) ? Number(phase.index) : 0,
      attempt_count: Math.max(0, Number(phase.attempt_count || 0)),
      task_id: phase.task_id || null,
      objective: phase.objective || null,
      handoff_summary: phase.handoff_summary || null,
      result_summary: phase.result_summary || null,
      reason: this.describeResumeStageReason(phase.status as WorkflowRunResumeStageSnapshot['status']),
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
      const byStageId = run.phases.find((phase) => phase.id === stageId);
      if (byStageId) {
        return byStageId;
      }
    }

    const taskId = String(input.taskId || '').trim();
    if (taskId) {
      const byTaskId = run.phases.find((phase) => String(phase.task_id || '').trim() === taskId);
      if (byTaskId) {
        return byTaskId;
      }
    }

    if (run.resume_stage?.id) {
      return run.phases.find((phase) => phase.id === run.resume_stage?.id) || null;
    }

    return null;
  }

  public static describeResumeStageReason(status: WorkflowRunResumeStageSnapshot['status']): string {
    if (status === 'approval_pending') {
      return 'aguarda sua confirmacao para seguir';
    }
    if (status === 'blocked') {
      return 'foi bloqueada e precisa ser destravada';
    }
    return 'falhou e pode ser retomada a partir daqui';
  }

  public static resolveActionableStages(run: WorkflowRunSnapshot): WorkflowRunActionableStageSnapshot[] {
    return run.phases
      .filter((phase) => {
        const status = String(phase?.status || '').trim();
        return status === 'approval_pending'
          || status === 'blocked'
          || status === 'failed'
          || status === 'completed';
      })
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
      .map((phase) => ({
        id: phase.id,
        label: phase.label,
        executor: phase.executor,
        status: phase.status as WorkflowRunActionableStageSnapshot['status'],
        index: Number.isFinite(phase.index) ? Number(phase.index) : 0,
        task_id: phase.task_id || null,
        objective: phase.objective || null,
        handoff_summary: phase.handoff_summary || null,
        result_summary: phase.result_summary || null,
        reason: this.describeActionableStageReason(phase),
        action: this.describeActionableStageAction(phase.status as WorkflowRunActionableStageSnapshot['status']),
      }));
  }

  public static describeActionableStageReason(
    phase: WorkflowRunSnapshot['phases'][number],
  ): string {
    const summary = String(phase?.result_summary || phase?.handoff_summary || phase?.objective || '').trim();
    if (summary) {
      return summary;
    }
    if (phase.status === 'completed') {
      return 'etapa concluida e pronta para reexecutao';
    }
    return this.describeResumeStageReason(
      phase.status as WorkflowRunResumeStageSnapshot['status'],
    );
  }

  public static describeActionableStageAction(
    status: WorkflowRunActionableStageSnapshot['status'],
  ): WorkflowRunActionableStageSnapshot['action'] {
    if (status === 'approval_pending') {
      return 'continue';
    }
    if (status === 'blocked') {
      return 'destravar';
    }
    if (status === 'failed') {
      return 'refazer';
    }
    return 'reexecutar';
  }

  public static buildResumePrompt(
    run: WorkflowRunSnapshot,
    phase: WorkflowRunResumeStageSnapshot,
  ): string {
    const parts = [
      `Retome o workflow ${run.workflow_name} no run ${run.workflow_run_id} pela etapa ${phase.label}.`,
      phase.objective ? `Objetivo: ${phase.objective}.` : '',
      phase.strategy_note ? `Estrategia original: ${phase.strategy_note}.` : '',
      phase.handoff_summary ? `Contexto anterior: ${phase.handoff_summary}.` : '',
      phase.result_summary ? `Estado atual: ${phase.result_summary}.` : '',
    ].filter(Boolean);
    return parts.join(' ');
  }
}
