import type {
  ZavorthTaskArtifactsSnapshot,
  ZavorthTaskContinuationPlan,
  ZavorthTaskOsSnapshot,
} from '../services/ZavorthTaskOperatingSystemService.js';
import type { TaskLedgerTaskSnapshot } from '../services/TaskLedgerService.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';

function compact(value: string | null | undefined, maxLength = 96): string {
  const normalized = sanitizeHumanCliText(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'not provided';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function toneForTask(task: TaskLedgerTaskSnapshot): CliVisualPanel['tone'] {
  if (task.state.state === 'failed' || task.state.state === 'cancelled') {
    return 'danger';
  }
  if (task.state.state === 'awaiting_permission' || task.state.state === 'awaiting_artifact' || task.state.state === 'paused') {
    return 'warning';
  }
  if (task.state.state === 'completed') {
    return 'success';
  }
  return 'neutral';
}

function formatTaskLine(task: TaskLedgerTaskSnapshot): string {
  return `- ${task.shortId}: ${task.state.state} | ${compact(task.summary, 72)} | artefatos ${task.artifacts.total}`;
}

export function formatTaskOsSnapshot(snapshot: ZavorthTaskOsSnapshot): string {
  const tasks = snapshot.taskLedger.tasks.slice(0, 8);
  const panels: CliVisualPanel[] = [
    {
      title: 'Agora',
      tone: snapshot.summary.awaitingPermission > 0 || snapshot.summary.awaitingArtifact > 0 ? 'warning' : 'success',
      lines: [
        `- ${formatCount(snapshot.summary.tasks, 'task', 'tasks')} no ledger`,
        `- ativas: ${snapshot.summary.active} | permissao: ${snapshot.summary.awaitingPermission} | artefato: ${snapshot.summary.awaitingArtifact}`,
        `- artifacts: ${snapshot.summary.artifacts} | permissions: ${snapshot.summary.permissions}`,
        `- revogaveis: ${snapshot.summary.revokablePermissions}`,
      ],
    },
    {
      title: 'Estados formais',
      tone: 'info',
      lines: [
        `- queued: ${snapshot.taskLedger.summary.byState.queued}`,
        `- planning: ${snapshot.taskLedger.summary.byState.planning}`,
        `- awaiting_permission: ${snapshot.taskLedger.summary.byState.awaiting_permission}`,
        `- running: ${snapshot.taskLedger.summary.byState.running}`,
        `- awaiting_artifact: ${snapshot.taskLedger.summary.byState.awaiting_artifact}`,
        `- delivering: ${snapshot.taskLedger.summary.byState.delivering}`,
        `- completed/failed/cancelled: ${snapshot.taskLedger.summary.byState.completed}/${snapshot.taskLedger.summary.byState.failed}/${snapshot.taskLedger.summary.byState.cancelled}`,
      ],
    },
    {
      title: 'Tasks recentes',
      tone: tasks.some((task) => task.state.state === 'awaiting_permission') ? 'warning' : 'neutral',
      lines: tasks.length > 0 ? tasks.map((task) => formatTaskLine(task)) : ['- no recent record'],
    },
    {
      title: 'Contratos',
      tone: snapshot.contracts.approvalResumesCorrectTask && snapshot.contracts.artifactsSurviveRestart ? 'success' : 'warning',
      lines: [
        `- ambiguous states: ${snapshot.contracts.noAmbiguousTaskState ? 'no' : 'yes'}`,
        `- approval resumes correct task: ${snapshot.contracts.approvalResumesCorrectTask ? 'yes' : 'needs pending link'}`,
        `- artifacts survive restart: ${snapshot.contracts.artifactsSurviveRestart ? 'yes' : 'partial'}`,
        `- auditable permissions: ${snapshot.contracts.permissionsRevokableAndAuditable ? 'yes' : 'partial'}`,
      ],
    },
    {
      title: 'Faca agora',
      tone: 'brand',
      lines: [
        '- zavorth tasks --json',
        '- zavorth artifacts task latest --json',
        '- zavorth tasks resume <taskId>',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Tasks',
    eyebrowTone: snapshot.summary.awaitingPermission > 0 ? 'warning' : 'success',
    title: 'Zavorth Task OS',
    summary: formatCliValue(snapshot.narrative.headline, 'Ledger operacional de tasks ready.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

export function formatTaskArtifactsSnapshot(snapshot: ZavorthTaskArtifactsSnapshot): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Task',
      tone: snapshot.task ? toneForTask(snapshot.task) : 'warning',
      lines: snapshot.task
        ? [
            `- id: ${snapshot.task.taskId}`,
            `- state: ${snapshot.task.state.state}`,
            `- resumo: ${compact(snapshot.task.summary, 100)}`,
          ]
        : ['- no task found'],
    },
    {
      title: 'Artefatos',
      tone: snapshot.artifacts.length > 0 ? 'success' : 'neutral',
      lines: snapshot.artifacts.length > 0
        ? snapshot.artifacts.slice(0, 8).map((artifact) =>
            `- ${artifact.name}: ${artifact.kind || artifact.type} | ${artifact.path || artifact.url || artifact.key}`)
        : ['- no structured artifact'],
    },
    {
      title: 'Reenvio',
      tone: snapshot.redelivery.available ? 'brand' : 'neutral',
      lines: [
        `- available: ${snapshot.redelivery.available ? 'yes' : 'no'}`,
        `- command: ${snapshot.redelivery.command || 'not provided'}`,
        `- motivo: ${compact(snapshot.redelivery.reason, 96)}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Artifacts',
    eyebrowTone: snapshot.redelivery.available ? 'success' : 'neutral',
    title: 'Artefatos da task',
    summary: snapshot.task
      ? `${snapshot.artifacts.length} artefatos rastreados para ${snapshot.task.shortId}.`
      : 'Nenhuma task encontrada para listar artefatos.',
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

export function formatTaskContinuationPlan(plan: ZavorthTaskContinuationPlan): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Plano',
      tone: plan.available ? 'success' : 'warning',
      lines: [
        `- acao: ${plan.action}`,
        `- available: ${plan.available ? 'yes' : 'no'}`,
        `- next command: ${plan.nextCommand || 'not provided'}`,
        `- expected state: ${plan.expectedState || 'not provided'}`,
      ],
    },
    {
      title: 'Preserva',
      tone: 'info',
      lines: [
        `- conversation: ${plan.preserves.conversation ? 'yes' : 'no'}`,
        `- workspace: ${plan.preserves.workspace ? 'yes' : 'no'}`,
        `- executor: ${plan.preserves.executor ? 'yes' : 'no'}`,
        `- artifacts: ${plan.preserves.artifacts ? 'yes' : 'no'}`,
        `- approvals: ${plan.preserves.approvals ? 'yes' : 'no'}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Continuation',
    eyebrowTone: plan.available ? 'success' : 'warning',
    title: plan.action === 'resume' ? 'Resume padronizado' : 'Retry padronizado',
    summary: compact(plan.reason, 120),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
