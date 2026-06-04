import type {
  SurfaceConsistencyActionContext,
  SurfaceConsistencyReadiness,
} from './SharedSurfaceConsistencyTypes.js';
import {
  buildActionAvailability,
  buildActionSnapshot,
  findLatestArtifact,
  type SurfaceConsistencyPrioritizedAction,
} from './SharedSurfaceConsistencyActionSupport.js';

export function pushArtifactActions(
  actions: SurfaceConsistencyPrioritizedAction[],
  context: SurfaceConsistencyActionContext,
  readiness: SurfaceConsistencyReadiness,
): void {
  const latestArtifact = findLatestArtifact(context.tasks || [], context.continuity || null);
  if (!latestArtifact) {
    return;
  }

  const telegramArtifactCommand = latestArtifact.path
    ? `/arquivo ${latestArtifact.path}`
    : null;
  actions.push({
    priority: 70,
    snapshot: buildActionSnapshot({
      actionId: `open-latest-artifact:${latestArtifact.taskId}:${latestArtifact.artifactId}`,
      actionType: 'open-latest-artifact',
      title: 'Abrir a ultima entrega',
      description: latestArtifact.summary
        || latestArtifact.name
        || 'Abre a entrega recente no mesmo fluxo do chat.',
      category: 'artifact',
      availability: buildActionAvailability(
        { mode: 'inline' },
        { mode: telegramArtifactCommand ? 'command' : 'inline' },
        { mode: 'hidden' },
        readiness,
      ),
      equivalents: {
        web: {
          mode: 'inline',
          label: 'Abrir no app',
          value: latestArtifact.artifactId,
        },
        telegram: {
          mode: telegramArtifactCommand ? 'command' : 'inline',
          label: telegramArtifactCommand ? 'Copiar comando do Telegram' : 'Ver a entrega no Telegram',
          value: telegramArtifactCommand || latestArtifact.name || latestArtifact.path || null,
        },
        discord: {
          mode: 'hidden',
          label: 'Nao exposto no Discord',
          value: null,
        },
      },
      context: {
        taskId: latestArtifact.taskId,
        permissionId: null,
        workflowRunId: null,
        workflowStageId: null,
        artifactId: latestArtifact.artifactId,
        artifactPath: latestArtifact.path,
        reason: latestArtifact.summary || latestArtifact.name || null,
      },
    }),
  });
}
