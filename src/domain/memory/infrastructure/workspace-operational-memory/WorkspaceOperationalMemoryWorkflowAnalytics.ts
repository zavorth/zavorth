import {
  WorkflowRunService,
  type WorkflowKind,
} from '../../../../runtime/workflows/WorkflowRunService.js';
import type {
  RecentWorkflowRunAggregate,
  WorkflowExecutorRecommendationAggregate,
  WorkflowFrictionRecommendationAggregate,
  WorkflowRecommendationAggregate,
  WorkflowStageExecutorRecommendationAggregate,
} from './WorkspaceOperationalMemoryTypes.js';

export class WorkspaceOperationalMemoryWorkflowAnalytics {
  constructor(
    private readonly workflowRunService: Pick<WorkflowRunService, 'listRuns'> = new WorkflowRunService(),
  ) {}

  public collectRecentWorkflowRuns(workspace: string): RecentWorkflowRunAggregate[] {
    const runs = this.workflowRunService.listRuns({
      workspace,
      limit: 8,
    });

    return runs.map((run) => {
      const recentCheckpoints = Array.isArray(run.externalized_state?.recent_checkpoints)
        ? run.externalized_state?.recent_checkpoints
        : [];
      const interruptionCount = recentCheckpoints.filter((checkpoint) => checkpoint?.event === 'stage_interrupted').length;
      const latestInterruptedStageId = String(
        recentCheckpoints.find((checkpoint) => checkpoint?.event === 'stage_interrupted')?.resume_stage_id || '',
      ).trim() || null;
      const latestInterruptedStageLabel = latestInterruptedStageId
        ? (run.phases.find((stage) => stage.id === latestInterruptedStageId)?.label || null)
        : (String(run.resume_stage?.label || '').trim() || null);
      const recoveredFromInterruption = run.status === 'completed' && interruptionCount > 0;

      return {
        workflow_run_id: run.workflow_run_id,
        workflow_name: run.workflow_name,
        status: run.status,
        operator_state: run.operator_state,
        operator_close_reason: run.operator_close_reason,
        completed_stages: run.phases.filter((stage) => stage.status === 'completed').length,
        total_stages: run.phases.length,
        primary_artifact_name:
          typeof run.artifacts_manifest?.primary_artifact_name === 'string'
            ? run.artifacts_manifest.primary_artifact_name
            : null,
        resume_stage_label: String(run.resume_stage?.label || '').trim() || null,
        resume_stage_status: run.resume_stage?.status || null,
        resume_stage_reason: String(run.resume_stage?.reason || '').trim() || null,
        interruption_count: interruptionCount,
        recovered_from_interruption: recoveredFromInterruption,
        last_interrupted_stage_label: latestInterruptedStageLabel,
        recent_checkpoint_events: recentCheckpoints
          .map((checkpoint) => String(checkpoint?.event || '').trim())
          .filter((event): event is string => Boolean(event)),
        updated_at: run.updated_at,
        stage_executors: run.phases.map((stage) => ({
          executor: stage.executor,
          role: stage.role,
          status: stage.status,
          attempt_count: Number(stage.attempt_count || 0),
        })),
      };
    });
  }

