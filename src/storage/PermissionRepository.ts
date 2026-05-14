import { Database } from './Database.js';
import { PermissionRequest, PermissionStatus, PermissionScope } from '../contracts/PermissionRequest.js';

type SavePermissionRequest = PermissionRequest;

export class PermissionRepository {
  private db!: Database;

  public async init(): Promise<void> {
    this.db = await Database.getInstance();
  }

  public save(permission: SavePermissionRequest): void {
    this.db.run(
      `INSERT OR REPLACE INTO permission_requests (
        permission_id, created_at, updated_at, task_id, executor, kind, status, scope,
        workspace, requested_value, resolved_value, reason, requested_by, decided_by,
        decision_note, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        permission.permission_id,
        permission.created_at,
        permission.updated_at,
        permission.task_id,
        permission.executor,
        permission.kind,
        permission.status,
        permission.scope,
        permission.workspace,
        permission.requested_value,
        permission.resolved_value,
        permission.reason,
        permission.requested_by,
        permission.decided_by,
        permission.decision_note,
        JSON.stringify(permission.metadata || {}),
      ],
    );
  }

  public getById(permissionId: string): PermissionRequest | undefined {
    const row = this.db.get('SELECT * FROM permission_requests WHERE permission_id = ?', [permissionId]);
    return row ? this.mapRow(row) : undefined;
  }

  public list(status?: PermissionStatus | 'all', limit: number = 20): PermissionRequest[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    if (!status || status === 'all') {
      const rows = this.db.all(
        'SELECT * FROM permission_requests ORDER BY updated_at DESC LIMIT ?',
        [normalizedLimit],
      );
      return rows.map((row: any) => this.mapRow(row));
    }

    const rows = this.db.all(
      'SELECT * FROM permission_requests WHERE status = ? ORDER BY updated_at DESC LIMIT ?',
      [status, normalizedLimit],
    );
    return rows.map((row: any) => this.mapRow(row));
  }

  public findPendingMatch(
    executor: string,
    kind: string,
    workspace: string | null,
    requestedValue: string | null,
    taskId: string | null,
    metadataMatch?: Record<string, any>,
  ): PermissionRequest | undefined {
    const rows = this.db.all(
      `SELECT * FROM permission_requests
       WHERE status = 'pending'
         AND executor = ?
         AND kind = ?
         AND COALESCE(workspace, '') = COALESCE(?, '')
         AND COALESCE(requested_value, '') = COALESCE(?, '')
         AND COALESCE(task_id, '') = COALESCE(?, '')
       ORDER BY updated_at DESC LIMIT 1`,
      [executor, kind, workspace, requestedValue, taskId],
    );

    const mapped = rows.map((row: any) => this.mapRow(row));
    return mapped.find((permission) => this.matchesMetadata(permission, metadataMatch)) || undefined;
  }

  public findApproved(
    executor: string,
    kind: string,
    workspace: string | null,
    metadataMatch?: Record<string, any>,
  ): PermissionRequest | undefined {
    return this.listApproved(executor, kind, workspace, metadataMatch)[0];
  }

  public findApprovedMatch(
    executor: string,
    kind: string,
    workspace: string | null,
    value: string | null,
    metadataMatch?: Record<string, any>,
  ): PermissionRequest | undefined {
    const normalizedValue = (value || '').trim();
    return this.listApproved(executor, kind, workspace, metadataMatch).find((permission) => {
      const resolved = String(permission.resolved_value || permission.requested_value || '').trim();
      return resolved === normalizedValue;
    });
  }

  public listApproved(
    executor?: string,
    kind?: string,
    workspace?: string | null,
    metadataMatch?: Record<string, any>,
  ): PermissionRequest[] {
    const clauses = [`status = 'approved'`];
    const params: any[] = [];

    if (executor) {
      clauses.push('executor = ?');
      params.push(executor);
    }

    if (kind) {
      clauses.push('kind = ?');
      params.push(kind);
    }

    const rows = this.db.all(
      `SELECT * FROM permission_requests
       WHERE ${clauses.join(' AND ')}
       ORDER BY updated_at DESC`,
      params,
    );

    const mapped = rows.map((row: any) => this.mapRow(row));
    return mapped.filter((permission) => {
      return this.matchesScope(permission, workspace ?? null) && this.matchesMetadata(permission, metadataMatch);
    });
  }

  private matchesScope(permission: PermissionRequest, workspace: string | null): boolean {
    switch (permission.scope) {
      case 'persistent':
      case 'session':
        return true;
      case 'workspace':
        return (permission.workspace || '') === (workspace || '');
      case 'once':
        return false;
      default:
        return false;
    }
  }

  private matchesMetadata(permission: PermissionRequest, metadataMatch?: Record<string, any>): boolean {
    if (!metadataMatch || Object.keys(metadataMatch).length === 0) {
      return true;
    }

    const metadata = permission.metadata || {};
    return Object.entries(metadataMatch).every(([key, value]) => {
      return metadata[key] === value;
    });
  }

  private mapRow(row: any): PermissionRequest {
    return {
      permission_id: row.permission_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      task_id: row.task_id,
      executor: row.executor,
      kind: row.kind,
      status: row.status as PermissionStatus,
      scope: row.scope as PermissionScope,
      workspace: row.workspace,
      requested_value: row.requested_value,
      resolved_value: row.resolved_value,
      reason: row.reason,
      requested_by: row.requested_by,
      decided_by: row.decided_by,
      decision_note: row.decision_note,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    };
  }
}
