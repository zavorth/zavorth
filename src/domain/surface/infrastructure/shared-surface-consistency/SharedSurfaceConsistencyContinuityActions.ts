import type {
  SurfaceConsistencyActionContext,
  SurfaceConsistencyReadiness,
} from './SharedSurfaceConsistencyTypes.js';
import {
  buildActionAvailability,
  buildActionSnapshot,
  type SurfaceConsistencyPrioritizedAction,
} from './SharedSurfaceConsistencyActionSupport.js';

export function pushContinuityActions(
  actions: SurfaceConsistencyPrioritizedAction[],
  context: SurfaceConsistencyActionContext,
  readiness: SurfaceConsistencyReadiness,
): void {
  const continuity = context.continuity || null;
  const followupPrompt = String(
    continuity?.suggestedAction?.prompt
    || continuity?.workspaceContext?.followupPrompt
    || '',
  ).trim();
  const workspaceActiveFocus =
    continuity?.workspaceContext?.activeFocus && typeof continuity.workspaceContext.activeFocus === 'object'
      ? continuity.workspaceContext.activeFocus
      : null;
  const workspaceRecentArtifact =
    continuity?.workspaceContext?.recentArtifact && typeof continuity.workspaceContext.recentArtifact === 'object'
      ? continuity.workspaceContext.recentArtifact
      : null;
  const continuityReason = String(
    continuity?.suggestedAction?.reason
    || workspaceActiveFocus?.reason
    || workspaceActiveFocus?.label
    || continuity?.workspaceContext?.activeFocus
    || workspaceRecentArtifact?.name
    || workspaceRecentArtifact?.path
    || continuity?.workspaceContext?.recentArtifact
    || '',
  ).trim();
  const continuityTaskId = String(
    continuity?.focusTask?.taskId
    || continuity?.latestTelegramTask?.taskId
    || '',
  ).trim();

  if (!followupPrompt) {
    return;
  }

  actions.push({
    priority: 100,
    snapshot: buildActionSnapshot({
      actionId: `continue-latest-context:${continuityTaskId || 'latest'}`,
      actionType: 'continue-latest-context',
      title: 'Continuar o contexto current',
      description: continuityReason
        || 'Leva a mesma resumption recomendada para web, Telegram e outras surfaces.',
      category: 'continuity',
      availability: buildActionAvailability(
        { mode: 'prompt' },
        { mode: followupPrompt ? 'prompt' : 'hidden' },
        { mode: 'hidden' },
        readiness,
      ),
      equivalents: {
        web: {
          mode: 'prompt',
          label: 'Trazer para o chat',
          value: followupPrompt,
        },
        telegram: {
          mode: 'prompt',
          label: 'Continue on Telegram',
          value: followupPrompt,
        },
        discord: {
          mode: 'hidden',
          label: 'Not exposed on Discord',
          value: null,
        },
      },
      context: {
        taskId: continuityTaskId || null,
        permissionId: null,
        workflowRunId: null,
        workflowStageId: null,
        artifactId: null,
        artifactPath: null,
        reason: continuityReason || null,
      },
    }),
  });
}