  public buildWorkflowRecommendations(runs: RecentWorkflowRunAggregate[]): WorkflowRecommendationAggregate[] {
    const buckets = new Map<WorkflowKind, {
      workflow: WorkflowKind;
      success_count: number;
      pending_count: number;
      failed_count: number;
      recovered_count: number;
      last_recovered_stage_label: string | null;
      last_seen_at: string;
    }>();

    for (const run of runs) {
      const existing = buckets.get(run.workflow_name) || {
        workflow: run.workflow_name,
        success_count: 0,
        pending_count: 0,
        failed_count: 0,
        recovered_count: 0,
        last_recovered_stage_label: null,
        last_seen_at: run.updated_at,
      };

      if (run.status === 'completed') {
        existing.success_count += 1;
      } else if (run.status === 'running' || run.status === 'approval_pending' || run.status === 'blocked') {
        existing.pending_count += 1;
      } else {
        existing.failed_count += 1;
      }

      if (run.updated_at > existing.last_seen_at) {
        existing.last_seen_at = run.updated_at;
      }
      if (run.recovered_from_interruption) {
        existing.recovered_count += 1;
        if (String(run.last_interrupted_stage_label || '').trim()) {
          existing.last_recovered_stage_label = String(run.last_interrupted_stage_label || '').trim();
        }
      }

      buckets.set(run.workflow_name, existing);
    }

    return Array.from(buckets.values())
      .map((bucket) => {
        const total = bucket.success_count + bucket.pending_count + bucket.failed_count;
        const confidence = total >= 3 ? 'high' : total >= 2 ? 'medium' : 'low';
        const resumableStage = runs.find((run) => {
          return run.workflow_name === bucket.workflow && String(run.resume_stage_label || '').trim();
        }) || null;
        const rationale =
          bucket.pending_count > 0
            ? `${bucket.pending_count} recent run(s) for this workflow are still open.${resumableStage?.resume_stage_label ? ` Most sensitive step now: ${resumableStage.resume_stage_label}.` : ''}`
            : `${bucket.success_count} run(s) recente(s) deste workflow concluiram bem in this workspace.${bucket.recovered_count > 0 ? ` ${bucket.recovered_count} recovery(oes) recente(s) closed successfully${bucket.last_recovered_stage_label ? ` after de ${bucket.last_recovered_stage_label}` : ''}.` : ''}`;

        return {
          workflow: bucket.workflow,
          success_count: bucket.success_count,
          pending_count: bucket.pending_count,
          failed_count: bucket.failed_count,
          recovered_count: bucket.recovered_count,
          last_recovered_stage_label: bucket.last_recovered_stage_label,
          last_seen_at: bucket.last_seen_at,
          confidence,
          rationale,
        } satisfies WorkflowRecommendationAggregate;
      })
      .sort((left, right) => {
        const leftWeight = left.pending_count * 3 + left.success_count * 2 + left.recovered_count - left.failed_count;
        const rightWeight = right.pending_count * 3 + right.success_count * 2 + right.recovered_count - right.failed_count;
        return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
      })
      .slice(0, 5);
  }

