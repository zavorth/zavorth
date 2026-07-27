import type { SurfaceConsistencyActionContext, SurfaceConsistencyReadiness } from './SharedSurfaceConsistencyTypes.js';
import {
  buildActionAvailability,
  buildActionSnapshot,
  type SurfaceConsistencyPrioritizedAction,
} from './SharedSurfaceConsistencyActionSupport.js';

export function pushAccessActions(
  actions: SurfaceConsistencyPrioritizedAction[],
  context: SurfaceConsistencyActionContext,
  readiness: SurfaceConsistencyReadiness,
): void {
  const access = context.access || null;
  const recommendedAccessPlan =
    access?.recommendedPlan && typeof access.recommendedPlan === 'object' ? access.recommendedPlan : null;
  const accessPrimaryAction = String(recommendedAccessPlan?.primaryAction || '')
    .trim()
    .toLowerCase();
  const accessPrimaryLabel = String(recommendedAccessPlan?.primaryLabel || '').trim();
  const accessPrimarySummary = String(recommendedAccessPlan?.primarySummary || '').trim();
  const accessPrimaryCommand = String(recommendedAccessPlan?.primaryCommand || '').trim();
  const accessOpenTarget = String(
    recommendedAccessPlan?.openTarget || access?.local?.appUrl || access?.remote?.appUrl || '',
  ).trim();

  if (accessPrimaryAction === 'trust' && (accessPrimaryCommand || accessOpenTarget)) {
    actions.push({
      priority: 112,
      snapshot: buildActionSnapshot({
        actionId: 'continue-official-access:trust',
        actionType: 'continue-official-access',
        title: accessPrimaryLabel || 'enable este host',
        description:
          accessPrimarySummary ||
          'Authorize this host before running mutable actions, local writes, or persisted deliveries.',
        category: 'access',
        availability: buildActionAvailability({ mode: 'inline' }, { mode: 'command' }, { mode: 'hidden' }, readiness),
        equivalents: {
          web: {
            mode: 'inline',
            label: 'Autorizar no app',
            value: accessPrimaryCommand || accessOpenTarget || null,
          },
          telegram: {
            mode: 'command',
            label: 'Copy Telegram command',
            value: '/hostauth trust',
          },
          discord: {
            mode: 'hidden',
            label: 'Not yet exposed on Discord',
            value: null,
          },
        },
        context: {
          taskId: null,
          permissionId: null,
          workflowRunId: null,
          workflowStageId: null,
          artifactId: null,
          artifactPath: accessOpenTarget || null,
          reason: accessPrimarySummary || null,
        },
      }),
    });
  }

  if (accessPrimaryAction === 'go' && (accessPrimaryCommand || accessOpenTarget)) {
    actions.push({
      priority: 111,
      snapshot: buildActionSnapshot({
        actionId: 'continue-official-access:go',
        actionType: 'continue-official-access',
        title: accessPrimaryLabel || 'Seguir path oficial',
        description:
          accessPrimarySummary ||
          'Use the shortest official path to install, start the runtime, and open the best ready surface.',
        category: 'access',
        availability: buildActionAvailability({ mode: 'inline' }, { mode: 'command' }, { mode: 'slash' }, readiness),
        equivalents: {
          web: {
            mode: 'inline',
            label: 'Continuar no app',
            value: accessPrimaryCommand || accessOpenTarget || null,
          },
          telegram: {
            mode: 'command',
            label: 'Copy Telegram command',
            value: '/access',
          },
          discord: {
            mode: 'slash',
            label: 'Copiar slash do Discord',
            value: '/access',
          },
        },
        context: {
          taskId: null,
          permissionId: null,
          workflowRunId: null,
          workflowStageId: null,
          artifactId: null,
          artifactPath: accessOpenTarget || null,
          reason: accessPrimarySummary || null,
        },
      }),
    });
  }

  if (accessPrimaryAction === 'remote' && (accessPrimaryCommand || accessOpenTarget)) {
    actions.push({
      priority: 110,
      snapshot: buildActionSnapshot({
        actionId: 'continue-official-access:remote',
        actionType: 'continue-official-access',
        title: accessPrimaryLabel || 'Continue official access',
        description: accessPrimarySummary || 'Continue the official path to finish Zavorth remote access.',
        category: 'access',
        availability: buildActionAvailability({ mode: 'inline' }, { mode: 'command' }, { mode: 'slash' }, readiness),
        equivalents: {
          web: {
            mode: 'inline',
            label: 'Continuar no app',
            value: accessPrimaryCommand || accessOpenTarget || null,
          },
          telegram: {
            mode: 'command',
            label: 'Copy Telegram command',
            value: '/access',
          },
          discord: {
            mode: 'slash',
            label: 'Copiar slash do Discord',
            value: '/access',
          },
        },
        context: {
          taskId: null,
          permissionId: null,
          workflowRunId: null,
          workflowStageId: null,
          artifactId: null,
          artifactPath: accessOpenTarget || null,
          reason: accessPrimarySummary || null,
        },
      }),
    });
  }

  if (accessPrimaryAction === 'open-local' && accessOpenTarget) {
    actions.push({
      priority: 109,
      snapshot: buildActionSnapshot({
        actionId: 'open-official-app:local',
        actionType: 'open-official-app',
        title: accessPrimaryLabel || 'Abrir shell web do runtime',
        description: accessPrimarySummary || 'Open the runtime web shell.',
        category: 'access',
        availability: buildActionAvailability({ mode: 'inline' }, { mode: 'command' }, { mode: 'slash' }, readiness),
        equivalents: {
          web: {
            mode: 'inline',
            label: 'Abrir no app',
            value: accessOpenTarget,
          },
          telegram: {
            mode: 'command',
            label: 'Copy Telegram command',
            value: '/status',
          },
          discord: {
            mode: 'slash',
            label: 'Copiar slash do Discord',
            value: '/status',
          },
        },
        context: {
          taskId: null,
          permissionId: null,
          workflowRunId: null,
          workflowStageId: null,
          artifactId: null,
          artifactPath: accessOpenTarget,
          reason: accessPrimarySummary || null,
        },
      }),
    });
  }
}
