import { Database } from './Database.js';
import { Task } from '../contracts/TaskContract.js';
import { StateMachine } from '../orchestrator/StateMachine.js';

export function mergeTaskForPersistence(existing: Task | undefined, incoming: Task): Task {
  if (!existing || existing.task_id !== incoming.task_id) {
    return incoming;
  }

  if (existing.status === incoming.status) {
    return incoming;
  }

  if (StateMachine.canTransition(existing.status, incoming.status)) {
    return incoming;
  }

  if (!StateMachine.shouldPreservePersistedStatus(existing.status, incoming.status)) {
    return incoming;
  }

  return {
    ...incoming,
    ...existing,
    metadata: {
      ...(incoming.metadata || {}),
      ...(existing.metadata || {}),
    },
    status: existing.status,
    result_summary: existing.result_summary ?? incoming.result_summary,
    error_summary: existing.error_summary ?? incoming.error_summary,
    updated_at: existing.updated_at || incoming.updated_at,
  };
}

export class TaskRepository {
  private db!: Database;

  public async init(): Promise<void> {
    this.db = await Database.getInstance();
  }

  public save(task: Task): void {
    const persisted = mergeTaskForPersistence(this.getById(task.task_id), task);
    this.db.run(
      `INSERT OR REPLACE INTO system_tasks (
        task_id, updated_at, source, chat_id, user_id, raw_message, normalized_message,
        command_type, intent, target, workspace, risk_level, status,
        requires_planning, requires_approval, approval_status,
        planner_used, executor_used, fallback_used, parent_task_id,
        actions_planned, actions_executed, target_files, artifacts,
        stdout_summary, stderr_summary, diff_summary, result_summary, error_summary,
        rollback_available, metadata
      ) VALUES (
        ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        persisted.task_id, persisted.source, persisted.chat_id, persisted.user_id, persisted.raw_message, persisted.normalized_message,
        persisted.command_type, persisted.intent, persisted.target, persisted.workspace, persisted.risk_level, persisted.status,
        persisted.requires_planning ? 1 : 0, persisted.requires_approval ? 1 : 0, persisted.approval_status,
        persisted.planner_used, persisted.executor_used, persisted.fallback_used ? 1 : 0, persisted.parent_task_id,
        JSON.stringify(persisted.actions_planned), JSON.stringify(persisted.actions_executed),
        JSON.stringify(persisted.target_files), JSON.stringify(persisted.artifacts),
        persisted.stdout_summary, persisted.stderr_summary, persisted.diff_summary, persisted.result_summary, persisted.error_summary,
        persisted.rollback_available ? 1 : 0, JSON.stringify(persisted.metadata)
      ]
    );
  }

  public getById(taskId: string): Task | undefined {
    const raw = this.db.get('SELECT * FROM system_tasks WHERE task_id = ?', [taskId]);
    return raw ? this.mapRow(raw) : undefined;
  }

  public getPendingTasks(): Task[] {
    const activeStatuses = StateMachine.getActiveStatuses();
    const placeholders = activeStatuses.map(() => '?').join(',');
    const rows = this.db.all(
      `SELECT * FROM system_tasks WHERE status IN (${placeholders})`,
      activeStatuses,
    );
    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  public claimNextTaskByCommands(
    commandTypes: string[],
    statuses: Task['status'][],
    workerId: string,
    staleAfterMs: number,
  ): Task | undefined {
    const safeCommands = Array.from(new Set(commandTypes.map((value) => String(value || '').trim()).filter(Boolean)));
    const safeStatuses = Array.from(new Set(statuses.map((value) => String(value || '').trim()).filter(Boolean))) as Task['status'][];
    if (safeCommands.length === 0 || safeStatuses.length === 0) {
      return undefined;
    }

    const rawDb = this.db.getRawDb();
    const nowIso = new Date().toISOString();
    const staleBeforeIso = new Date(Date.now() - Math.max(1, staleAfterMs)).toISOString();
    const commandPlaceholders = safeCommands.map(() => '?').join(', ');
    const statusPlaceholders = safeStatuses.map(() => '?').join(', ');

    const claim = rawDb.transaction(() => {
      const row = rawDb.prepare(
        `SELECT * FROM system_tasks
         WHERE command_type IN (${commandPlaceholders})
           AND status IN (${statusPlaceholders})
           AND (
             json_extract(metadata, '$.queue_lock.worker_id') IS NULL
             OR json_extract(metadata, '$.queue_lock.locked_at') IS NULL
             OR json_extract(metadata, '$.queue_lock.locked_at') <= ?
           )
         ORDER BY updated_at ASC
         LIMIT 1`,
      ).get(...safeCommands, ...safeStatuses, staleBeforeIso) as Record<string, unknown> | undefined;

      if (!row) {
        return undefined;
      }

      const task = this.mapRow(row);
      task.metadata = {
        ...(task.metadata || {}),
        queue_lock: {
          worker_id: workerId,
          locked_at: nowIso,
        },
      };
      this.save(task);
      return task;
    });

    return claim();
  }

  public getRecentTasks(limit: number = 10, userId?: string): Task[] {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const rows = userId
      ? this.db.all(
          'SELECT * FROM system_tasks WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
          [userId, safeLimit],
        )
      : this.db.all('SELECT * FROM system_tasks ORDER BY updated_at DESC LIMIT ?', [safeLimit]);
    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  public getRecentTasksByUsers(userIds: string[], limit: number = 10): Task[] {
    const normalizedUserIds = this.normalizeUserIds(userIds);
    if (normalizedUserIds.length === 0) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const placeholders = normalizedUserIds.map(() => '?').join(', ');
    const rows = this.db.all(
      `SELECT * FROM system_tasks
       WHERE user_id IN (${placeholders})
          OR json_extract(metadata, '$.runtime_user_id') IN (${placeholders})
          OR json_extract(metadata, '$.surface_identity.runtime_user_id') IN (${placeholders})
       ORDER BY updated_at DESC
       LIMIT ?`,
      [...normalizedUserIds, ...normalizedUserIds, ...normalizedUserIds, safeLimit],
    );
    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  public getRecentTasksByUsersAndTenant(userIds: string[], tenantId: string, limit: number = 10): Task[] {
    const normalizedUserIds = this.normalizeUserIds(userIds);
    const normalizedTenantId = String(tenantId || '').trim();
    if (normalizedUserIds.length === 0 || !normalizedTenantId) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const placeholders = normalizedUserIds.map(() => '?').join(', ');
    const rows = this.db.all(
      `SELECT * FROM system_tasks
       WHERE (
         user_id IN (${placeholders})
         OR json_extract(metadata, '$.runtime_user_id') IN (${placeholders})
         OR json_extract(metadata, '$.surface_identity.runtime_user_id') IN (${placeholders})
       )
       AND (
         json_extract(metadata, '$.tenant_id') = ?
         OR json_extract(metadata, '$.tenant_context.tenant_id') = ?
       )
       ORDER BY updated_at DESC
       LIMIT ?`,
      [...normalizedUserIds, ...normalizedUserIds, ...normalizedUserIds, normalizedTenantId, normalizedTenantId, safeLimit],
    );
    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  public getRecentTasksByChat(chatId: string, limit: number = 20): Task[] {
    const safeChatId = String(chatId || '').trim();
    if (!safeChatId) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = this.db.all(
      'SELECT * FROM system_tasks WHERE chat_id = ? ORDER BY updated_at DESC LIMIT ?',
      [safeChatId, safeLimit],
    );
    return rows.map((r: Record<string, unknown>) => this.mapRow(r));
  }

  public getLatestTaskForUser(userId: string, excludeTaskId?: string): Task | undefined {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
      return undefined;
    }

    const row = excludeTaskId
      ? this.db.get(
          'SELECT * FROM system_tasks WHERE user_id = ? AND task_id != ? ORDER BY created_at DESC LIMIT 1',
          [safeUserId, excludeTaskId],
        )
      : this.db.get('SELECT * FROM system_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [safeUserId]);

    return row ? this.mapRow(row) : undefined;
  }

  public getLatestTaskForUsers(userIds: string[], excludeTaskId?: string): Task | undefined {
    const normalizedUserIds = this.normalizeUserIds(userIds);
    if (normalizedUserIds.length === 0) {
      return undefined;
    }

    const placeholders = normalizedUserIds.map(() => '?').join(', ');
    const excludeClause = excludeTaskId ? 'AND task_id != ?' : '';
    const params = excludeTaskId
      ? [...normalizedUserIds, ...normalizedUserIds, ...normalizedUserIds, excludeTaskId]
      : [...normalizedUserIds, ...normalizedUserIds, ...normalizedUserIds];
    const row = this.db.get(
      `SELECT * FROM system_tasks
       WHERE (
         user_id IN (${placeholders})
         OR json_extract(metadata, '$.runtime_user_id') IN (${placeholders})
         OR json_extract(metadata, '$.surface_identity.runtime_user_id') IN (${placeholders})
       )
       ${excludeClause}
       ORDER BY created_at DESC
       LIMIT 1`,
      params,
    );
    return row ? this.mapRow(row) : undefined;
  }

  public getLatestTaskForUsersAndTenant(userIds: string[], tenantId: string, excludeTaskId?: string): Task | undefined {
    const normalizedUserIds = this.normalizeUserIds(userIds);
    const normalizedTenantId = String(tenantId || '').trim();
    if (normalizedUserIds.length === 0 || !normalizedTenantId) {
      return undefined;
    }

    const placeholders = normalizedUserIds.map(() => '?').join(', ');
    const excludeClause = excludeTaskId ? 'AND task_id != ?' : '';
    const params = excludeTaskId
      ? [
          ...normalizedUserIds,
          ...normalizedUserIds,
          ...normalizedUserIds,
          normalizedTenantId,
          normalizedTenantId,
          excludeTaskId,
        ]
      : [
          ...normalizedUserIds,
          ...normalizedUserIds,
          ...normalizedUserIds,
          normalizedTenantId,
          normalizedTenantId,
        ];
    const row = this.db.get(
      `SELECT * FROM system_tasks
       WHERE (
         user_id IN (${placeholders})
         OR json_extract(metadata, '$.runtime_user_id') IN (${placeholders})
         OR json_extract(metadata, '$.surface_identity.runtime_user_id') IN (${placeholders})
       )
       AND (
         json_extract(metadata, '$.tenant_id') = ?
         OR json_extract(metadata, '$.tenant_context.tenant_id') = ?
       )
       ${excludeClause}
       ORDER BY created_at DESC
       LIMIT 1`,
      params,
    );
    return row ? this.mapRow(row) : undefined;
  }

  private normalizeUserIds(userIds: string[]): string[] {
    return Array.from(
      new Set(
        (userIds || [])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );
  }

  private mapRow(row: Record<string, unknown>): Task {
    return {
      ...row,
      requires_planning: row.requires_planning === 1,
      requires_approval: row.requires_approval === 1,
      fallback_used: row.fallback_used === 1,
      rollback_available: row.rollback_available === 1,
      actions_planned: JSON.parse(String(row.actions_planned || '[]')),
      actions_executed: JSON.parse(String(row.actions_executed || '[]')),
      target_files: JSON.parse(String(row.target_files || '[]')),
      artifacts: JSON.parse(String(row.artifacts || '[]')),
      metadata: JSON.parse(String(row.metadata || '{}'))
    } as Task;
  }
}
