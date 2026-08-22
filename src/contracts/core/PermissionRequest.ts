export type PermissionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type PermissionScope = 'once' | 'session' | 'workspace' | 'persistent';

export type PermissionAccessLevel = 'read_only' | 'read_write';

export type PermissionCommandMatchType = 'exact' | 'prefix';

export interface PermissionRequest {
  permission_id: string;
  created_at: string;
  updated_at: string;
  task_id: string | null;
  executor: string;
  kind: string;
  status: PermissionStatus;
  scope: PermissionScope;
  workspace: string | null;
  requested_value: string | null;
  resolved_value: string | null;
  reason: string;
  requested_by: string | null;
  decided_by: string | null;
  decision_note: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}
