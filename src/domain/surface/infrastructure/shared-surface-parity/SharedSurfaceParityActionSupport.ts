import type {
  SurfaceParityActionContextContinuity,
  SurfaceParityActionContextTask,
  SurfaceParityActionContextWorkflow,
  SurfaceParityActionSnapshot,
  SurfaceParityLatestArtifact,
  SurfaceParityReadiness,
  SurfaceParitySurfaceActionSnapshot,
  SurfaceParityWorkflowStage,
} from './SharedSurfaceParityTypes.js';

export type SurfaceParityPrioritizedAction = {
  priority: number;
  snapshot: SurfaceParityActionSnapshot | null;
};

export function buildActionSnapshot(
  snapshot: SurfaceParityActionSnapshot,
): SurfaceParityActionSnapshot {
  return snapshot;
}

export function buildActionAvailability(
  web: Pick<SurfaceParitySurfaceActionSnapshot, 'mode'>,
  telegram: Pick<SurfaceParitySurfaceActionSnapshot, 'mode'>,
  discord: Pick<SurfaceParitySurfaceActionSnapshot, 'mode'>,
  readiness: SurfaceParityReadiness,
): SurfaceParityActionSnapshot['availability'] {
  return {
    web: readiness.webReady && web.mode !== 'hidden' ? 'ready' : 'pending',
    telegram: readiness.telegramReady && telegram.mode !== 'hidden' ? 'ready' : 'pending',
    discord: discord.mode === 'slash' ? 'slash' : 'hidden',
  };
}

export function findLatestArtifact(
  tasks: SurfaceParityActionContextTask[],
  continuity?: SurfaceParityActionContextContinuity | null,
): SurfaceParityLatestArtifact | null {
  for (const task of tasks) {
    const taskId = String(task?.task_id || '').trim();
    const artifacts = Array.isArray(task?.artifacts) ? task.artifacts : [];
    const latestArtifact = artifacts.find((artifact) => Boolean(String(artifact?.id || '').trim()));
    if (!taskId || !latestArtifact) {
      continue;
    }
    return {
      taskId,
      artifactId: String(latestArtifact.id || '').trim(),
      path: String(latestArtifact.path || '').trim() || null,
      name: String(latestArtifact.name || '').trim() || null,
      summary: String(latestArtifact.summary || '').trim() || null,
    };
  }

  const recentArtifact = continuity?.workspaceContext?.recentArtifact;
  if (recentArtifact && typeof recentArtifact === 'object') {
    const taskId = String(
      recentArtifact.taskId
      || continuity?.focusTask?.taskId
      || continuity?.latestTelegramTask?.taskId
      || 'continuity',
    ).trim();
    const path = String(recentArtifact.path || '').trim() || null;
    const name = String(recentArtifact.name || '').trim() || null;
    if (taskId && (path || name)) {
      return {
        taskId,
        artifactId: path || name || taskId,
        path,
        name,
        summary: name || path,
      };
    }
  }

  return null;
}

export function collectActionableWorkflowStages(
  run: SurfaceParityActionContextWorkflow,
): SurfaceParityWorkflowStage[] {
  if (String(run?.operator_state || 'active').trim().toLowerCase() === 'closed') {
    return [];
  }

  const explicit = Array.isArray(run?.actionable_stages) ? run.actionable_stages : [];
  const explicitStages = explicit
    .map((stage) => ({
      id: String(stage?.id || '').trim(),
      label: String(stage?.label || stage?.id || '').trim(),
      status: String(stage?.status || '').trim().toLowerCase(),
      reason: String(stage?.reason || '').trim() || null,
      task_id: String(stage?.task_id || '').trim() || null,
    }))
    .filter((stage) => stage.id && stage.label && stage.status);
  if (explicitStages.length > 0) {
    return explicitStages;
  }

  const stages = Array.isArray(run?.stages) ? run.stages : [];
  return stages
    .map((stage) => ({
      id: String(stage?.id || '').trim(),
      label: String(stage?.label || stage?.id || '').trim(),
      status: String(stage?.status || '').trim().toLowerCase(),
      reason: String(stage?.result_summary || stage?.handoff_summary || '').trim() || null,
      task_id: String(stage?.task_id || '').trim() || null,
    }))
    .filter((stage) => {
      return stage.id
        && stage.label
        && ['approval_pending', 'blocked', 'failed', 'completed'].includes(stage.status);
    });
}

export function getWorkflowStageActionVerb(status: string): string {
  if (status === 'approval_pending') return 'Continuar';
  if (status === 'blocked') return 'Destravar';
  if (status === 'failed') return 'Refazer';
  if (status === 'completed') return 'Reexecutar';
  return 'Retomar';
}
