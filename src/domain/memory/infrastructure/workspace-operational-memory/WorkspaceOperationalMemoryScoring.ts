import type { Task } from '../../../../contracts/TaskContract.js';
import { resolveWorkspaceResponseStyle, type WorkspaceResponseStyle, type WorkspaceTaskKind, type WorkspaceTaskSubtype } from '../../../../services/WorkspaceTaskKind.js';
import {
  classifyWorkspaceMemoryTaskProfile,
  getWorkspaceMemoryLlmExecutionProfile,
  getWorkspaceMemoryLearningExecutor,
} from './WorkspaceOperationalMemoryTaskUtilities.js';
import type {
  AutonomousModeRecommendation,
  AutonomousOutcomeAggregate,
  DirectResponseStyleRecommendation,
  ExecutorAggregate,
  FailureAggregate,
  MemoryConfidence,
  TaskKindLlmRecommendation,
  TaskKindRecommendation,
  TaskSubtypeLlmRecommendation,
  TaskSubtypeRecommendation,
} from './WorkspaceOperationalMemoryTypes.js';

type TopLlmUsage = {
  provider: string;
  model: string | null;
  count: number;
  last_seen_at: string;
} | null;

function compareByCountThenRecent(
  leftCount: number,
  leftSeenAt: string,
  rightCount: number,
  rightSeenAt: string,
): number {
  return rightCount - leftCount || rightSeenAt.localeCompare(leftSeenAt);
}

function groupTasksByKind(tasks: Task[]): Map<WorkspaceTaskKind, Task[]> {
  const buckets = new Map<WorkspaceTaskKind, Task[]>();
  for (const task of tasks) {
    const { kind } = classifyWorkspaceMemoryTaskProfile(task);
    if (kind === 'unknown') {
      continue;
    }

    const existing = buckets.get(kind) || [];
    existing.push(task);
    buckets.set(kind, existing);
  }

  return buckets;
}

function groupTasksByKindAndSubtype(tasks: Task[]): Map<string, { kind: WorkspaceTaskKind; subtype: WorkspaceTaskSubtype; tasks: Task[] }> {
  const buckets = new Map<string, { kind: WorkspaceTaskKind; subtype: WorkspaceTaskSubtype; tasks: Task[] }>();
  for (const task of tasks) {
    const profile = classifyWorkspaceMemoryTaskProfile(task);
    if (profile.kind === 'unknown' || profile.subtype === 'unknown' || profile.subtype === 'general') {
      continue;
    }

    const key = `${profile.kind}::${profile.subtype}`;
    const existing = buckets.get(key) || { kind: profile.kind, subtype: profile.subtype, tasks: [] };
    existing.tasks.push(task);
    buckets.set(key, existing);
  }

  return buckets;
}

