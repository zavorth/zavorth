import type {
  SurfaceConsistencyActionContext,
  SurfaceConsistencyReadiness,
} from './SharedSurfaceConsistencyTypes.js';
import {
  buildActionAvailability,
  buildActionSnapshot,
  collectActionableWorkflowStages,
  getWorkflowStageActionVerb,
  type SurfaceConsistencyPrioritizedAction,
} from './SharedSurfaceConsistencyActionSupport.js';

export function pushWorkflowActions(
  actions: SurfaceConsistencyPrioritizedAction[],
  context: SurfaceConsistencyActionContext,
  readiness: SurfaceConsistencyReadiness,
): void {
  const resumableWorkflow = (context.workflowRuns || []).find((run) => {
    return Boolean(
      String(run?.workflow_run_id || '').trim()
      && String(run?.resume_stage?.id || '').trim()
      && String(run?.operator_state || 'active').trim().toLowerCase() !== 'closed',
    );
  }) || null;
  if (!resumableWorkflow) {
    return;
  }

  const workflowRunId = String(resumableWorkflow.workflow_run_id || '').trim();
  const workflowStageId = String(resumableWorkflow.resume_stage?.id || '').trim();
  const workflowStageLabel = String(resumableWorkflow.resume_stage?.label || '').trim();
  const workflowReason = String(resumableWorkflow.resume_stage?.reason || '').trim();
  const workflowName = String(resumableWorkflow.workflow_name || 'workflow').trim();
  const telegramResumeCommand = workflowStageId
    ? `/workflow resume ${workflowRunId} ${workflowStageId}`
    : `/workflow resume ${workflowRunId}`;
  const discordResumeCommand = workflowStageId
    ? `/workflow mode:resume input:${workflowRunId} stage:${workflowStageId}`
    : `/workflow mode:resume input:${workflowRunId}`;

  actions.push({
    priority: 90,
    snapshot: buildActionSnapshot({
      actionId: `resume-workflow:${workflowRunId}:${workflowStageId || 'latest'}`,
      actionType: 'resume-workflow',
      title: workflowStageLabel ? `Retomar ${workflowStageLabel}` : 'Resume workflow',
      description: workflowReason || `Continue ${workflowName} a partir da etapa interrompida.`,
      category: 'workflow',
      availability: buildActionAvailability(
        { mode: 'inline' },
        { mode: 'command' },
        { mode: 'slash' },
        readiness,
      ),
      equivalents: {
        web: {
          mode: 'inline',
          label: workflowStageLabel ? `Retomar ${workflowStageLabel}` : 'Resume workflow',
          value: workflowRunId,
        },
        telegram: {
          mode: 'command',
          label: 'Copiar comando do Telegram',
          value: telegramResumeCommand,
        },
        discord: {
          mode: 'slash',
          label: 'Copiar slash do Discord',
          value: discordResumeCommand,
        },
      },
      context: {
        taskId: null,
        permissionId: null,
        workflowRunId: workflowRunId || null,
        workflowStageId: workflowStageId || null,
        artifactId: null,
        artifactPath: null,
        reason: workflowReason || null,
      },
    }),
  });

  const actionableStages = collectActionableWorkflowStages(resumableWorkflow);
  actionableStages
    .filter((stage) => String(stage.id || '').trim() && String(stage.id || '').trim() !== workflowStageId)
    .forEach((stage, index) => {
      const stageId = String(stage.id || '').trim();
      const stageLabel = String(stage.label || stageId).trim();
      const stageReason = String(stage.reason || '').trim();
      const stageStatus = String(stage.status || '').trim().toLowerCase();
      const stageTaskId = String(stage.task_id || '').trim();
      const isCompletedStage = stageStatus === 'completed';
      const telegramStageCommand = isCompletedStage
        ? `/workflow restart-stage ${workflowRunId} ${stageId}`
        : `/workflow resume ${workflowRunId} ${stageId}`;
      const discordStageCommand = isCompletedStage
        ? `/workflow mode:restart-stage input:${workflowRunId} stage:${stageId}`
        : `/workflow mode:resume input:${workflowRunId} stage:${stageId}`;
      const actionVerb = getWorkflowStageActionVerb(stageStatus);

      actions.push({
        priority: 89 - index,
        snapshot: buildActionSnapshot({
          actionId: `resume-workflow-stage:${workflowRunId}:${stageId}`,
          actionType: isCompletedStage ? 'restart-workflow-stage' : 'resume-workflow',
          title: `${actionVerb} ${stageLabel}`,
          description: stageReason || `Continue ${workflowName} a partir da etapa ${stageLabel}.`,
          category: 'workflow',
          availability: buildActionAvailability(
            { mode: 'inline' },
            { mode: 'command' },
            { mode: 'slash' },
            readiness,
          ),
          equivalents: {
            web: {
              mode: 'inline',
              label: `${actionVerb} ${stageLabel}`,
              value: workflowRunId,
            },
            telegram: {
              mode: 'command',
              label: 'Copiar comando do Telegram',
              value: telegramStageCommand,
            },
            discord: {
              mode: 'slash',
              label: 'Copiar slash do Discord',
              value: discordStageCommand,
            },
          },
          context: {
            taskId: stageTaskId || null,
            permissionId: null,
            workflowRunId: workflowRunId || null,
            workflowStageId: stageId || null,
            artifactId: null,
            artifactPath: null,
            reason: stageReason || null,
          },
        }),
      });
    });

  const workflowStatus = String(resumableWorkflow.status || '').trim().toLowerCase();
  if (workflowStatus === 'blocked' || workflowStatus === 'failed') {
    const closeReason = workflowReason
      || `Encerrar ${workflowName} para ele deixar de aparecer como retomada.`;
    actions.push({
      priority: 70,
      snapshot: buildActionSnapshot({
        actionId: `close-blocked-workflow:${workflowRunId}`,
        actionType: 'close-blocked-workflow',
        title: 'Encerrar workflow',
        description: closeReason,
        category: 'workflow',
        availability: buildActionAvailability(
          { mode: 'inline' },
          { mode: 'command' },
          { mode: 'slash' },
          readiness,
        ),
        equivalents: {
          web: {
            mode: 'inline',
            label: 'Encerrar workflow',
            value: workflowRunId,
          },
          telegram: {
            mode: 'command',
            label: 'Copiar comando do Telegram',
            value: `/workflow close ${workflowRunId}`,
          },
          discord: {
            mode: 'slash',
            label: 'Copiar slash do Discord',
            value: `/workflow mode:close input:${workflowRunId}`,
          },
        },
        context: {
          taskId: null,
          permissionId: null,
          workflowRunId: workflowRunId || null,
          workflowStageId: workflowStageId || null,
          artifactId: null,
          artifactPath: null,
          reason: closeReason || null,
        },
      }),
    });
  }
}
