import type {
  SurfaceParityActionContext,
  SurfaceParityReadiness,
} from './SharedSurfaceParityTypes.js';
import {
  buildActionAvailability,
  buildActionSnapshot,
  type SurfaceParityPrioritizedAction,
} from './SharedSurfaceParityActionSupport.js';

export function pushContinuityActions(
  actions: SurfaceParityPrioritizedAction[],
  context: SurfaceParityActionContext,
  readiness: SurfaceParityReadiness,
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
      title: 'Continuar o contexto atual',
      description: continuityReason
        || 'Leva a mesma retomada recomendada para web, Telegram e outras superficies.',
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
          label: 'Continuar no Telegram',
          value: followupPrompt,
        },
        discord: {
          mode: 'hidden',
          label: 'Nao exposto no Discord',
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