export function aggregateSuccessfulExecutors(tasks: Task[]): ExecutorAggregate[] {
  const grouped = new Map<string, ExecutorAggregate>();
  for (const task of tasks) {
    if (task.status !== 'completed') {
      continue;
    }

    const executor = getWorkspaceMemoryLearningExecutor(task);
    const existing = grouped.get(executor);
    if (existing) {
      existing.count += 1;
      if (task.updated_at > existing.last_seen_at) {
        existing.last_seen_at = task.updated_at;
      }
    } else {
      grouped.set(executor, {
        executor,
        count: 1,
        last_seen_at: task.updated_at,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareByCountThenRecent(left.count, left.last_seen_at, right.count, right.last_seen_at))
    .slice(0, 5);
}

export function aggregateFailures(tasks: Task[]): FailureAggregate[] {
  const grouped = new Map<string, FailureAggregate>();
  for (const task of tasks) {
    if (task.status !== 'failed') {
      continue;
    }

    const executor = getWorkspaceMemoryLearningExecutor(task);
    const summary = normalizeWorkspaceFailure(task.error_summary || task.stderr_summary || 'failure without summary');
    const key = `${executor}::${summary}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (task.updated_at > existing.last_seen_at) {
        existing.last_seen_at = task.updated_at;
      }
    } else {
      grouped.set(key, {
        executor,
        summary,
        count: 1,
        last_seen_at: task.updated_at,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareByCountThenRecent(left.count, left.last_seen_at, right.count, right.last_seen_at))
    .slice(0, 5);
}

export function buildTaskKindRecommendations(tasks: Task[]): TaskKindRecommendation[] {
  const buckets = groupTasksByKind(tasks);

  return Array.from(buckets.entries())
    .map(([kind, kindTasks]) => {
      const successfulExecutors = aggregateSuccessfulExecutors(kindTasks);
      const repeatedFailures = aggregateFailures(kindTasks);
      const topSuccess = successfulExecutors[0];
      const topFailure = repeatedFailures[0];
      const lastSeenAt = [
        topSuccess?.last_seen_at || '',
        topFailure?.last_seen_at || '',
      ].sort((left, right) => right.localeCompare(left))[0] || '';

      return {
        kind,
        preferred_executor: topSuccess?.executor || null,
        success_count: Number(topSuccess?.count || 0),
        repeated_failure_executor: topFailure?.executor || null,
        repeated_failure_summary: topFailure?.summary || null,
        repeated_failure_count: Number(topFailure?.count || 0),
        last_seen_at: lastSeenAt,
      } satisfies TaskKindRecommendation;
    })
    .filter((entry) => entry.preferred_executor || entry.repeated_failure_executor)
    .sort((left, right) => {
      return (
        right.success_count - left.success_count
        || right.repeated_failure_count - left.repeated_failure_count
        || right.last_seen_at.localeCompare(left.last_seen_at)
      );
    })
    .slice(0, 6);
}

export function buildTaskSubtypeRecommendations(tasks: Task[]): TaskSubtypeRecommendation[] {
  const buckets = groupTasksByKindAndSubtype(tasks);

  return Array.from(buckets.values())
    .map((bucket) => {
      const successfulExecutors = aggregateSuccessfulExecutors(bucket.tasks);
      const repeatedFailures = aggregateFailures(bucket.tasks);
      const topSuccess = successfulExecutors[0];
      const topFailure = repeatedFailures[0];
      const lastSeenAt = [
        topSuccess?.last_seen_at || '',
        topFailure?.last_seen_at || '',
      ].sort((left, right) => right.localeCompare(left))[0] || '';

      return {
        kind: bucket.kind,
        subtype: bucket.subtype,
        preferred_executor: topSuccess?.executor || null,
        success_count: Number(topSuccess?.count || 0),
        repeated_failure_executor: topFailure?.executor || null,
        repeated_failure_summary: topFailure?.summary || null,
        repeated_failure_count: Number(topFailure?.count || 0),
        last_seen_at: lastSeenAt,
      } satisfies TaskSubtypeRecommendation;
    })
    .filter((entry) => entry.preferred_executor || entry.repeated_failure_executor)
    .sort((left, right) => {
      return (
        right.success_count - left.success_count
        || right.repeated_failure_count - left.repeated_failure_count
        || right.last_seen_at.localeCompare(left.last_seen_at)
      );
    })
    .slice(0, 8);
}

export function buildTaskKindLlmRecommendations(tasks: Task[]): TaskKindLlmRecommendation[] {
  const buckets = groupTasksByKind(tasks);

  return Array.from(buckets.entries())
    .map(([kind, kindTasks]) => {
      const topLlm = aggregateTopLlmUsage(kindTasks);
      if (!topLlm) {
        return null;
      }

      return {
        kind,
        subtype: 'general',
        preferred_provider: topLlm.provider,
        preferred_model: topLlm.model,
        success_count: topLlm.count,
        last_seen_at: topLlm.last_seen_at,
        confidence: confidenceFromCount(topLlm.count),
        rationale: `${topLlm.count} task(s) completed(s) deste tipo usaram ${topLlm.provider}${topLlm.model ? `/${topLlm.model}` : ''}.`,
      } satisfies TaskKindLlmRecommendation;
    })
    .filter((entry): entry is TaskKindLlmRecommendation => Boolean(entry))
    .sort((left, right) => compareByCountThenRecent(left.success_count, left.last_seen_at, right.success_count, right.last_seen_at))
    .slice(0, 6);
}

export function buildTaskSubtypeLlmRecommendations(tasks: Task[]): TaskSubtypeLlmRecommendation[] {
  const buckets = groupTasksByKindAndSubtype(tasks);

  return Array.from(buckets.values())
    .map((bucket) => {
      const topLlm = aggregateTopLlmUsage(bucket.tasks);
      if (!topLlm) {
        return null;
      }

      return {
        kind: bucket.kind,
        subtype: bucket.subtype,
        preferred_provider: topLlm.provider,
        preferred_model: topLlm.model,
        success_count: topLlm.count,
        last_seen_at: topLlm.last_seen_at,
        confidence: confidenceFromCount(topLlm.count),
        rationale: `${topLlm.count} task(s) completed(s) deste subtipo usaram ${topLlm.provider}${topLlm.model ? `/${topLlm.model}` : ''}.`,
      } satisfies TaskSubtypeLlmRecommendation;
    })
    .filter((entry): entry is TaskSubtypeLlmRecommendation => Boolean(entry))
    .sort((left, right) => compareByCountThenRecent(left.success_count, left.last_seen_at, right.success_count, right.last_seen_at))
    .slice(0, 8);
}

export function buildAutonomousModeRecommendations(outcomes: AutonomousOutcomeAggregate[]): AutonomousModeRecommendation[] {
  const buckets = new Map<
    string,
    {
      kind: WorkspaceTaskKind;
      subtype: WorkspaceTaskSubtype;
      approved_count: number;
      failed_count: number;
      last_seen_at: string;
    }
  >();

  for (const outcome of outcomes) {
    if (outcome.task_kind === 'unknown') {
      continue;
    }

    const subtype = outcome.task_subtype === 'unknown' ? 'general' : outcome.task_subtype;
    const key = `${outcome.task_kind}::${subtype}`;
    const existing = buckets.get(key) || {
      kind: outcome.task_kind,
      subtype,
      approved_count: 0,
      failed_count: 0,
      last_seen_at: outcome.updated_at,
    };

    if (outcome.approved || outcome.status === 'approved') {
      existing.approved_count += 1;
    } else {
      existing.failed_count += 1;
    }

    if (outcome.updated_at > existing.last_seen_at) {
      existing.last_seen_at = outcome.updated_at;
    }

    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const total = bucket.approved_count + bucket.failed_count;
      const preferred_mode = bucket.approved_count >= bucket.failed_count ? 'autonomous' : 'direct';
      const confidence = confidenceFromTotal(total);
      const rationale =
        preferred_mode === 'autonomous'
          ? `${bucket.approved_count} ciclo(s) autonomos approved contra ${bucket.failed_count} failure(s)`
          : `${bucket.failed_count} failure(s) autonomas contra ${bucket.approved_count} success(s)`;

      return {
        kind: bucket.kind,
        subtype: bucket.subtype,
        preferred_mode,
        approved_count: bucket.approved_count,
        failed_count: bucket.failed_count,
        last_seen_at: bucket.last_seen_at,
        confidence,
        rationale,
      } satisfies AutonomousModeRecommendation;
    })
    .sort((left, right) => {
      const leftWeight = left.preferred_mode === 'autonomous' ? left.approved_count - left.failed_count
        : left.failed_count - left.approved_count;
      const rightWeight = right.preferred_mode === 'autonomous' ? right.approved_count - right.failed_count
        : right.failed_count - right.approved_count;

      return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
    })
    .slice(0, 8);
}

export function buildDirectResponseStyleRecommendations(tasks: Task[]): DirectResponseStyleRecommendation[] {
  const buckets = new Map<
    string,
    {
      kind: WorkspaceTaskKind;
      subtype: WorkspaceTaskSubtype;
      preferred_style: WorkspaceResponseStyle;
      success_count: number;
      last_seen_at: string;
    }
  >();

  for (const task of tasks) {
    if (task.status !== 'completed') {
      continue;
    }

    const profile = classifyWorkspaceMemoryTaskProfile(task);
    if (profile.kind === 'unknown') {
      continue;
    }

    const subtype = profile.subtype === 'unknown' ? 'general' : profile.subtype;
    const key = `${profile.kind}::${subtype}`;
    const existing = buckets.get(key) || {
      kind: profile.kind,
      subtype,
      preferred_style: resolveWorkspaceResponseStyle(profile.kind, subtype),
      success_count: 0,
      last_seen_at: task.updated_at,
    };

    existing.success_count += 1;
    if (task.updated_at > existing.last_seen_at) {
      existing.last_seen_at = task.updated_at;
    }

    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const confidence = confidenceFromCount(bucket.success_count);

      return {
        kind: bucket.kind,
        subtype: bucket.subtype,
        preferred_style: bucket.preferred_style,
        success_count: bucket.success_count,
        last_seen_at: bucket.last_seen_at,
        confidence,
        rationale: `${bucket.success_count} task(s) completed(s) deste profile favoreceram ${bucket.preferred_style}.`,
      } satisfies DirectResponseStyleRecommendation;
    })
    .sort((left, right) => compareByCountThenRecent(left.success_count, left.last_seen_at, right.success_count, right.last_seen_at))
    .slice(0, 8);
}

export function aggregateTopLlmUsage(tasks: Task[]): TopLlmUsage {
  const grouped = new Map<string, { provider: string; model: string | null; count: number; last_seen_at: string }>();

  for (const task of tasks) {
    if (task.status !== 'completed') {
      continue;
    }

    const llmProfile = getWorkspaceMemoryLlmExecutionProfile(task);
    if (!llmProfile.provider) {
      continue;
    }

    const key = `${llmProfile.provider}::${llmProfile.model || ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (task.updated_at > existing.last_seen_at) {
        existing.last_seen_at = task.updated_at;
      }
    } else {
      grouped.set(key, {
        provider: llmProfile.provider,
        model: llmProfile.model,
        count: 1,
        last_seen_at: task.updated_at,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => compareByCountThenRecent(left.count, left.last_seen_at, right.count, right.last_seen_at))[0] || null;
}

function confidenceFromCount(count: number): MemoryConfidence {
  return count >= 3 ? 'high' : count >= 2 ? 'medium' : 'low';
}

function confidenceFromTotal(total: number): MemoryConfidence {
  return total >= 3 ? 'high' : total >= 2 ? 'medium' : 'low';
}

function normalizeWorkspaceFailure(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180) || 'failure without summary';
}
