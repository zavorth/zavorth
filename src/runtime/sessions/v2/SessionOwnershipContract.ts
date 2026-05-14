export type SessionOwnerKind =
  | 'agent_run'
  | 'live_terminal'
  | 'project_process'
  | 'pty'
  | 'standalone'
  | 'swarm_role';

export type SessionOwnerStatus =
  | 'active'
  | 'orphaned'
  | 'released'
  | 'reaped';

export type SessionOwnershipEventKind =
  | 'registered'
  | 'touched'
  | 'released'
  | 'marked_orphan'
  | 'reaped';

export type SessionOwnershipRecord = {
  ownershipId: string;
  sessionId: string;
  ownerRef: string;
  kind: SessionOwnerKind;
  surface: string;
  status: SessionOwnerStatus;
  runId: string | null;
  taskId: string | null;
  swarmId: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  orphanedAt: string | null;
  releasedAt: string | null;
  reapedAt: string | null;
  orphanReason: string | null;
  metadata: Record<string, unknown>;
};

export type RegisterSessionOwnershipInput = {
  sessionId: string;
  kind: SessionOwnerKind;
  surface?: string | null;
  runId?: string | null;
  taskId?: string | null;
  swarmId?: string | null;
  ownerRef?: string | null;
  now?: Date | string | null;
  metadata?: Record<string, unknown> | null;
};

export type SessionCleanupReceipt = {
  receiptId: string;
  action: SessionOwnershipEventKind;
  sessionId: string;
  ownershipId: string;
  ownerRef: string;
  status: SessionOwnerStatus;
  reason: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type SessionGarbageCollectorPolicy = {
  orphanAfterMs: number;
  reapAfterMs: number;
  protectedKinds: SessionOwnerKind[];
};