  public buildWorkflowFrictionRecommendations(
    runs: RecentWorkflowRunAggregate[],
  ): WorkflowFrictionRecommendationAggregate[] {
    const buckets = new Map<WorkflowKind, {
      workflow: WorkflowKind;
      approval_pending_count: number;
      blocked_count: number;
      failed_count: number;
      recovered_count: number;
      last_resume_stage_label: string | null;
      last_recovered_stage_label: string | null;
      last_seen_at: string;
    }>();

    for (const run of runs) {
      const existing = buckets.get(run.workflow_name) || {
        workflow: run.workflow_name,
        approval_pending_count: 0,
        blocked_count: 0,
        failed_count: 0,
        recovered_count: 0,
        last_resume_stage_label: null,
        last_recovered_stage_label: null,
        last_seen_at: run.updated_at,
      };

      if (run.recovered_from_interruption) {
        existing.recovered_count += 1;
        if (String(run.last_interrupted_stage_label || '').trim()) {
          existing.last_recovered_stage_label = String(run.last_interrupted_stage_label || '').trim();
        }
      }

      if (!['approval_pending', 'blocked', 'failed'].includes(run.status)) {
        buckets.set(run.workflow_name, existing);
        continue;
      }

      if (run.status === 'approval_pending') {
        existing.approval_pending_count += 1;
      } else if (run.status === 'blocked') {
        existing.blocked_count += 1;
      } else {
        existing.failed_count += 1;
      }

      if (run.updated_at >= existing.last_seen_at) {
        existing.last_seen_at = run.updated_at;
        existing.last_resume_stage_label = String(run.resume_stage_label || '').trim() || existing.last_resume_stage_label;
      }

      buckets.set(run.workflow_name, existing);
    }

    return Array.from(buckets.values())
      .filter((bucket) => bucket.approval_pending_count > 0 || bucket.blocked_count > 0 || bucket.failed_count > 0)
      .map((bucket) => {
        const weight = Math.max(
          0,
          bucket.failed_count * 3 + bucket.blocked_count * 2 + bucket.approval_pending_count * 2 - bucket.recovered_count,
        );
        const confidence = weight >= 5 ? 'high' : weight >= 3 ? 'medium' : 'low';
        const detailParts = [
          bucket.failed_count ? `${bucket.failed_count} failure(s)` : null,
          bucket.blocked_count ? `${bucket.blocked_count} block(s)` : null,
          bucket.approval_pending_count ? `${bucket.approval_pending_count} pause(s) waiting for confirmation` : null,
          bucket.last_resume_stage_label ? `stage critical ${bucket.last_resume_stage_label}` : null,
          bucket.recovered_count ? `${bucket.recovered_count} recovery(oes) completed(s)${bucket.last_recovered_stage_label ? ` via ${bucket.last_recovered_stage_label}` : ''}` : null,
        ].filter(Boolean);

        return {
          workflow: bucket.workflow,
          approval_pending_count: bucket.approval_pending_count,
          blocked_count: bucket.blocked_count,
          failed_count: bucket.failed_count,
          recovered_count: bucket.recovered_count,
          last_resume_stage_label: bucket.last_resume_stage_label,
          last_recovered_stage_label: bucket.last_recovered_stage_label,
          last_seen_at: bucket.last_seen_at,
          confidence,
          rationale: detailParts.join(', '),
        } satisfies WorkflowFrictionRecommendationAggregate;
      })
      .sort((left, right) => {
        const leftWeight = left.failed_count * 3 + left.blocked_count * 2 + left.approval_pending_count * 2 - left.recovered_count;
        const rightWeight = right.failed_count * 3 + right.blocked_count * 2 + right.approval_pending_count * 2 - right.recovered_count;
        return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
      })
      .slice(0, 5);
  }

  public buildWorkflowExecutorRecommendations(
    runs: RecentWorkflowRunAggregate[],
  ): WorkflowExecutorRecommendationAggregate[] {
    const buckets = new Map<string, {
      workflow: WorkflowKind;
      executor: string;
      success_count: number;
      recovered_count: number;
      pending_count: number;
      failed_count: number;
      last_seen_at: string;
    }>();

    for (const run of runs) {
      for (const stage of Array.isArray(run.stage_executors) ? run.stage_executors : []) {
        const executor = String(stage.executor || '').trim().toLowerCase();
        if (!executor) {
          continue;
        }

        const key = `${run.workflow_name}::${executor}`;
        const existing = buckets.get(key) || {
          workflow: run.workflow_name,
          executor,
          success_count: 0,
          recovered_count: 0,
          pending_count: 0,
          failed_count: 0,
          last_seen_at: run.updated_at,
        };

        if (stage.status === 'completed') {
          existing.success_count += 1;
          if (Number(stage.attempt_count || 0) > 1) {
            existing.recovered_count += 1;
          }
        } else if (stage.status === 'running' || stage.status === 'approval_pending' || stage.status === 'blocked') {
          existing.pending_count += 1;
        } else {
          existing.failed_count += 1;
        }

        if (run.updated_at > existing.last_seen_at) {
          existing.last_seen_at = run.updated_at;
        }

        buckets.set(key, existing);
      }
    }

    return Array.from(buckets.values())
      .map((bucket) => {
        const total = bucket.success_count + bucket.pending_count + bucket.failed_count;
        const confidence = total >= 4 ? 'high' : total >= 2 ? 'medium' : 'low';
        const rationale =
          bucket.pending_count > bucket.success_count ? `${bucket.executor} ainda sustenta ${bucket.pending_count} stage(s) recente(s) de ${bucket.workflow} in aberto.`
            : `${bucket.executor} completed ${bucket.success_count} stage(s) recente(s) de ${bucket.workflow} in this workspace.${bucket.recovered_count > 0 ? ` ${bucket.recovered_count} resumption(s) also closed successfully.` : ''}`;

        return {
          workflow: bucket.workflow,
          executor: bucket.executor,
          success_count: bucket.success_count,
          recovered_count: bucket.recovered_count,
          pending_count: bucket.pending_count,
          failed_count: bucket.failed_count,
          last_seen_at: bucket.last_seen_at,
          confidence,
          rationale,
        } satisfies WorkflowExecutorRecommendationAggregate;
      })
      .sort((left, right) => {
        const leftWeight = left.success_count * 3 + left.recovered_count * 2 + left.pending_count - left.failed_count * 2;
        const rightWeight = right.success_count * 3 + right.recovered_count * 2 + right.pending_count - right.failed_count * 2;
        return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
      })
      .slice(0, 6);
  }

