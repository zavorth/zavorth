import { Database } from './Database.js';

export interface ScheduledTask {
  id: string;
  command: string;
  schedule: string;
  created_at: string;
  last_run: string | null;
  next_run: string | null;
  created_by: string | null;
  status: 'active' | 'paused';
  intent_text?: string | null;
  delivery?: string | null;
  delivery_target?: string | null;
  last_status?: 'idle' | 'running' | 'completed' | 'failed' | null;
  last_error?: string | null;
  last_result?: string | null;
  run_count?: number | null;
  failure_count?: number | null;
  budget_json?: string | null;
  guardrail_json?: string | null;
  paused_reason?: string | null;
  last_failure_at?: string | null;
  consecutive_failures?: number | null;
}

/**
 * SchedulerRepository - manages scheduled tasks in SQLite.
 */
export class SchedulerRepository {
  constructor(private db: Database) {}

  public createTask(task: ScheduledTask): void {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      INSERT INTO scheduled_tasks (
        id, command, schedule, created_at, last_run, next_run, created_by, status,
        intent_text, delivery, delivery_target, last_status, last_error, last_result, run_count, failure_count,
        budget_json, guardrail_json, paused_reason, last_failure_at, consecutive_failures
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.command,
      task.schedule,
      task.created_at,
      task.last_run,
      task.next_run,
      task.created_by,
      task.status,
      task.intent_text || null,
      task.delivery || 'telegram',
      task.delivery_target || null,
      task.last_status || 'idle',
      task.last_error || null,
      task.last_result || null,
      Number(task.run_count || 0),
      Number(task.failure_count || 0),
      task.budget_json || null,
      task.guardrail_json || null,
      task.paused_reason || null,
      task.last_failure_at || null,
      Number(task.consecutive_failures || 0),
    );
  }

  public getTask(id: string): ScheduledTask | null {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`);
    const row = stmt.get(id);
    return row ? (row as ScheduledTask) : null;
  }

  public listActiveTasks(): ScheduledTask[] {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active' ORDER BY created_at DESC`);
    return stmt.all() as ScheduledTask[];
  }

  public listTasks(): ScheduledTask[] {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`SELECT * FROM scheduled_tasks ORDER BY created_at DESC`);
    return stmt.all() as ScheduledTask[];
  }

  public updateLastRun(
    id: string,
    input: {
      lastRun: string;
      nextRun: string | null;
      lastStatus: 'idle' | 'running' | 'completed' | 'failed';
      lastError?: string | null;
      lastResult?: string | null;
      runCount?: number | null;
      failureCount?: number | null;
      lastFailureAt?: string | null;
      consecutiveFailures?: number | null;
    },
  ): void {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      UPDATE scheduled_tasks
      SET last_run = ?, next_run = ?, last_status = ?, last_error = ?, last_result = ?, run_count = ?, failure_count = ?,
          last_failure_at = ?, consecutive_failures = ?
      WHERE id = ?`, );
    stmt.run(
      input.lastRun,
      input.nextRun,
      input.lastStatus,
      input.lastError || null,
      input.lastResult || null,
      Number(input.runCount || 0),
      Number(input.failureCount || 0),
      input.lastFailureAt || null,
      Number(input.consecutiveFailures || 0),
      id,
    );
  }

  public updateStatus(id: string, status: ScheduledTask['status'], pausedReason?: string | null): void {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`UPDATE scheduled_tasks SET status = ?, paused_reason = ? WHERE id = ?`);
    stmt.run(status, pausedReason || null, id);
  }

  public updateRuntimeMetadata(
    id: string,
    input: {
      budgetJson?: string | null;
      guardrailJson?: string | null;
      pausedReason?: string | null;
    },
  ): void {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      UPDATE scheduled_tasks
      SET budget_json = COALESCE(?, budget_json),
          guardrail_json = COALESCE(?, guardrail_json),
          paused_reason = COALESCE(?, paused_reason)
      WHERE id = ?`, );
    stmt.run(
      input.budgetJson || null,
      input.guardrailJson || null,
      input.pausedReason || null,
      id,
    );
  }

  public deleteTask(id: string): void {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`);
    stmt.run(id);
  }
}
