import { TaskManager } from '../src/orchestrator/TaskManager.js';
import { LogRepository } from '../src/storage/LogRepository.js';
import { TaskRepository } from '../src/storage/TaskRepository.js';
import type { Task } from '../src/contracts/TaskContract.js';

type RepairCandidate = {
  task_id: string;
};

function parseArgs(argv: string[]) {
  const args = new Set(argv);
  return {
    apply: args.has('--apply'),
    json: args.has('--json'),
  };
}

function isRepairable(task: Task | undefined): task is Task {
  if (!task) {
    return false;
  }
  if (!['pending', 'parsed', 'planned', 'approved', 'waiting_approval', 'running', 'validating', 'delivery_pending'].includes(String(task.status || '').trim())) {
    return false;
  }
  if (String(task.result_summary || '').trim().length === 0) {
    return false;
  }
  if (String(task.error_summary || '').trim().length > 0) {
    return false;
  }
  if (String(task.approval_status || '').trim() === 'pending') {
    return false;
  }
  const directRun = task.metadata?.direct_response_last_run || {};
  return String(directRun.finishedAt || '').trim().length > 0;
}

function patchConversationOutcome(task: Task): void {
  const finishedAt =
    String(task.metadata?.direct_response_last_run?.finishedAt || '').trim()
    || new Date().toISOString();
  task.metadata = {
    ...(task.metadata || {}),
    workspace_route_outcome: task.metadata?.workspace_route_outcome
      ? {
          ...(task.metadata.workspace_route_outcome || {}),
          final_status: 'completed',
          updated_at: finishedAt,
          approval_status:
            String(task.metadata.workspace_route_outcome?.approval_status || task.approval_status || '').trim()
            || task.approval_status,
        }
      : task.metadata?.workspace_route_outcome,
  };
  task.error_summary = null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const taskRepo = new TaskRepository();
  const logRepo = new LogRepository();
  await taskRepo.init();
  await logRepo.init();
  const taskManager = new TaskManager(taskRepo, logRepo);

  const db = (taskRepo as any).db;
  const rows = db.all<RepairCandidate>(
    `SELECT task_id
     FROM system_tasks
     WHERE status IN ('pending', 'parsed', 'planned', 'approved', 'waiting_approval', 'running', 'validating', 'delivery_pending')
       AND result_summary IS NOT NULL
       AND trim(result_summary) <> ''
       AND (error_summary IS NULL OR trim(error_summary) = '')
       AND approval_status != 'pending'
       AND json_extract(metadata, '$.direct_response_last_run.finishedAt') IS NOT NULL
     ORDER BY updated_at ASC`,
  );

  const repaired: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const task = taskRepo.getById(row.task_id);
    if (!isRepairable(task)) {
      skipped.push(row.task_id);
      continue;
    }
    patchConversationOutcome(task);
    if (!options.apply) {
      repaired.push(task.task_id);
      continue;
    }

    if (task.status === 'pending') {
      taskManager.advanceState(task, 'parsed', {
        actor: 'repair-direct-response-tasks',
        reason: 'repair_direct_response_history',
      });
    }
    if (['parsed', 'planned', 'approved', 'waiting_approval'].includes(String(task.status || '').trim())) {
      taskManager.advanceState(task, 'running', {
        actor: 'repair-direct-response-tasks',
        reason: 'repair_direct_response_history',
      });
    }
    if (['running', 'validating', 'delivery_pending'].includes(String(task.status || '').trim())) {
      taskManager.advanceState(task, 'completed', {
        actor: 'repair-direct-response-tasks',
        reason: 'repair_direct_response_history',
      });
    }
    taskManager.saveTask(task);
    repaired.push(task.task_id);
  }

  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    candidates: rows.length,
    repaired: repaired.length,
    skipped: skipped.length,
    sample: repaired.slice(0, 10),
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('[repair-direct-response-tasks] mode=' + summary.mode);
  console.log('[repair-direct-response-tasks] candidates=' + summary.candidates);
  console.log('[repair-direct-response-tasks] repaired=' + summary.repaired);
  console.log('[repair-direct-response-tasks] skipped=' + summary.skipped);
  if (summary.sample.length > 0) {
    console.log('[repair-direct-response-tasks] sample=' + summary.sample.join(', '));
  }
}

main().catch((error) => {
  console.error('[repair-direct-response-tasks] ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
