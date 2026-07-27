import type { PermissionRequest, PermissionScope } from '../contracts/PermissionRequest.js';

export type ZavorthPermissionOsScope = 'once' | 'task' | 'workspace' | 'project' | 'timeboxed';

type PermissionServiceLike = {
  listRequests: (status?: PermissionRequest['status'] | 'all', limit?: number) => Promise<PermissionRequest[]>;
};

export type PermissionScopeLedgerEntry = {
  permissionId: string;
  taskId: string | null;
  executor: string;
  kind: string;
  status: PermissionRequest['status'];
  legacyScope: PermissionScope;
  scope: ZavorthPermissionOsScope;
  workspace: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  revokable: boolean;
  audit: {
    command: string;
    reason: string;
  };
  resumesTask: {
    taskId: string | null;
    command: string | null;
    reason: string;
  };
};

export type PermissionScopeLedgerSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  revokable: number;
  byScope: Record<ZavorthPermissionOsScope, number>;
};

export type PermissionScopeLedgerSnapshot = {
  generatedAt: string;
  gate: 'task-operating-system';
  surface: 'permission-scope-ledger';
  summary: PermissionScopeLedgerSummary;
  entries: PermissionScopeLedgerEntry[];
};

export class PermissionScopeLedgerService {
  constructor(private readonly permissionService: PermissionServiceLike) {}

  public async buildSnapshot(input: {
    generatedAt: string;
    limit?: number;
  }): Promise<PermissionScopeLedgerSnapshot> {
    const entries = (await this.permissionService.listRequests('all', input.limit || 50))
      .map((permission) => this.toEntry(permission));
    return {
      generatedAt: input.generatedAt,
      gate: 'task-operating-system',
      surface: 'permission-scope-ledger',
      summary: this.summarize(entries),
      entries,
    };
  }

  public toEntry(permission: PermissionRequest): PermissionScopeLedgerEntry {
    const scope = this.normalizeScope(permission);
    const expiresAt = this.resolveExpiresAt(permission);
    const revokable = permission.status === 'approved' || permission.status === 'pending';
    const taskId = permission.task_id || null;
    return {
      permissionId: permission.permission_id,
      taskId,
      executor: permission.executor,
      kind: permission.kind,
      status: permission.status,
      legacyScope: permission.scope,
      scope,
      workspace: permission.workspace,
      requestedBy: permission.requested_by,
      decidedBy: permission.decided_by,
      createdAt: permission.created_at,
      updatedAt: permission.updated_at,
      expiresAt,
      revokable,
      audit: {
        command: `zavorth permissions revoke ${permission.permission_id}`,
        reason: revokable ? 'Permission aparece no ledger e pode ser revogada por id.'
          : 'Completed permission remains auditable but does not require active revocation.',
      },
      resumesTask: {
        taskId,
        command: taskId && permission.status === 'pending' ? `zavorth approve ${taskId}` : null,
        reason: taskId ? 'Permission is bound to a task; approval resumes the correct task.'
          : 'Permission without task fica only como policy auditavel.',
      },
    };
  }

  private summarize(entries: PermissionScopeLedgerEntry[]): PermissionScopeLedgerSummary {
    const byScope: Record<ZavorthPermissionOsScope, number> = {
      once: 0,
      task: 0,
      workspace: 0,
      project: 0,
      timeboxed: 0,
    };
    for (const entry of entries) {
      byScope[entry.scope] += 1;
    }
    return {
      total: entries.length,
      pending: entries.filter((entry) => entry.status === 'pending').length,
      approved: entries.filter((entry) => entry.status === 'approved').length,
      rejected: entries.filter((entry) => entry.status === 'rejected').length,
      expired: entries.filter((entry) => entry.status === 'expired').length,
      revokable: entries.filter((entry) => entry.revokable).length,
      byScope,
    };
  }

  private normalizeScope(permission: PermissionRequest): ZavorthPermissionOsScope {
    const metadataScope = String(permission.metadata?.['preview-engine7_scope'] || permission.metadata?.scope || '').trim().toLowerCase();
    if (metadataScope === 'timeboxed') {
      return 'timeboxed';
    }
    if (metadataScope === 'project') {
      return 'project';
    }
    if (metadataScope === 'task') {
      return 'task';
    }
    if (this.resolveExpiresAt(permission)) {
      return 'timeboxed';
    }
    switch (permission.scope) {
      case 'once':
        return permission.task_id ? 'task' : 'once';
      case 'session':
        return 'task';
      case 'workspace':
        return 'workspace';
      case 'persistent':
        return 'project';
      default:
        return 'once';
    }
  }

  private resolveExpiresAt(permission: PermissionRequest): string | null {
    const raw = String(
      permission.metadata?.expires_at ||
      permission.metadata?.expiresAt ||
      permission.metadata?.timeboxed_until ||
      '',
    ).trim();
    if (!raw) {
      return null;
    }
    return Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : raw;
  }
}
