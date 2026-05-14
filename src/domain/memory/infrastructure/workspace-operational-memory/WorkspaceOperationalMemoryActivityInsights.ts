import type { Task } from '../../../../contracts/TaskContract.js';
import type {
  ActiveFocusAggregate,
  AutonomousOutcomeAggregate,
  RecentArtifactAggregate,
  WorkspaceOperationalMemory,
} from './WorkspaceOperationalMemoryTypes.js';
import {
  getWorkspaceMemoryLearningExecutor,
  normalizeWorkspaceMemoryOutcomeSummary,
  toWorkspaceMemoryRecord,
} from './WorkspaceOperationalMemoryTaskUtilities.js';
import { classifyWorkspaceMemoryTaskProfile } from './WorkspaceOperationalMemoryTaskUtilities.js';

function isActiveWorkspaceMemoryTask(task: Task): boolean {
  return ['pending', 'parsed', 'planned', 'waiting_approval', 'approved', 'running', 'validating', 'delivery_pending']
    .includes(String(task.status || '').trim());
}

export function findLastSuccessfulTask(tasks: Task[]): WorkspaceOperationalMemory['last_successful_task'] {
  const recent = tasks
    .filter((task) => task.status === 'completed')
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];

  if (!recent) {
    return null;
  }

  return {
    executor: getWorkspaceMemoryLearningExecutor(recent),
    summary: recent.result_summary || recent.stdout_summary || null,
    updated_at: recent.updated_at,
    task_id: recent.task_id,
  };
}

export function collectActiveFocuses(tasks: Task[]): ActiveFocusAggregate[] {
  return tasks
    .filter((task) => isActiveWorkspaceMemoryTask(task))
    .map((task) => {
      const profile = classifyWorkspaceMemoryTaskProfile(task);
      const summary = normalizeWorkspaceMemoryOutcomeSummary(
        String(task.result_summary || task.raw_message || task.normalized_message || task.command_type || 'atividade em andamento'),
      );

      return {
        task_id: task.task_id,
        short_id: task.task_id.substring(0, 8),
        status: task.status,
        approval_status: task.approval_status,
        executor: getWorkspaceMemoryLearningExecutor(task),
        kind: profile.kind,
        subtype: profile.subtype,
        summary,
        updated_at: task.updated_at,
      } satisfies ActiveFocusAggregate;
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 5);
}

export function collectRecentArtifacts(tasks: Task[]): RecentArtifactAggregate[] {
  return tasks
    .flatMap((task) => {
      const executor = getWorkspaceMemoryLearningExecutor(task);
      return (Array.isArray(task.artifacts) ? task.artifacts : []).map((artifact) => ({
        task_id: task.task_id,
        artifact_id: String(artifact.id || artifact.key || '').trim() || `${task.task_id}:${artifact.name}`,
        name: String(artifact.name || artifact.key || 'artifact').trim(),
        kind: String(artifact.kind || 'artifact').trim(),
        type: String(artifact.type || 'file').trim(),
        path: artifact.path || null,
        url: artifact.url || null,
        summary: artifact.summary || artifact.description || null,
        created_at: String(artifact.createdAt || task.updated_at || task.created_at || '').trim(),
        executor,
      }) satisfies RecentArtifactAggregate);
    })
    .filter((artifact) => Boolean(artifact.name))
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 8);
}

export function collectAutonomousOutcomes(tasks: Task[]): AutonomousOutcomeAggregate[] {
  return tasks
    .map((task) => {
      const graphRun = toWorkspaceMemoryRecord(task.metadata?.autonomous_graph_last_run);
      if (!graphRun.status) {
        return null;
      }

      const workspaceStrategy = toWorkspaceMemoryRecord(graphRun.workspaceStrategy);
      const classified = classifyWorkspaceMemoryTaskProfile(task);
      const summary = normalizeWorkspaceMemoryOutcomeSummary(
        String(task.result_summary || task.error_summary || graphRun.criticFeedback || graphRun.taskGoal || '').trim(),
      );

      return {
        status: String(graphRun.status || 'unknown'),
        approved: graphRun.approved === true,
        iterations: Number(graphRun.iterations || 0),
        trace_id: typeof graphRun.traceId === 'string' ? graphRun.traceId : null,
        summary,
        task_kind: classified.kind,
        task_subtype: classified.subtype,
        preferred_executor:
          typeof workspaceStrategy.preferredExecutor === 'string' ? workspaceStrategy.preferredExecutor : null,
        updated_at: String(task.updated_at || graphRun.finishedAt || ''),
      } satisfies AutonomousOutcomeAggregate;
    })
    .filter((item): item is AutonomousOutcomeAggregate => Boolean(item))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 5);
}