  public buildWorkflowStageExecutorRecommendations(
    runs: RecentWorkflowRunAggregate[],
  ): WorkflowStageExecutorRecommendationAggregate[] {
    const buckets = new Map<string, {
      workflow: WorkflowKind;
      role: string;
      executor: string;
      success_count: number;
      recovered_count: number;
      pending_count: number;
      failed_count: number;
      last_seen_at: string;
    }>();

    for (const run of runs) {
      for (const stage of Array.isArray(run.stage_executors) ? run.stage_executors : []) {
        const executor = String(stage.executor || '').trim().toLowerCase();
        const role = String(stage.role || '').trim().toLowerCase();
        if (!executor || !role) {
          continue;
        }

        const key = `${run.workflow_name}::${role}::${executor}`;
        const existing = buckets.get(key) || {
          workflow: run.workflow_name,
          role,
          executor,
          success_count: 0,
          recovered_count: 0,
          pending_count: 0,
          failed_count: 0,
          last_seen_at: run.updated_at,
        };

        if (stage.status === 'completed') {
          existing.success_count += 1;
          if (Number(stage.attempt_count || 0) > 1) {
            existing.recovered_count += 1;
          }
        } else if (stage.status === 'running' || stage.status === 'approval_pending' || stage.status === 'blocked') {
          existing.pending_count += 1;
        } else {
          existing.failed_count += 1;
        }

        if (run.updated_at > existing.last_seen_at) {
          existing.last_seen_at = run.updated_at;
        }

        buckets.set(key, existing);
      }
    }

    return Array.from(buckets.values())
      .map((bucket) => {
        const total = bucket.success_count + bucket.pending_count + bucket.failed_count;
        const confidence = total >= 4 ? 'high' : total >= 2 ? 'medium' : 'low';
        const rationale =
          bucket.pending_count > bucket.success_count ? `${bucket.executor} ainda sustenta ${bucket.pending_count} stage(s) recente(s) de ${bucket.workflow}/${bucket.role} in aberto.`
            : `${bucket.executor} completed ${bucket.success_count} stage(s) recente(s) de ${bucket.workflow}/${bucket.role} in this workspace.${bucket.recovered_count > 0 ? ` ${bucket.recovered_count} resumption(s) in this stage also closed successfully.` : ''}`;

        return {
          workflow: bucket.workflow,
          role: bucket.role,
          executor: bucket.executor,
          success_count: bucket.success_count,
          recovered_count: bucket.recovered_count,
          pending_count: bucket.pending_count,
          failed_count: bucket.failed_count,
          last_seen_at: bucket.last_seen_at,
          confidence,
          rationale,
        } satisfies WorkflowStageExecutorRecommendationAggregate;
      })
      .sort((left, right) => {
        const leftWeight = left.success_count * 4 + left.recovered_count * 2 + left.pending_count - left.failed_count * 2;
        const rightWeight = right.success_count * 4 + right.recovered_count * 2 + right.pending_count - right.failed_count * 2;
        return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
      })
      .slice(0, 8);
  }
}
