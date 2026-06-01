import type { Task } from '../../../../../contracts/TaskContract.js';
import { normalizeNaturalText } from './workflowGovernanceText.js';

export function resolveRecentWorkflowRunIdFromTasks(
  recentTasks: Task[],
  keywords: string[],
): string | null {
  const seen = new Set<string>();
  let bestMatch: { workflowRunId: string; score: number } | null = null;

  for (const task of recentTasks) {
    const workflowRunId = String(task?.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId || seen.has(workflowRunId)) {
      continue;
    }
    seen.add(workflowRunId);

    const score = scoreWorkflowTaskMatch(task, keywords);
    if (keywords.length > 0 && score <= 0) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { workflowRunId, score };
    }
  }

  return bestMatch?.workflowRunId || null;
}

function scoreWorkflowTaskMatch(task: Task, keywords: string[]): number {
  const haystack = normalizeNaturalText(
    [
      task.raw_message,
      task.result_summary,
      task.error_summary,
      task.metadata?.workflow_label,
      task.metadata?.workflow_objective,
      task.metadata?.workflow_stage_id,
      task.metadata?.workflow_resume_stage_id,
      task.metadata?.workflow_stage_label,
      task.metadata?.workflow_name,
    ]
      .filter(Boolean)
      .join(' '),
  );

  let score = String(task.command_type || '').trim() === '/workflow' ? 2 : 1;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 3;
    }
  }
  return score;
}
